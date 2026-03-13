import { sendWhatsAppTemplate, getTemplateSid } from '@/lib/whatsapp/templates'

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!
const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any

/**
 * Check if an operative's phone has an active 24h session window.
 * Only trusts last_inbound_at (not updated_at) — see smart-send.ts for rationale.
 */
export async function isWithinSessionWindow(db: AnyDb, phone: string): Promise<boolean> {
  const { data: thread } = await db
    .from('message_threads')
    .select('last_inbound_at')
    .eq('phone_number', phone)
    .eq('organization_id', ORG_ID)
    .maybeSingle()

  const lastTime = thread?.last_inbound_at ?? null
  if (!lastTime) return false
  return (Date.now() - new Date(lastTime).getTime()) < SESSION_WINDOW_MS
}

/**
 * Initiate engagement with an operative. If within 24h session window,
 * returns 'engaged' (caller should send content directly). If outside 24h,
 * sends RE_ENGAGE template and returns 're_engaged' (engine will call
 * onEngaged when operative replies).
 */
export async function initiateEngagement(
  db: AnyDb,
  phone: string,
  firstName: string,
  language?: string | null,
  orgName?: string,
): Promise<'engaged' | 're_engaged'> {
  const withinSession = await isWithinSessionWindow(db, phone)

  if (withinSession) {
    return 'engaged'
  }

  // Outside 24h — send RE_ENGAGE template (in operative's language if available)
  const reEngageSid = getTemplateSid('RE_ENGAGE', language)
  if (!reEngageSid) {
    throw new Error(`RE_ENGAGE template not configured — cannot contact ${phone} outside 24h window`)
  }

  await sendWhatsAppTemplate(phone, reEngageSid, {
    '1': firstName ?? 'there',
    '2': orgName ?? 'Pangaea',
  })

  console.log('[workflow-engine] RE_ENGAGE sent to', phone)
  return 're_engaged'
}
