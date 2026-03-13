/**
 * Offer Expiry Cron — runs hourly (see vercel.json)
 *
 * Actions:
 *  1. Find allocations with status='offered' and offer_expires_at < NOW()
 *  2. Set their status to 'expired'
 *  3. Log result to cron_runs (UNIQUE on job_type + run_date — logs once per day)
 *
 * NOTE: Full cascade logic (trying next operative in the queue) requires the
 * WhatsApp webhook handler (S21). For now, expired offers are set to 'expired'
 * and the admin is notified via the allocations dashboard.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createServiceClient()
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!
  const now = new Date().toISOString()

  const result: { expired: number; errors: string[] } = { expired: 0, errors: [] }

  // Find pending allocations where offer was sent but window has now closed
  // (offer_expires_at is set when Twilio sends the WhatsApp offer)
  const { data: staleOffers, error: fetchErr } = await supabase
    .from('allocations')
    .select('id')
    .eq('organization_id', orgId)
    .eq('status', 'pending')
    .lt('offer_expires_at', now)
    .not('offer_expires_at', 'is', null)

  if (fetchErr) {
    result.errors.push(`Fetch error: ${fetchErr.message}`)
  } else {
    for (const alloc of staleOffers ?? []) {
      // Terminate — no response within the offer window
      // Full cascade (trying next operative) will be added with S21 (webhook handler)
      const { error: updateErr } = await supabase
        .from('allocations')
        .update({ status: 'terminated' })
        .eq('id', alloc.id)
        .eq('organization_id', orgId)

      if (updateErr) {
        result.errors.push(`Failed to terminate allocation ${alloc.id}: ${updateErr.message}`)
      } else {
        result.expired++
      }
    }
  }

  // Log cron run (once per day — upsert on conflict)
  await supabase.from('cron_runs').upsert(
    { job_type: 'offer_expiry', result },
    { onConflict: 'job_type,run_date' }
  )

  return NextResponse.json({
    ok: true,
    ...result,
    ran_at: now,
  })
}
