/**
 * Reminders Cron — runs daily at 08:00 UTC (see vercel.json)
 *
 * Actions:
 *  1. Finish reminders — labour requests ending within 7 days → create notification, mark sent
 *  2. Missing timesheets — active allocations with no timesheet by Wed (warning) or Fri (critical)
 *  3. Goodwill doc reminders — operatives with docs expiring within 90 days, gated to once/30 days
 *     (deduplication via notifications table — no extra column needed)
 *
 * WhatsApp for goodwill + staff alerts: TODO — awaiting doc_expiring + staff_alert SIDs from Plex (S36)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWhatsAppTemplate } from '@/lib/whatsapp/send'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createServiceClient()
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const result = {
    finish_reminders_sent: 0,
    timesheet_warnings: 0,
    timesheet_criticals: 0,
    goodwill_reminders: 0,
    errors: [] as string[],
  }

  // ── 1. Finish reminders ────────────────────────────────────────────────────
  // Requests where end_date is set, within next 7 days, reminder not yet sent
  const { data: endingRequests, error: reqErr } = await supabase
    .from('labour_requests')
    .select('id, start_date, end_date, sites!labour_requests_site_id_fkey(name)')
    .eq('organization_id', orgId)
    .eq('finish_reminder_sent', false)
    .not('end_date', 'is', null)
    .gt('end_date', today)           // hasn't ended yet
    .lte('end_date', sevenDaysFromNow) // ends within 7 days

  if (reqErr) {
    result.errors.push(`Ending requests query failed: ${reqErr.message}`)
  } else {
    for (const req of endingRequests ?? []) {
      const site = req.sites as { name: string } | null
      const siteName = site?.name ?? 'Unknown site'

      const { error: notifErr } = await supabase.from('notifications').insert({
        organization_id: orgId,
        type: 'request_ending',
        title: `Request ending soon — ${siteName}`,
        body: `Labour request at ${siteName} ends on ${req.end_date}. Review allocations and plan handover.`,
        severity: 'warning',
        labour_request_id: req.id,
      })

      if (notifErr) {
        result.errors.push(`Finish notif failed for request ${req.id}: ${notifErr.message}`)
        continue
      }

      // WhatsApp alert to staff
      if (process.env.STAFF_WHATSAPP_NUMBER && process.env.PANGAEA_STAFF_ALERT_SID) {
        await sendWhatsAppTemplate(
          process.env.STAFF_WHATSAPP_NUMBER,
          process.env.PANGAEA_STAFF_ALERT_SID,
          { '1': `Labour request at ${siteName} ends on ${req.end_date}. Review allocations and plan handover.` }
        ).catch((e) => result.errors.push(`Finish reminder WA failed: ${e.message}`))
      }

      const { error: markErr } = await supabase
        .from('labour_requests')
        .update({ finish_reminder_sent: true })
        .eq('id', req.id)

      if (markErr) {
        result.errors.push(`Mark sent failed for request ${req.id}: ${markErr.message}`)
      } else {
        result.finish_reminders_sent++
      }
    }
  }

  // ── 2. Missing timesheet alerts ────────────────────────────────────────────
  // Only meaningful to check on Wed (3), Thu (4), Fri (5)
  const dow = now.getDay() // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  if (dow >= 3 && dow <= 5) {
    const severity = dow >= 5 ? 'critical' : 'warning'

    // Monday of the current work week
    const daysFromMonday = dow - 1 // Mon=1 → 0, Wed=3 → 2, Fri=5 → 4
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - daysFromMonday)
    const weekStartStr = weekStart.toISOString().slice(0, 10)

    // Fetch all active allocations with operative name
    const { data: activeAllocs, error: allocErr } = await supabase
      .from('allocations')
      .select(`
        id, operative_id, site_id,
        operatives!allocations_operative_id_fkey(first_name, last_name)
      `)
      .eq('organization_id', orgId)
      .eq('status', 'active')

    if (allocErr) {
      result.errors.push(`Active allocations query failed: ${allocErr.message}`)
    } else {
      // Batch: fetch all timesheets for this week across all operative IDs
      const operativeIds = [...new Set((activeAllocs ?? []).map((a) => a.operative_id))]

      const { data: weekTimesheets } = await supabase
        .from('timesheets')
        .select('operative_id')
        .eq('organization_id', orgId)
        .eq('week_start', weekStartStr)
        .in('operative_id', operativeIds.length > 0 ? operativeIds : ['00000000-0000-0000-0000-000000000000'])

      const hasTimesheet = new Set((weekTimesheets ?? []).map((t) => t.operative_id))

      // Batch: fetch existing missing_timesheet notifications for this week (to avoid dupes)
      const { data: existingNotifs } = await supabase
        .from('notifications')
        .select('id, operative_id, severity')
        .eq('organization_id', orgId)
        .eq('type', 'missing_timesheet')
        .gte('created_at', weekStartStr)
        .in('operative_id', operativeIds.length > 0 ? operativeIds : ['00000000-0000-0000-0000-000000000000'])

      const existingByOp = new Map(
        (existingNotifs ?? []).map((n) => [n.operative_id, n])
      )

      for (const alloc of activeAllocs ?? []) {
        if (hasTimesheet.has(alloc.operative_id)) continue // timesheet submitted ✓

        const op = alloc.operatives as { first_name: string; last_name: string } | null
        const opName = op ? `${op.first_name} ${op.last_name}` : 'Unknown operative'

        const existing = existingByOp.get(alloc.operative_id)

        if (!existing) {
          // Create new notification
          const { error: e } = await supabase.from('notifications').insert({
            organization_id: orgId,
            type: 'missing_timesheet',
            title: `Missing timesheet — ${opName}`,
            body: `No timesheet submitted for week commencing ${weekStartStr}.`,
            severity,
            operative_id: alloc.operative_id,
          })
          if (e) {
            result.errors.push(`Timesheet notif failed for ${opName}: ${e.message}`)
          } else {
            severity === 'critical' ? result.timesheet_criticals++ : result.timesheet_warnings++
            // WhatsApp staff on Friday critical only
            if (severity === 'critical' && process.env.STAFF_WHATSAPP_NUMBER && process.env.PANGAEA_STAFF_ALERT_SID) {
              await sendWhatsAppTemplate(
                process.env.STAFF_WHATSAPP_NUMBER,
                process.env.PANGAEA_STAFF_ALERT_SID,
                { '1': `Missing timesheet: ${opName} has not submitted for w/c ${weekStartStr}. Please investigate.` }
              ).catch((e2) => result.errors.push(`Timesheet WA failed for ${opName}: ${e2.message}`))
            }
          }
        } else if (severity === 'critical' && existing.severity === 'warning') {
          // Escalate existing warning → critical (Friday)
          const { error: e } = await supabase
            .from('notifications')
            .update({ severity: 'critical', read: false, read_at: null })
            .eq('id', existing.id)
          if (e) {
            result.errors.push(`Escalate notif failed for ${opName}: ${e.message}`)
          } else {
            result.timesheet_criticals++
            // WhatsApp staff on escalation to critical
            if (process.env.STAFF_WHATSAPP_NUMBER && process.env.PANGAEA_STAFF_ALERT_SID) {
              await sendWhatsAppTemplate(
                process.env.STAFF_WHATSAPP_NUMBER,
                process.env.PANGAEA_STAFF_ALERT_SID,
                { '1': `Still missing timesheet: ${opName} — w/c ${weekStartStr}. Now critical.` }
              ).catch((e2) => result.errors.push(`Escalate WA failed for ${opName}: ${e2.message}`))
            }
          }
        }
      }
    }
  }

  // ── 3. Goodwill doc reminders ──────────────────────────────────────────────
  // For all non-blocked, non-prospect operatives with docs expiring within 90 days,
  // send a friendly reminder if we haven't done so in the last 30 days.
  // Gate: check notifications table for 'goodwill_doc_reminder' within 30 days.
  const ninetyDaysFromNow = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch operatives with verified docs expiring within 90 days (non-active statuses not covered by compliance cron)
  const { data: goodwillCandidates, error: goodwillErr } = await supabase
    .from('operatives')
    .select(`
      id, first_name, last_name, phone,
      documents!documents_operative_id_fkey(document_type, expiry_date, status)
    `)
    .eq('organization_id', orgId)
    .in('status', ['verified', 'available', 'working', 'unavailable'])

  if (goodwillErr) {
    result.errors.push(`Goodwill candidates query failed: ${goodwillErr.message}`)
  } else {
    // Batch fetch which operatives already got a goodwill reminder in the last 30 days
    const candidateIds = (goodwillCandidates ?? []).map((op) => op.id)
    const { data: recentGoodwill } = await supabase
      .from('notifications')
      .select('operative_id')
      .eq('organization_id', orgId)
      .eq('type', 'goodwill_doc_reminder')
      .gte('created_at', thirtyDaysAgo)
      .in('operative_id', candidateIds.length > 0 ? candidateIds : ['00000000-0000-0000-0000-000000000000'])

    const goodwillSentSet = new Set((recentGoodwill ?? []).map((n) => n.operative_id))

    for (const op of goodwillCandidates ?? []) {
      if (goodwillSentSet.has(op.id)) continue

      type DocRow = { document_type: string; expiry_date: string | null; status: string | null }
      const soonestExpiry = ((op.documents ?? []) as DocRow[])
        .filter((d) => d.status === 'verified' && d.expiry_date && d.expiry_date > today && d.expiry_date <= ninetyDaysFromNow)
        .sort((a, b) => a.expiry_date!.localeCompare(b.expiry_date!))[0] ?? null

      if (!soonestExpiry) continue

      const daysLeft = Math.ceil(
        (new Date(soonestExpiry.expiry_date!).getTime() - new Date(today).getTime()) /
        (1000 * 60 * 60 * 24)
      )

      const docLabels: Record<string, string> = {
        photo_id: 'Photo ID', cscs_card: 'CSCS card', right_to_work: 'Right to Work',
        cpcs_ticket: 'CPCS ticket', npors_ticket: 'NPORS ticket', first_aid: 'First Aid certificate',
      }
      const docLabel = docLabels[soonestExpiry.document_type] ?? soonestExpiry.document_type

      // Create internal notification
      const { error: notifErr } = await supabase.from('notifications').insert({
        organization_id: orgId,
        type: 'goodwill_doc_reminder',
        title: `Goodwill reminder sent — ${op.first_name} ${op.last_name}`,
        body: `${docLabel} expires in ${daysLeft} days (${soonestExpiry.expiry_date}). WhatsApp reminder sent to operative.`,
        severity: 'info',
        operative_id: op.id,
      })

      if (notifErr) {
        result.errors.push(`Goodwill notif failed for ${op.first_name} ${op.last_name}: ${notifErr.message}`)
        continue
      }

      if (op.phone) {
        await sendWhatsAppTemplate(op.phone, process.env.PANGAEA_DOC_EXPIRING_SID!, {
          '1': op.first_name,
          '2': docLabel,
          '3': soonestExpiry.expiry_date!,
        }).catch((e) => result.errors.push(`Goodwill WA failed for ${op.first_name}: ${e.message}`))
      }

      result.goodwill_reminders++
    }
  }

  // ── Log ───────────────────────────────────────────────────────────────────
  await supabase.from('cron_runs').upsert(
    { job_type: 'reminders', result },
    { onConflict: 'job_type,run_date' }
  )

  return NextResponse.json({ ok: true, ...result, ran_at: now.toISOString() })
}
