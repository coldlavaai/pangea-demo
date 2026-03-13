import { createServiceClient } from '@/lib/supabase/server'
import { sendWhatsApp } from './send'
import { sendWhatsAppTemplate, WHATSAPP_TEMPLATES } from './templates'
import { createNotification } from '@/lib/notifications/create'

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!
const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours

interface SmartSendParams {
  phone: string
  freeformBody: string
  /** Operative ID — if provided, updates last_contacted_at + used for failure notifications */
  operativeId?: string
  /** Operative first name — needed for RE_ENGAGE template */
  firstName?: string
  /** Organisation name — needed for RE_ENGAGE template variable {{2}} */
  orgName?: string
}

interface SmartSendResult {
  sid: string
  method: 'freeform' | 'deferred'
}

/**
 * Smart WhatsApp send — handles the 24h session window automatically.
 *
 * Within 24h → sends freeform (rich, personalised).
 * Outside 24h → sends RE_ENGAGE template + queues the freeform message
 *   as a deferred_message on the thread. When the operative replies,
 *   the inbound handler delivers the queued message.
 *
 * NOTE: For workflow-driven sends, prefer using the engine's initiateEngagement()
 * which handles the onEngaged hook pattern. smartSendWhatsApp is for non-workflow
 * sends (Rex messaging, ad-hoc comms panel sends, etc.) where the deferred_message
 * mechanism is more appropriate.
 *
 * Also updates operative.last_contacted_at if operativeId provided.
 */
export async function smartSendWhatsApp(params: SmartSendParams): Promise<SmartSendResult> {
  const { phone, freeformBody, operativeId, firstName } = params
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Check last inbound message time
  const { data: thread } = await db
    .from('message_threads')
    .select('id, last_inbound_at')
    .eq('phone_number', phone)
    .eq('organization_id', ORG_ID)
    .maybeSingle()

  // Determine if we're confidently within the 24h session window.
  // CRITICAL: Twilio accepts freeform messages outside 24h (returns a SID) but WhatsApp
  // silently drops delivery. We can NOT rely on try/catch to detect this.
  // Only use freeform when we have a last_inbound_at that's clearly within 24h.
  const lastTime = thread?.last_inbound_at ?? null
  const lastInbound = lastTime ? new Date(lastTime).getTime() : 0
  const withinSession = lastTime !== null && (Date.now() - lastInbound) < SESSION_WINDOW_MS

  let sid: string
  let method: SmartSendResult['method']

  if (withinSession) {
    // Confidently within 24h — send freeform (rich, personalised)
    sid = await sendWhatsApp(phone, freeformBody)
    method = 'freeform'
    console.log('[smart-send] freeform sent to', phone, '(last inbound:', lastTime, ')')
  } else {
    // Outside 24h — RE_ENGAGE + defer the freeform body
    const deferred = await tryReEngageAndDefer(db, phone, firstName, freeformBody, thread?.id)
    if (deferred) {
      sid = deferred.sid
      method = 'deferred'
    } else {
      // RE_ENGAGE failed — notify staff so they know the operative couldn't be reached
      await createNotification(supabase, {
        type: 'send_failed',
        title: `Failed to reach operative`,
        body: `WhatsApp to ${phone} failed — outside 24h window and RE_ENGAGE template could not be sent.${firstName ? ` (${firstName})` : ''}`,
        severity: 'warning',
        operative_id: operativeId ?? null,
        link_url: operativeId ? `/operatives/${operativeId}` : null,
        push: true,
      })

      throw new Error(
        `Cannot send WhatsApp to ${phone}: outside 24h session window and RE_ENGAGE failed. ` +
        `Last inbound: ${thread?.last_inbound_at ?? 'never'}`
      )
    }
  }

  // Update engagement tracking
  if (operativeId) {
    await db
      .from('operatives')
      .update({ last_contacted_at: new Date().toISOString() })
      .eq('id', operativeId)
  }

  return { sid, method }
}

/**
 * Send RE_ENGAGE template and queue the real message for delivery on reply.
 * Returns the template SID on success, or null if RE_ENGAGE isn't available.
 */
async function tryReEngageAndDefer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  phone: string,
  firstName: string | undefined,
  deferredBody: string,
  threadId: string | undefined,
): Promise<{ sid: string } | null> {
  const reEngageSid = WHATSAPP_TEMPLATES.RE_ENGAGE
  if (!reEngageSid) return null

  try {
    const sid = await sendWhatsAppTemplate(phone, reEngageSid, {
      '1': firstName ?? 'there',
    })

    // Queue the detailed message for delivery when they reply
    if (threadId) {
      await db.from('message_threads').update({
        deferred_message: deferredBody,
      }).eq('id', threadId)
    }

    console.log('[smart-send] RE_ENGAGE sent, deferred message queued for', phone)
    return { sid }
  } catch (e) {
    console.error('[smart-send] RE_ENGAGE failed:', e instanceof Error ? e.message : e)
    return null
  }
}
