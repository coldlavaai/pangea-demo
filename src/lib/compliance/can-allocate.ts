/**
 * canAllocate — Pre-start compliance check for operative allocation
 *
 * Checks performed (in order):
 *  1. Operative status not blocked
 *  2. RTW verified (manual field — no Gov.uk API)
 *  3. RTW not expired (if expiry date is set)
 *  4. CSCS not expired (if card type is not 'none')
 *  6. Document expiry check (documents table — any verified doc with expiry_date <= today)
 *  7-8. WTD: weekly hours ≤ 48h (warn at 44h) + 11h rest gap — skipped if wtd_opt_out
 *  9. Required certs present and valid (from labour_request.required_certs)
 *
 * NOTE: rtw_share_code is stored but Gov.uk share code verification API is
 * intentionally NOT used — RTW verification is handled manually by the admin.
 * UK/Ireland passport holders typically have no expiry and no share code.
 */

import { startOfISOWeek, endOfISOWeek } from 'date-fns'

interface CheckResult {
  canAllocate: boolean
  blockers: string[]
  warnings: string[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function canAllocate(supabase: any,
  operativeId: string,
  labourRequestId: string,
): Promise<CheckResult> {
  const blockers: string[] = []
  const warnings: string[] = []
  const today = new Date()

  // ── 1. Fetch operative fields ──────────────────────────────────────────────
  const { data: op, error: opErr } = await supabase
    .from('operatives')
    .select('status, wtd_opt_out, rtw_verified, rtw_expiry, cscs_expiry, cscs_card_type')
    .eq('id', operativeId)
    .single()

  if (opErr || !op) {
    return { canAllocate: false, blockers: ['Operative not found'], warnings: [] }
  }

  // ── 2. Status ──────────────────────────────────────────────────────────────
  if (op.status === 'blocked') {
    blockers.push('Operative is blocked from work')
  }

  // ── 3. RTW verified (manual check only) ───────────────────────────────────
  if (!op.rtw_verified) {
    blockers.push('Right to Work not verified')
  }

  // ── 4. RTW expiry (only checked if expiry date is set) ────────────────────
  if (op.rtw_expiry && new Date(op.rtw_expiry) < today) {
    blockers.push(`Right to Work expired (${op.rtw_expiry})`)
  }

  // ── 5. CSCS expiry ────────────────────────────────────────────────────────
  if (op.cscs_card_type) {
    if (op.cscs_expiry && new Date(op.cscs_expiry) < today) {
      blockers.push(`CSCS card expired (${op.cscs_expiry})`)
    }
  }

  // ── 6. Document expiry check (documents table) ────────────────────────────
  // Belt-and-braces: catches any verified doc with an expired expiry_date,
  // even if the cron hasn't run yet today.
  const { data: expiredDocs } = await supabase
    .from('documents')
    .select('document_type, expiry_date')
    .eq('operative_id', operativeId)
    .eq('status', 'verified')
    .not('expiry_date', 'is', null)
    .lte('expiry_date', today.toISOString().slice(0, 10))

  for (const doc of expiredDocs ?? []) {
    blockers.push(`Document expired: ${doc.document_type} (${doc.expiry_date})`)
  }

  // ── 8. Fetch labour request (for start_date + required_certs) ─────────────
  const { data: req, error: reqErr } = await supabase
    .from('labour_requests')
    .select('start_date, required_certs')
    .eq('id', labourRequestId)
    .single()

  if (reqErr || !req) {
    return { canAllocate: false, blockers: ['Labour request not found'], warnings: [] }
  }

  // ── 9. Working Time Regulations (skip if opted out) ───────────────────────
  if (!op.wtd_opt_out) {
    const startDate = new Date(req.start_date)
    const weekStart = startOfISOWeek(startDate)
    const weekEnd = endOfISOWeek(startDate)

    // Weekly hours in the same ISO week
    const { data: weekShifts } = await supabase
      .from('shifts')
      .select('scheduled_start, scheduled_end')
      .eq('operative_id', operativeId)
      .gte('scheduled_start', weekStart.toISOString())
      .lte('scheduled_end', weekEnd.toISOString())

    const weeklyHours = (weekShifts ?? []).reduce((acc: number, s: { scheduled_start: string; scheduled_end: string }) => {
      const hrs =
        (new Date(s.scheduled_end).getTime() - new Date(s.scheduled_start).getTime()) / 3_600_000
      return acc + hrs
    }, 0)

    if (weeklyHours >= 48) {
      blockers.push(
        `Working Time Limit: ${weeklyHours.toFixed(1)}h already scheduled this week (max 48h)`
      )
    } else if (weeklyHours >= 44) {
      warnings.push(
        `Near Working Time Limit: ${weeklyHours.toFixed(1)}h scheduled this week — approaching 48h cap`
      )
    }

    // 11h rest gap — assumes new shift starts at 07:00 on start_date
    const assumedShiftStart = new Date(`${req.start_date}T07:00:00`)
    const { data: lastShifts } = await supabase
      .from('shifts')
      .select('scheduled_end, actual_end')
      .eq('operative_id', operativeId)
      .lt('scheduled_start', assumedShiftStart.toISOString())
      .order('scheduled_start', { ascending: false })
      .limit(1)

    const lastShift = lastShifts?.[0]
    if (lastShift) {
      const lastEnd = lastShift.actual_end ?? lastShift.scheduled_end
      const restGapHours =
        (assumedShiftStart.getTime() - new Date(lastEnd).getTime()) / 3_600_000

      if (restGapHours < 11) {
        blockers.push(
          `Rest Period Violation: only ${restGapHours.toFixed(1)}h rest before new shift (minimum 11h required)`
        )
      } else if (restGapHours < 13) {
        warnings.push(
          `Short rest period: ${restGapHours.toFixed(1)}h before new shift (minimum is 11h)`
        )
      }
    }
  }

  // ── 10. Required certifications ───────────────────────────────────────────
  const requiredCerts: string[] = req.required_certs ?? []
  if (requiredCerts.length > 0) {
    const { data: cards } = await supabase
      .from('operative_cards')
      .select('card_scheme, expiry_date')
      .eq('operative_id', operativeId)

    const validCards = new Set<string>(
      (cards ?? [])
        .filter(
          (c: { card_scheme: string; expiry_date: string | null }) =>
            !c.expiry_date || new Date(c.expiry_date) >= today
        )
        .map((c: { card_scheme: string }) => c.card_scheme)
    )

    for (const cert of requiredCerts) {
      if (!validCards.has(cert)) {
        blockers.push(`Missing required certification: ${cert.toUpperCase()}`)
      }
    }
  }

  return {
    canAllocate: blockers.length === 0,
    blockers,
    warnings,
  }
}
