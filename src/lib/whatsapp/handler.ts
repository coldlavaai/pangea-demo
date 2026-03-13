import { SupabaseClient } from '@supabase/supabase-js'
import { handleOfferReply } from './offer-handler'
import { handleAmberIntake } from './amber-handler'
import { handleSiteManager } from './site-manager-handler'
import { translateText, translateToEnglish } from '@/lib/translate'

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!

export interface InboundMessage {
  messageSid: string
  from: string        // E.164, e.g. '+447700900000'
  to: string          // E.164, e.g. '+447414157366'
  body: string
  mediaUrl?: string
  mediaType?: string
  numMedia: number
}

/**
 * Main inbound message handler.
 * Returns a TwiML-ready reply string (or empty string for no reply).
 */
export async function handleInbound(
  supabase: SupabaseClient,
  msg: InboundMessage
): Promise<string> {
  const { messageSid, from, body, mediaUrl, mediaType, numMedia } = msg

  console.log('[handler] inbound from:', from, 'body:', body.slice(0, 50))

  // 1. Find or create thread (select intake_state + intake_data for Amber routing)
  const { data: thread, error: threadError } = await supabase
    .from('message_threads')
    .upsert(
      { organization_id: ORG_ID, phone_number: from },
      { onConflict: 'phone_number,organization_id', ignoreDuplicates: false }
    )
    .select('id, operative_id, intake_state, intake_data, language, active_workflow_id, deferred_message')
    .single()

  if (threadError || !thread) {
    console.error('[handler] thread upsert error', threadError)
    return ''
  }

  // 2. Try to link operative by phone if not already linked
  let operativeId: string | null = thread.operative_id ?? null
  let operativeName = 'Operative'

  if (!operativeId) {
    const { data: op } = await supabase
      .from('operatives')
      .select('id, first_name, last_name')
      .eq('organization_id', ORG_ID)
      .eq('phone', from)
      .maybeSingle()

    if (op) {
      operativeId = op.id
      operativeName = `${op.first_name} ${op.last_name}`
      // Link operative to thread
      await supabase
        .from('message_threads')
        .update({ operative_id: op.id })
        .eq('id', thread.id)
    }
  } else {
    // Already linked — fetch name for notifications
    const { data: op } = await supabase
      .from('operatives')
      .select('first_name, last_name')
      .eq('id', operativeId)
      .single()
    if (op) operativeName = `${op.first_name} ${op.last_name}`
  }

  // 2b. Check if sender is a staff user (site manager, admin, etc.)
  // Try multiple phone formats: +447XXXXXXX (E.164), 07XXXXXXX (UK local), 447XXXXXXX (no +)
  let staffUser: { id: string; first_name: string; last_name: string; role: string } | null = null
  if (!operativeId) {
    const e164 = from.replace(/\s/g, '') // e.g. +447588703882
    const noPlus = e164.replace(/^\+/, '') // 447588703882
    const ukLocal = e164.startsWith('+44') ? '0' + e164.slice(3) : e164 // 07588703882
    const { data: u } = await supabase
      .from('users')
      .select('id, first_name, last_name, role')
      .eq('organization_id', ORG_ID)
      .in('phone_number', [e164, noPlus, ukLocal])
      .maybeSingle()
    if (u) staffUser = u
  }

  // 3. Dedup check — UNIQUE index on external_id handles races, but skip early if already stored
  const { data: existing } = await supabase
    .from('messages')
    .select('id')
    .eq('external_id', messageSid)
    .maybeSingle()

  if (existing) {
    console.log('[handler] duplicate MessageSid, skipping', messageSid)
    return ''
  }

  // 4. Translate inbound message to English if non-English thread
  const threadLang = (thread.language as string | null) ?? 'en'
  let bodyEn: string | null = null
  if (body && threadLang !== 'en') {
    const { translated, wasTranslated } = await translateToEnglish(body, threadLang)
    if (wasTranslated) bodyEn = translated
  }

  // 5. Store the inbound message (body = original language, body_en = English translation)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: msgError } = await (supabase as any).from('messages').insert({
    organization_id: ORG_ID,
    thread_id: thread.id,
    operative_id: operativeId,
    channel: 'whatsapp',
    direction: 'inbound',
    body: numMedia > 0 ? (body || null) : body,
    body_en: bodyEn,
    media_url: mediaUrl ?? null,
    media_type: mediaType ?? null,
    external_id: messageSid,
    status: 'received',
  })

  if (msgError) {
    // UNIQUE violation = duplicate webhook replay — safe to ignore
    if (msgError.code === '23505') {
      console.log('[handler] UNIQUE duplicate, ignoring')
      return ''
    }
    console.error('[handler] message insert error', msgError)
    return ''
  }

  // 5. Update thread last message + last_inbound_at + increment unread count
  const now = new Date().toISOString()
  await supabase
    .from('message_threads')
    .update({
      last_message: body || (numMedia > 0 ? '[Media]' : ''),
      last_message_at: now,
      last_inbound_at: now,
    })
    .eq('id', thread.id)

  await supabase.rpc('increment_thread_unread', { thread_id: thread.id })

  // Update operative engagement tracking
  if (operativeId) {
    await supabase
      .from('operatives')
      .update({ last_reply_at: now })
      .eq('id', operativeId)
  }

  // 5b. Deliver any deferred message (queued by RE_ENGAGE flow)
  // When smartSendWhatsApp couldn't send freeform (outside 24h), it sent RE_ENGAGE
  // and stored the real message in deferred_message. Now that the operative replied,
  // the 24h window is open — deliver the queued message immediately.
  if (thread.deferred_message) {
    try {
      const { sendWhatsApp: sendWA } = await import('./send')
      let deferredBody = thread.deferred_message as string
      // Translate deferred message if operative's language isn't English
      if (threadLang !== 'en') {
        const { translated, wasTranslated } = await translateText(deferredBody, threadLang)
        if (wasTranslated) deferredBody = translated
      }
      await sendWA(from, deferredBody)
      await supabase.from('message_threads').update({ deferred_message: null }).eq('id', thread.id)
      console.log('[handler] deferred message delivered to', from)
    } catch (e) {
      console.error('[handler] failed to deliver deferred message:', e instanceof Error ? e.message : e)
    }
  }

  // 6. Route: staff user → offer reply → Amber → default
  let reply = ''

  // Staff/site manager route — takes priority over everything else
  if (staffUser) {
    reply = await handleSiteManager({
      supabase,
      user: staffUser,
      threadId: thread.id,
      intakeState: thread.intake_state ?? null,
      intakeData: (thread.intake_data as Record<string, unknown>) ?? {},
      messageBody: body,
      fromPhone: from,
    })
  }

  // Workflow routing — check BEFORE offer handler (workflow takes priority)
  if (!reply && thread.active_workflow_id && operativeId) {
    const { processInbound } = await import('@/lib/workflows/engine')
    const workflowReply = await processInbound(
      thread.id,
      thread.active_workflow_id,
      operativeId,
      body,
      mediaUrl ? { url: mediaUrl, type: mediaType! } : undefined
    )
    if (workflowReply) reply = workflowReply
  }

  if (!reply && operativeId) {
    const offerReply = await handleOfferReply({
      supabase,
      operativeId,
      operativeName,
      messageBody: body,
      orgId: ORG_ID,
    })
    if (offerReply) reply = offerReply
  }

  console.log('[handler] operativeId:', operativeId, 'intake_state:', thread.intake_state)

  // 7. Amber intake — unknown sender OR operative with active intake session (including dashboard-triggered onboarding)
  if (!reply) {
    const terminalStates = ['qualified', 'rejected', 'docs_link_sent']
    const inIntake = !operativeId || (thread.intake_state != null && thread.intake_state !== '')
    if (inIntake && !terminalStates.includes(thread.intake_state ?? '')) {
      if (!body && numMedia > 0) {
        // Photo sent during text intake — prompt for text
        reply = "Thanks for the photo! 📷 Please also send a text message so I can help you register."
      } else if (body) {
        reply = await handleAmberIntake({
          supabase,
          threadId: thread.id,
          intakeState: thread.intake_state ?? null,
          intakeData: (thread.intake_data as Record<string, unknown>) ?? {},
          messageBody: body,
          fromPhone: from,
          orgId: ORG_ID,
          language: (thread.language as string | null) ?? 'en',
        })
      }
    } else if (inIntake && thread.intake_state === 'docs_link_sent') {
      // Already sent link — remind them
      reply = await handleAmberIntake({
        supabase,
        threadId: thread.id,
        intakeState: thread.intake_state,
        intakeData: (thread.intake_data as Record<string, unknown>) ?? {},
        messageBody: body,
        fromPhone: from,
        orgId: ORG_ID,
        language: (thread.language as string | null) ?? 'en',
      })
    }
  }

  // 8. Default — existing operative, no active offer, not in intake
  // If they have data gaps, Amber acknowledges and the admin can trigger onboarding from the dashboard.
  // No more generic "we received your message" — Amber is always intelligent.
  if (!reply && operativeId && !staffUser) {
    const { data: op } = await supabase
      .from('operatives')
      .select('first_name, status')
      .eq('id', operativeId)
      .single()
    const name = op?.first_name ?? 'there'
    reply = `Hi ${name}, thanks for your message! Our team has been notified and someone will be in touch with you shortly.`
  }

  // 9. Translate outbound reply if operative's language isn't English
  let translatedReply = reply
  let replyBodyEn: string | null = null
  if (reply && threadLang !== 'en') {
    const { translated, wasTranslated } = await translateText(reply, threadLang)
    if (wasTranslated) {
      replyBodyEn = reply // English original
      translatedReply = translated // What operative actually receives
    }
  }

  // 10. Store outbound reply in messages table so it appears in comms log
  if (translatedReply) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('messages').insert({
      organization_id: ORG_ID,
      thread_id: thread.id,
      operative_id: operativeId,
      channel: 'whatsapp',
      direction: 'outbound',
      body: translatedReply,
      body_en: replyBodyEn,
      status: 'sent',
    })
    await supabase
      .from('message_threads')
      .update({ last_message: translatedReply, last_message_at: new Date().toISOString() })
      .eq('id', thread.id)
  }

  return translatedReply
}
