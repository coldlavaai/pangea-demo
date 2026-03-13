/**
 * Compliance Cron — runs daily at 08:00 UTC (see vercel.json)
 *
 * Actions:
 *  1. Block operatives with expired RTW (where rtw_expiry is set and < today)
 *  2. Block operatives with expired CSCS (where cscs_card_type != 'none' and cscs_expiry < today)
 *  3. Log result to cron_runs table (UNIQUE on job_type + run_date prevents double-fire)
 *
 * RTW NOTE: Share code / Gov.uk verification API is NOT used.
 * RTW is manually verified by the admin. This job only acts on expiry dates.
 *
 * UK/Ireland passport holders typically have no rtw_expiry set — they will not be blocked.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  // Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createServiceClient()
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!
  const today = new Date().toISOString()

  const result: {
    rtw_blocked: number
    cscs_blocked: number
    errors: string[]
  } = { rtw_blocked: 0, cscs_blocked: 0, errors: [] }

  // ── 1. Block operatives with expired RTW ──────────────────────────────────
  const { data: expiredRtw, error: rtwErr } = await supabase
    .from('operatives')
    .select('id, first_name, last_name, rtw_expiry')
    .eq('organization_id', orgId)
    .neq('status', 'blocked')
    .lt('rtw_expiry', today)
    .not('rtw_expiry', 'is', null)

  if (rtwErr) {
    result.errors.push(`RTW query error: ${rtwErr.message}`)
  } else {
    for (const op of expiredRtw ?? []) {
      const { error: blockErr } = await supabase
        .from('operatives')
        .update({ status: 'blocked' })
        .eq('id', op.id)
        .eq('organization_id', orgId)

      if (blockErr) {
        result.errors.push(`Failed to block ${op.first_name} ${op.last_name}: ${blockErr.message}`)
      } else {
        result.rtw_blocked++
      }
    }
  }

  // ── 2. Block operatives with expired CSCS ─────────────────────────────────
  const { data: expiredCscs, error: cscsErr } = await supabase
    .from('operatives')
    .select('id, first_name, last_name, cscs_expiry, cscs_card_type')
    .eq('organization_id', orgId)
    .neq('status', 'blocked')
    .not('cscs_card_type', 'is', null)
    .lt('cscs_expiry', today)
    .not('cscs_expiry', 'is', null)

  if (cscsErr) {
    result.errors.push(`CSCS query error: ${cscsErr.message}`)
  } else {
    for (const op of expiredCscs ?? []) {
      const { error: blockErr } = await supabase
        .from('operatives')
        .update({ status: 'blocked' })
        .eq('id', op.id)
        .eq('organization_id', orgId)

      if (blockErr) {
        result.errors.push(`Failed to block ${op.first_name} ${op.last_name}: ${blockErr.message}`)
      } else {
        result.cscs_blocked++
      }
    }
  }

  // ── 3. Log cron run ───────────────────────────────────────────────────────
  await supabase.from('cron_runs').upsert(
    { job_type: 'compliance', result },
    { onConflict: 'job_type,run_date' }
  )

  return NextResponse.json({
    ok: true,
    ...result,
    ran_at: new Date().toISOString(),
  })
}
