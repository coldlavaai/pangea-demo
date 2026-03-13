/**
 * Compliance Check Cron — runs daily at midnight UK time (00:00 UTC, see vercel.json)
 *
 * Actions per operative (verified / available / working):
 *  1. Verified document expired today or earlier → BLOCK operative + terminate future allocations
 *  2. Verified document expiring within 7 days → set compliance_alert = 'expiring_soon' (warn only)
 *  3. All docs fine + stale alert present → clear compliance_alert / blocked_reason / blocked_at
 *  4. Verified document expiring in 8–30 days → warning notification (internal)
 *  5. Verified document expiring in 31–60 days → info notification + WhatsApp to operative (stub)
 *  6. Verified document expiring in 61–90 days → info notification only
 *  Tiers 4/5/6 deduplicate via the notifications table (only fire once per tier per operative).
 *
 * WhatsApp for tiers 4/5: requires doc_expiring template SID from Plex (pending S36 Plex actions).
 * STAFF_ALERT_NUMBER env var: Liam's number for critical escalation (pending S36 Plex actions).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWhatsAppTemplate } from '@/lib/whatsapp/send'

const DOC_TYPE_LABELS: Record<string, string> = {
  photo_id: 'Photo ID',
  cscs_card: 'CSCS card',
  right_to_work: 'Right to Work',
  cpcs_ticket: 'CPCS ticket',
  npors_ticket: 'NPORS ticket',
  lantra_cert: 'Lantra certificate',
  first_aid: 'First Aid certificate',
}

// Tier definitions: [maxDays, minDays, notifType, severity, label]
const EXPIRY_TIERS = [
  { max: 30,  min: 8,  type: 'doc_expiring_30', severity: 'warning' as const, label: '~30 days'  },
  { max: 60,  min: 31, type: 'doc_expiring_60', severity: 'info'    as const, label: '~60 days'  },
  { max: 90,  min: 61, type: 'doc_expiring_90', severity: 'info'    as const, label: '~90 days'  },
] as const

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createServiceClient()
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!
  const today = new Date().toISOString().slice(0, 10)
  const sevenDaysFromNow   = daysFromToday(7)
  const ninetyDaysFromNow  = daysFromToday(90)

  const result = {
    checked: 0,
    blocked: 0,
    warned: 0,
    cleared: 0,
    tier_notifications: 0,
    errors: [] as string[],
  }

  // ── Fetch active operatives with verified docs ─────────────────────────────
  const { data: operatives, error: fetchErr } = await supabase
    .from('operatives')
    .select(`
      id, first_name, last_name, phone, status, compliance_alert,
      documents!documents_operative_id_fkey(id, document_type, expiry_date, status)
    `)
    .eq('organization_id', orgId)
    .in('status', ['verified', 'available', 'working'])

  if (fetchErr || !operatives) {
    return NextResponse.json({ ok: false, error: fetchErr?.message ?? 'No operatives' }, { status: 500 })
  }

  result.checked = operatives.length

  // ── Batch fetch existing tier notifications (dedup) ────────────────────────
  const operativeIds = operatives.map((op) => op.id)
  const tierTypes = EXPIRY_TIERS.map((t) => t.type)
  const cutoff120 = daysAgo(120) // notifications older than 120 days don't count for dedup

  const { data: existingTierNotifs } = await supabase
    .from('notifications')
    .select('operative_id, type')
    .eq('organization_id', orgId)
    .in('type', tierTypes)
    .in('operative_id', operativeIds.length > 0 ? operativeIds : ['00000000-0000-0000-0000-000000000000'])
    .gte('created_at', cutoff120)

  // Set of "operative_id:type" — O(1) lookup to avoid duplicate notifications
  const notifiedSet = new Set(
    (existingTierNotifs ?? []).map((n) => `${n.operative_id}:${n.type}`)
  )

  // ── Per-operative compliance loop ──────────────────────────────────────────
  for (const op of operatives) {
    type DocRow = { id: string; document_type: string; expiry_date: string | null; status: string | null }
    const verifiedDocs = ((op.documents ?? []) as DocRow[])
      .filter((d) => d.status === 'verified' && d.expiry_date)

    const expiredDoc    = verifiedDocs.find((d) => d.expiry_date! <= today)
    const expiringDoc7  = verifiedDocs.find((d) => d.expiry_date! > today && d.expiry_date! <= sevenDaysFromNow)
    // Soonest doc expiring between 8 and 90 days
    const mediumTermDoc = !expiredDoc ? verifiedDocs
      .filter((d) => d.expiry_date! > sevenDaysFromNow && d.expiry_date! <= ninetyDaysFromNow)
      .sort((a, b) => a.expiry_date!.localeCompare(b.expiry_date!))[0] ?? null
      : null

    // ── 1. Hard block ────────────────────────────────────────────────────────
    if (expiredDoc) {
      const docLabel     = DOC_TYPE_LABELS[expiredDoc.document_type] ?? expiredDoc.document_type
      const blockedReason = `Auto-blocked: ${docLabel} expired on ${expiredDoc.expiry_date}`

      const { error: blockErr } = await supabase
        .from('operatives')
        .update({
          status: 'blocked',
          compliance_alert: 'expired_document',
          blocked_reason: blockedReason,
          blocked_at: new Date().toISOString(),
        })
        .eq('id', op.id)

      if (blockErr) {
        result.errors.push(`Block failed for ${op.first_name} ${op.last_name}: ${blockErr.message}`)
        continue
      }

      // Terminate future allocations
      await supabase
        .from('allocations')
        .update({
          status: 'terminated',
          notes: `Auto-terminated: operative blocked — ${blockedReason}`,
        })
        .eq('operative_id', op.id)
        .in('status', ['pending', 'confirmed'])
        .gt('start_date', today)

      // BOS notification
      await supabase.from('notifications').insert({
        organization_id: orgId,
        type: 'compliance_block',
        title: `Operative blocked — ${op.first_name} ${op.last_name}`,
        body: blockedReason,
        severity: 'critical',
        operative_id: op.id,
      })

      // WhatsApp alert to staff
      if (process.env.STAFF_WHATSAPP_NUMBER && process.env.PANGAEA_STAFF_ALERT_SID) {
        await sendWhatsAppTemplate(
          process.env.STAFF_WHATSAPP_NUMBER,
          process.env.PANGAEA_STAFF_ALERT_SID,
          { '1': `${op.first_name} ${op.last_name} has been auto-blocked. ${blockedReason}. Future allocations terminated.` }
        ).catch((e) => result.errors.push(`Block WA failed for ${op.first_name}: ${e.message}`))
      }

      result.blocked++
      continue
    }

    // ── 2. 7-day warning ─────────────────────────────────────────────────────
    if (expiringDoc7) {
      if (op.compliance_alert !== 'expiring_soon') {
        const { error: warnErr } = await supabase
          .from('operatives')
          .update({ compliance_alert: 'expiring_soon' })
          .eq('id', op.id)

        if (warnErr) {
          result.errors.push(`Warn failed for ${op.first_name} ${op.last_name}: ${warnErr.message}`)
        } else {
          result.warned++
        }
      }
    } else if (op.compliance_alert) {
      // ── 3. Clear stale alert ───────────────────────────────────────────────
      const { error: clearErr } = await supabase
        .from('operatives')
        .update({ compliance_alert: null, blocked_reason: null, blocked_at: null })
        .eq('id', op.id)

      if (clearErr) {
        result.errors.push(`Clear failed for ${op.first_name} ${op.last_name}: ${clearErr.message}`)
      } else {
        result.cleared++
      }
    }

    // ── 4/5/6. Medium-term tier notifications (8–90 days) ────────────────────
    if (mediumTermDoc) {
      const daysLeft = Math.ceil(
        (new Date(mediumTermDoc.expiry_date!).getTime() - new Date(today).getTime()) /
        (1000 * 60 * 60 * 24)
      )
      const docLabel = DOC_TYPE_LABELS[mediumTermDoc.document_type] ?? mediumTermDoc.document_type

      const tier = EXPIRY_TIERS.find((t) => daysLeft >= t.min && daysLeft <= t.max)
      if (tier && !notifiedSet.has(`${op.id}:${tier.type}`)) {
        const urgency =
          tier.type === 'doc_expiring_30' ? 'Arrange renewal urgently.' :
          tier.type === 'doc_expiring_60' ? 'Please arrange renewal soon.' :
          'Plan for renewal.'

        const { error: notifErr } = await supabase.from('notifications').insert({
          organization_id: orgId,
          type: tier.type,
          title: `${docLabel} expiring in ${daysLeft} days — ${op.first_name} ${op.last_name}`,
          body: `${docLabel} expires on ${mediumTermDoc.expiry_date}. ${urgency}`,
          severity: tier.severity,
          operative_id: op.id,
        })

        if (notifErr) {
          result.errors.push(`Tier notif failed for ${op.first_name} ${op.last_name}: ${notifErr.message}`)
        } else {
          notifiedSet.add(`${op.id}:${tier.type}`)
          result.tier_notifications++

          if ((tier.type === 'doc_expiring_30' || tier.type === 'doc_expiring_60') && op.phone) {
            await sendWhatsAppTemplate(op.phone, process.env.PANGAEA_DOC_EXPIRING_SID!, {
              '1': op.first_name,
              '2': docLabel,
              '3': mediumTermDoc.expiry_date!,
            }).catch((e) => result.errors.push(`WA failed for ${op.first_name}: ${e.message}`))
          }
        }
      }
    }
  }

  // ── Batch block on operative-level rtw_expiry / cscs_expiry fields ────────
  // Use batch updates instead of per-operative loops to avoid timeout at scale
  const { data: expiredRtw } = await supabase
    .from('operatives')
    .select('id')
    .eq('organization_id', orgId)
    .not('rtw_expiry', 'is', null)
    .lt('rtw_expiry', today)
    .neq('status', 'blocked')

  if (expiredRtw?.length) {
    const rtwIds = expiredRtw.map(op => op.id)
    const { error: rtwErr, count: rtwCount } = await supabase.from('operatives').update({
      status: 'blocked',
      compliance_alert: 'expired_document',
      blocked_reason: 'Auto-blocked: Right to Work expired',
      blocked_at: new Date().toISOString(),
    }).in('id', rtwIds)
    if (rtwErr) result.errors.push(`RTW batch block failed: ${rtwErr.message}`)
    else result.blocked += rtwCount ?? rtwIds.length
  }

  const { data: expiredCscs } = await supabase
    .from('operatives')
    .select('id')
    .eq('organization_id', orgId)
    .not('cscs_card_type', 'is', null)
    .not('cscs_expiry', 'is', null)
    .lt('cscs_expiry', today)
    .neq('status', 'blocked')

  if (expiredCscs?.length) {
    const cscsIds = expiredCscs.map(op => op.id)
    const { error: cscsErr, count: cscsCount } = await supabase.from('operatives').update({
      status: 'blocked',
      compliance_alert: 'expired_document',
      blocked_reason: 'Auto-blocked: CSCS card expired',
      blocked_at: new Date().toISOString(),
    }).in('id', cscsIds)
    if (cscsErr) result.errors.push(`CSCS batch block failed: ${cscsErr.message}`)
    else result.blocked += cscsCount ?? cscsIds.length
  }

  return NextResponse.json({ ok: true, ...result, ran_at: new Date().toISOString() })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysFromToday(n: number): string {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()
}
