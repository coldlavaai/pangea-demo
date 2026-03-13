import { SupabaseClient } from '@supabase/supabase-js'
import { sendWhatsApp } from './send'
import { format } from 'date-fns'
import { createNotification } from '@/lib/notifications/create'

const YES_KEYWORDS = new Set(['yes', 'y', 'yeah', 'yep', 'yup', 'ok', 'okay', 'accept', '1', '✓', '✅'])
const NO_KEYWORDS = new Set(['no', 'n', 'nope', 'reject', 'decline', '2', '✗', '❌', "can't", 'cant'])

export function detectOfferIntent(body: string): 'yes' | 'no' | null {
  const clean = body.trim().toLowerCase()
  if (YES_KEYWORDS.has(clean)) return 'yes'
  if (NO_KEYWORDS.has(clean)) return 'no'
  return null
}

interface HandleOfferReplyParams {
  supabase: SupabaseClient
  operativeId: string
  operativeName: string
  messageBody: string
  orgId: string
}

/**
 * Handle an inbound YES/NO reply to an active offer.
 * Returns a reply string to send back to the operative, or null if no active offer found.
 */
export async function handleOfferReply({
  supabase,
  operativeId,
  operativeName,
  messageBody,
  orgId,
}: HandleOfferReplyParams): Promise<string | null> {
  // Find the active pending offer for this operative
  const { data: allocation } = await supabase
    .from('allocations')
    .select(`
      id, status, start_date, agreed_day_rate, offer_expires_at,
      site:sites!allocations_site_id_fkey(name),
      labour_request:labour_requests!allocations_labour_request_id_fkey(
        trade_category:trade_categories!labour_requests_trade_category_id_fkey(name)
      )
    `)
    .eq('organization_id', orgId)
    .eq('operative_id', operativeId)
    .eq('status', 'pending')
    .not('offer_sent_at', 'is', null)
    .gt('offer_expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!allocation) return null

  const intent = detectOfferIntent(messageBody)
  if (!intent) return null

  const siteName = (allocation.site as unknown as { name: string } | null)?.name ?? 'the site'
  const trade = (allocation.labour_request as unknown as { trade_category: { name: string } | null } | null)
    ?.trade_category?.name ?? 'the role'
  const dateStr = format(new Date(allocation.start_date), 'd MMM yyyy')
  const staffNumber = process.env.STAFF_WHATSAPP_NUMBER!

  if (intent === 'yes') {
    // Confirm the allocation
    const { error } = await supabase
      .from('allocations')
      .update({
        status: 'confirmed',
        offer_responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', allocation.id)
      .eq('organization_id', orgId)

    if (error) {
      console.error('[offer-handler] confirm error', error)
      return "Sorry, something went wrong confirming your booking. Please call us directly."
    }

    // Notify staff
    try {
      await sendWhatsApp(
        staffNumber,
        `✅ *${operativeName}* has ACCEPTED the offer for *${siteName}* (${trade}) on ${dateStr}. Allocation confirmed.`
      )
    } catch (e) {
      console.error('[offer-handler] staff notify error', e)
    }

    // BOS notification
    await createNotification(supabase, {
      type: 'offer_accepted',
      title: `Offer Accepted: ${operativeName}`,
      body: `${siteName} · ${trade} · ${dateStr}`,
      severity: 'info',
      operative_id: operativeId,
      link_url: `/operatives/${operativeId}`,
      push: true,
    })

    return `Great, you're confirmed for ${siteName} (${trade}) on ${dateStr}. See you there! 👷`
  }

  if (intent === 'no') {
    // Terminate the allocation
    const { error } = await supabase
      .from('allocations')
      .update({
        status: 'terminated',
        offer_responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', allocation.id)
      .eq('organization_id', orgId)

    if (error) {
      console.error('[offer-handler] decline error', error)
    }

    // Notify staff
    try {
      await sendWhatsApp(
        staffNumber,
        `❌ *${operativeName}* has DECLINED the offer for *${siteName}* (${trade}) on ${dateStr}.`
      )
    } catch (e) {
      console.error('[offer-handler] staff notify error', e)
    }

    // BOS notification
    await createNotification(supabase, {
      type: 'offer_declined',
      title: `Offer Declined: ${operativeName}`,
      body: `${siteName} · ${trade} · ${dateStr}`,
      severity: 'warning',
      operative_id: operativeId,
      link_url: `/operatives/${operativeId}`,
      push: true,
    })

    return `No problem, we'll remove you from this one. We'll be in touch with other opportunities.`
  }

  return null
}
