import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import {
  ShieldCheck, ShieldAlert, ShieldX,
  AlertTriangle, CheckCircle2, XCircle, Download, HardHat, Clock, Star,
} from 'lucide-react'
import { getCanExport } from '@/lib/export/check-export'

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

function expiryBadge(days: number) {
  if (days < 0)   return { label: 'Expired',    cls: 'bg-red-900/40 text-red-400 border border-red-800' }
  if (days <= 7)  return { label: `${days}d`,   cls: 'bg-red-900/40 text-red-400 border border-red-800' }
  if (days <= 30) return { label: `${days}d`,   cls: 'bg-orange-900/40 text-orange-400 border border-orange-800' }
  if (days <= 60) return { label: `${days}d`,   cls: 'bg-yellow-900/40 text-yellow-400 border border-yellow-800' }
  return { label: `${days}d`, cls: 'bg-card text-muted-foreground border border-border' }
}

const NO_EXPIRY_TYPES = new Set(['british_citizen', 'irish_citizen', 'british_passport', 'irish_passport'])

const CSCS_COLOURS: Record<string, string> = {
  green: 'bg-forest-900/50 text-forest-400 border-forest-800',
  blue:  'bg-sky-900/50 text-sky-400 border-sky-800',
  gold:  'bg-amber-900/50 text-amber-400 border-amber-800',
  black: 'bg-[#444444]/50 text-muted-foreground border-border',
  red:   'bg-red-900/50 text-red-400 border-red-800',
  white: 'bg-card text-muted-foreground border-border',
}

const DOC_LABELS: Record<string, string> = {
  photo_id: 'Photo ID', cscs_card: 'CSCS Card',
  right_to_work: 'Right to Work', cv: 'CV', other: 'Other',
}

const STATUS_LABELS: Record<string, string> = {
  prospect: 'Prospect', qualifying: 'Qualifying', pending_docs: 'Pending Docs',
  verified: 'Verified', available: 'Available', working: 'Working',
  unavailable: 'Unavailable', blocked: 'Blocked',
}

const STATUS_COLOURS: Record<string, string> = {
  available: 'text-forest-400', working: 'text-blue-400', blocked: 'text-red-400',
  verified: 'text-muted-foreground', unavailable: 'text-muted-foreground',
  qualifying: 'text-yellow-400', pending_docs: 'text-orange-400', prospect: 'text-muted-foreground',
}

export default async function ReportsPage() {
  const supabase = createServiceClient()
  const canExport = await getCanExport()

  const today = new Date().toISOString().slice(0, 10)
  const in90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)

  // WTD: current week start (Monday)
  const monday = new Date()
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const weekStart4 = new Date(monday.getTime() - 3 * 7 * 86_400_000).toISOString().slice(0, 10)
  const currentWeekStart = monday.toISOString().slice(0, 10)
  const fourWeeksAgo = new Date(Date.now() - 28 * 86_400_000).toISOString()

  const [
    { data: operatives },
    { data: expiringDocs },
    { data: allocations },
    { data: wtdTimesheets },
    { data: wtdFlaggedShifts },
    { data: ncrs },
    { data: reviews },
  ] = await Promise.all([
    supabase
      .from('operatives')
      .select(`
        id, first_name, last_name, status, reemploy_status,
        trade_category:trade_categories!operatives_trade_category_id_fkey(name),
        engagement_method,
        rtw_verified, rtw_type, rtw_expiry, rtw_share_code, gov_rtw_checked,
        compliance_alert, blocked_reason,
        cscs_card_type, cscs_expiry
      `)
      .eq('organization_id', ORG_ID)
      .neq('status', 'prospect')
      .order('last_name'),

    supabase
      .from('documents')
      .select(`
        id, document_type, expiry_date, status, file_name,
        operative:operatives!documents_operative_id_fkey(id, first_name, last_name)
      `)
      .eq('organization_id', ORG_ID)
      .eq('status', 'verified')
      .not('expiry_date', 'is', null)
      .lte('expiry_date', in90)
      .order('expiry_date', { ascending: true }),

    supabase
      .from('allocations')
      .select(`
        id, status, start_date, end_date, agreed_day_rate, created_at,
        operative:operatives!allocations_operative_id_fkey(id, first_name, last_name),
        site:sites!allocations_site_id_fkey(name),
        labour_request:labour_requests!allocations_labour_request_id_fkey(
          trade_category:trade_categories!labour_requests_trade_category_id_fkey(name)
        )
      `)
      .eq('organization_id', ORG_ID)
      .order('start_date', { ascending: false })
      .limit(200),

    // WTD: timesheets for last 4 weeks
    supabase
      .from('timesheets')
      .select(`
        id, week_start, total_hours, overtime_hours, operative_id,
        operative:operatives!timesheets_operative_id_fkey(id, first_name, last_name)
      `)
      .eq('organization_id', ORG_ID)
      .gte('week_start', weekStart4)
      .order('week_start', { ascending: false })
      .limit(500),

    // WTD: shifts with any flag set in last 28 days
    supabase
      .from('shifts')
      .select(`
        id, scheduled_start, scheduled_end, wtd_hours_flag, wtd_overnight_flag, break_compliance_flag,
        operative:operatives!shifts_operative_id_fkey(id, first_name, last_name)
      `)
      .eq('organization_id', ORG_ID)
      .gte('scheduled_start', fourWeeksAgo)
      .or('wtd_hours_flag.eq.true,wtd_overnight_flag.eq.true,break_compliance_flag.eq.true')
      .order('scheduled_start', { ascending: false })
      .limit(100),

    supabase
      .from('non_conformance_incidents')
      .select(`
        id, reference_number, incident_type, severity, incident_date, resolved,
        operative:operatives!non_conformance_incidents_operative_id_fkey(id, first_name, last_name),
        site:sites!non_conformance_incidents_site_id_fkey(name)
      `)
      .eq('organization_id', ORG_ID)
      .order('incident_date', { ascending: false })
      .limit(200),

    supabase
      .from('performance_reviews')
      .select(`
        id, attitude_score, performance_score, reliability_score, rap_average, traffic_light,
        created_at,
        operative:operatives!performance_reviews_operative_id_fkey(id, first_name, last_name)
      `)
      .eq('organization_id', ORG_ID)
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const ops = operatives ?? []
  const docs = expiringDocs ?? []
  const allocs = allocations ?? []
  const wtdSheets = wtdTimesheets ?? []
  const wtdShifts = wtdFlaggedShifts ?? []
  const ncrList = ncrs ?? []
  const reviewList = reviews ?? []

  // WTD: current week hours per operative
  const currentWeekSheets = wtdSheets.filter((s) => s.week_start === currentWeekStart)
  const wtdOver48 = currentWeekSheets.filter((s) => (s.total_hours ?? 0) > 48)
  const wtdWarn = currentWeekSheets.filter((s) => { const h = s.total_hours ?? 0; return h >= 40 && h <= 48 })
  const wtdOk = currentWeekSheets.filter((s) => (s.total_hours ?? 0) < 40)

  // ── Compliance summary ───────────────────────────────────────────────────────
  const blockedOps    = ops.filter((o) => o.status === 'blocked')
  const expiringSoon  = ops.filter((o) => o.compliance_alert === 'expiring_soon')
  const clearOps      = ops.filter((o) => !o.compliance_alert && o.status !== 'blocked')

  // ── RTW stats ───────────────────────────────────────────────────────────────
  const rtwVerified   = ops.filter((o) => o.rtw_verified)
  const rtwUnverified = ops.filter((o) => !o.rtw_verified)
  const rtwTimeLimited = ops.filter((o) => o.rtw_expiry)
  const rtwExpiring30 = ops.filter((o) => {
    if (!o.rtw_expiry) return false
    const d = daysUntil(o.rtw_expiry)
    return d >= 0 && d <= 30
  })
  const rtwNeedsAction = ops.filter((o) => {
    if (!o.rtw_verified) return true
    if (o.rtw_expiry && daysUntil(o.rtw_expiry) <= 30) return true
    return false
  })
  const rtwPct = ops.length ? Math.round((rtwVerified.length / ops.length) * 100) : 0

  // ── CSCS stats ───────────────────────────────────────────────────────────────
  const cscsHave    = ops.filter((o) => o.cscs_card_type)
  const cscsMissing = ops.filter((o) => !o.cscs_card_type)
  const cscsExpiring = ops.filter((o) => {
    if (!o.cscs_expiry) return false
    const d = daysUntil(o.cscs_expiry)
    return d >= 0 && d <= 90
  })
  const cscsExpired = ops.filter((o) => o.cscs_expiry && daysUntil(o.cscs_expiry) < 0)
  const cscsPct = ops.length ? Math.round((cscsHave.length / ops.length) * 100) : 0
  const cscsNeedsAction = [...cscsMissing, ...cscsExpired,
    ...ops.filter((o) => o.cscs_expiry && daysUntil(o.cscs_expiry) <= 30 && daysUntil(o.cscs_expiry) >= 0)]
  const cscsNeedsActionIds = new Set(cscsNeedsAction.map((o) => o.id))

  const cardTypeCounts = ops.reduce<Record<string, number>>((acc, o) => {
    const t = o.cscs_card_type ?? 'none'
    acc[t] = (acc[t] ?? 0) + 1
    return acc
  }, {})

  // ── Status breakdown ─────────────────────────────────────────────────────────
  const statusCounts = ops.reduce<Record<string, number>>((acc, o) => {
    const s = o.status ?? 'unknown'
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})

  void today // used implicitly via daysUntil

  // ── NCR stats ────────────────────────────────────────────────────────────────
  const ncrUnresolved = ncrList.filter((n) => !n.resolved)
  const ncrByType = ncrList.reduce<Record<string, number>>((acc, n) => {
    acc[n.incident_type] = (acc[n.incident_type] ?? 0) + 1
    return acc
  }, {})
  const ncrBySeverity = ncrList.reduce<Record<string, number>>((acc, n) => {
    acc[n.severity] = (acc[n.severity] ?? 0) + 1
    return acc
  }, {})

  // ── RAP stats ────────────────────────────────────────────────────────────────
  const rapByOp = reviewList.reduce<Record<string, { name: string; opId: string; scores: number[]; latest: string | null }>>((acc, r) => {
    const op = r.operative as { id: string; first_name: string; last_name: string } | null
    if (!op) return acc
    if (!acc[op.id]) acc[op.id] = { name: `${op.first_name} ${op.last_name}`, opId: op.id, scores: [], latest: null }
    if (r.rap_average != null) acc[op.id].scores.push(Number(r.rap_average))
    if (!acc[op.id].latest) acc[op.id].latest = r.created_at
    return acc
  }, {})
  const rapRows = Object.values(rapByOp).map((r) => ({
    ...r,
    avg: r.scores.length ? r.scores.reduce((a, b) => a + b, 0) / r.scores.length : null,
    count: r.scores.length,
  })).sort((a, b) => (a.avg ?? 999) - (b.avg ?? 999))
  const rapTrafficCounts = reviewList.reduce<Record<string, number>>((acc, r) => {
    const tl = r.traffic_light ?? 'unknown'
    acc[tl] = (acc[tl] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="px-4 pt-2 pb-4 space-y-4">
      <PageHeader
        title="Reports"
        description="Compliance, workforce and audit reports for ISO review"
      />

      {/* ── 1. COMPLIANCE SUMMARY ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Compliance Summary</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-red-900/60 bg-red-950/20 p-4 flex items-start gap-3">
            <ShieldX className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-2xl font-bold text-red-400">{blockedOps.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Operatives blocked</p>
            </div>
          </div>
          <div className="rounded-xl border border-orange-900/60 bg-orange-950/20 p-4 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-2xl font-bold text-orange-400">{expiringSoon.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Expiring within 7 days</p>
            </div>
          </div>
          <div className="rounded-xl border border-forest-900/60 bg-forest-950/20 p-4 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-forest-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-2xl font-bold text-forest-400">{clearOps.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">All docs clear</p>
            </div>
          </div>
        </div>

        {blockedOps.length > 0 && (
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <div className="px-4 py-2.5 bg-background/80 border-b border-border/60">
              <p className="text-xs font-medium text-red-400 uppercase tracking-wide">Blocked operatives</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Operative</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Reason</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Reemploy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {blockedOps.map((op) => (
                  <tr key={op.id} className="hover:bg-background/40">
                    <td className="px-4 py-2.5">
                      <Link href={`/operatives/${op.id}`} className="text-forest-400 hover:underline font-medium">
                        {op.first_name} {op.last_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{op.blocked_reason ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs">
                      {op.reemploy_status === 'do_not_rehire'
                        ? <span className="text-red-400">Do not rehire</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── 2. EXPIRING DOCUMENTS ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Expiring Documents
          <span className="ml-2 font-normal text-muted-foreground normal-case">(next 90 days)</span>
        </h2>
        {docs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            No documents expiring in the next 90 days
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-background/60">
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Operative</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Document</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Expires</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {docs.map((doc) => {
                  const op = doc.operative as { id: string; first_name: string; last_name: string } | null
                  const days = doc.expiry_date ? daysUntil(doc.expiry_date) : 0
                  const badge = expiryBadge(days)
                  return (
                    <tr key={doc.id} className="hover:bg-background/40">
                      <td className="px-4 py-2.5">
                        {op
                          ? <Link href={`/operatives/${op.id}`} className="text-forest-400 hover:underline font-medium">{op.first_name} {op.last_name}</Link>
                          : <span className="text-muted-foreground">Unknown</span>}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{DOC_LABELS[doc.document_type] ?? doc.document_type}</td>
                      <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                        {doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── 3. RIGHT TO WORK ──────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Right to Work</h2>

        {/* RTW stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-xl border border-border/50 bg-card/40 p-3">
            <p className="text-2xl font-bold text-forest-400 tabular-nums">{rtwVerified.length}<span className="text-sm font-normal text-muted-foreground ml-1">/ {ops.length}</span></p>
            <p className="text-xs text-muted-foreground mt-0.5">Verified ({rtwPct}%)</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/40 p-3">
            <p className={`text-2xl font-bold tabular-nums ${rtwUnverified.length > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>{rtwUnverified.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Not verified</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/40 p-3">
            <p className="text-2xl font-bold text-sky-400 tabular-nums">{rtwTimeLimited.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Time-limited</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/40 p-3">
            <p className={`text-2xl font-bold tabular-nums ${rtwExpiring30.length > 0 ? 'text-orange-400' : 'text-muted-foreground'}`}>{rtwExpiring30.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Expiring ≤30 days</p>
          </div>
        </div>

        {/* RTW table — needs attention only */}
        {rtwNeedsAction.length === 0 ? (
          <div className="rounded-xl border border-forest-900/40 bg-forest-950/10 py-6 text-center text-sm text-forest-500 flex items-center justify-center gap-2">
            <ShieldCheck className="h-4 w-4" /> All operatives RTW compliant
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <div className="px-4 py-2.5 bg-background/60 border-b border-border/60 flex items-center justify-between">
              <p className="text-xs font-medium text-orange-400 uppercase tracking-wide">Requires attention ({rtwNeedsAction.length})</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-background/40">
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Operative</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">RTW Type</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Verified</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Expiry</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">GOV.UK Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rtwNeedsAction.map((op) => {
                  const rtwDays = op.rtw_expiry ? daysUntil(op.rtw_expiry) : null
                  const rtwBadge = rtwDays != null ? expiryBadge(rtwDays) : null
                  const isIndefinite = op.rtw_verified && !op.rtw_expiry
                  return (
                    <tr key={op.id} className="hover:bg-background/40">
                      <td className="px-4 py-2.5">
                        <Link href={`/operatives/${op.id}`} className="text-forest-400 hover:underline font-medium">
                          {op.first_name} {op.last_name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs capitalize">
                        {op.rtw_type?.replace(/_/g, ' ') ?? <span className="text-red-400">Not set</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {op.rtw_verified
                          ? <CheckCircle2 className="h-4 w-4 text-forest-400" />
                          : <XCircle className="h-4 w-4 text-red-400" />}
                      </td>
                      <td className="px-4 py-2.5">
                        {isIndefinite
                          ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-forest-900/40 text-forest-400 border border-forest-800">Indefinite</span>
                          : op.rtw_expiry
                            ? <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${rtwBadge?.cls}`}>
                                {new Date(op.rtw_expiry).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                              </span>
                            : <span className="text-red-400 text-xs">No expiry set</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {op.gov_rtw_checked
                          ? <CheckCircle2 className="h-4 w-4 text-forest-400" />
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── 4. CSCS COMPLIANCE ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <HardHat className="h-4 w-4 text-amber-400" /> CSCS Compliance
        </h2>

        {/* CSCS summary stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-xl border border-border/50 bg-card/40 p-3">
            <p className="text-2xl font-bold text-forest-400 tabular-nums">{cscsHave.length}<span className="text-sm font-normal text-muted-foreground ml-1">/ {ops.length}</span></p>
            <p className="text-xs text-muted-foreground mt-0.5">Hold CSCS ({cscsPct}%)</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/40 p-3">
            <p className={`text-2xl font-bold tabular-nums ${cscsMissing.length > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>{cscsMissing.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">No card recorded</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/40 p-3">
            <p className={`text-2xl font-bold tabular-nums ${cscsExpiring.length > 0 ? 'text-orange-400' : 'text-muted-foreground'}`}>{cscsExpiring.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Expiring ≤90 days</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/40 p-3">
            <p className={`text-2xl font-bold tabular-nums ${cscsExpired.length > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>{cscsExpired.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Expired</p>
          </div>
        </div>

        {/* Card type breakdown */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(cardTypeCounts).filter(([k]) => k !== 'none').map(([type, count]) => (
            <span key={type} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${CSCS_COLOURS[type] ?? 'bg-card text-muted-foreground border-border'}`}>
              {type.charAt(0).toUpperCase() + type.slice(1)} card <span className="font-bold">{count}</span>
            </span>
          ))}
          {(cardTypeCounts['none'] ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border bg-card/60 text-muted-foreground border-border">
              None <span className="font-bold">{cardTypeCounts['none']}</span>
            </span>
          )}
        </div>

        {/* CSCS needs attention */}
        {cscsNeedsAction.length === 0 ? (
          <div className="rounded-xl border border-forest-900/40 bg-forest-950/10 py-6 text-center text-sm text-forest-500 flex items-center justify-center gap-2">
            <ShieldCheck className="h-4 w-4" /> All CSCS cards recorded and valid
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <div className="px-4 py-2.5 bg-background/60 border-b border-border/60">
              <p className="text-xs font-medium text-orange-400 uppercase tracking-wide">Requires attention ({cscsNeedsAction.length})</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-background/40">
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Operative</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Card Type</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Expiry</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cscsNeedsAction.map((op) => {
                  const days = op.cscs_expiry ? daysUntil(op.cscs_expiry) : null
                  const badge = days != null ? expiryBadge(days) : null
                  return (
                    <tr key={op.id} className="hover:bg-background/40">
                      <td className="px-4 py-2.5">
                        <Link href={`/operatives/${op.id}`} className="text-forest-400 hover:underline font-medium">
                          {op.first_name} {op.last_name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        {op.cscs_card_type
                          ? <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${CSCS_COLOURS[op.cscs_card_type] ?? 'bg-card text-muted-foreground border-border'}`}>
                              {op.cscs_card_type.charAt(0).toUpperCase() + op.cscs_card_type.slice(1)}
                            </span>
                          : <span className="text-red-400 text-xs">Not recorded</span>}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs tabular-nums">
                        {op.cscs_expiry
                          ? new Date(op.cscs_expiry).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {badge
                          ? <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── 5. WORKING TIME DIRECTIVE ─────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Clock className="h-4 w-4 text-sky-400" /> Working Time Directive
          <span className="font-normal text-muted-foreground normal-case">({currentWeekStart} week)</span>
        </h2>

        {/* WTD summary stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-xl border border-border/50 bg-card/40 p-3">
            <p className="text-2xl font-bold text-muted-foreground tabular-nums">{currentWeekSheets.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Timesheets this week</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/40 p-3">
            <p className={`text-2xl font-bold tabular-nums ${wtdOver48.length > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>{wtdOver48.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Over 48h this week</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/40 p-3">
            <p className={`text-2xl font-bold tabular-nums ${wtdWarn.length > 0 ? 'text-amber-400' : 'text-muted-foreground'}`}>{wtdWarn.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">40–48h (approaching)</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/40 p-3">
            <p className={`text-2xl font-bold tabular-nums ${wtdShifts.length > 0 ? 'text-orange-400' : 'text-muted-foreground'}`}>{wtdShifts.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Shift violations (28d)</p>
          </div>
        </div>

        {/* Current week hours table */}
        {currentWeekSheets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
            No timesheets submitted for current week
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <div className="px-4 py-2.5 bg-background/60 border-b border-border/60">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Weekly hours — current week</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-background/40">
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Operative</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Hours</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs w-48">Progress</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {currentWeekSheets.sort((a, b) => (b.total_hours ?? 0) - (a.total_hours ?? 0)).map((sheet) => {
                  const op = sheet.operative as { id: string; first_name: string; last_name: string } | null
                  const hours = sheet.total_hours ?? 0
                  const pct = Math.min(100, (hours / 48) * 100)
                  const barCls = hours > 48 ? 'bg-red-500' : hours >= 40 ? 'bg-amber-500' : 'bg-forest-500'
                  const statusCls = hours > 48 ? 'text-red-400' : hours >= 40 ? 'text-amber-400' : 'text-forest-400'
                  const statusLabel = hours > 48 ? 'Over limit' : hours >= 40 ? 'Approaching' : 'OK'
                  return (
                    <tr key={sheet.id} className="hover:bg-background/40">
                      <td className="px-4 py-2.5">
                        {op
                          ? <Link href={`/operatives/${op.id}`} className="text-forest-400 hover:underline font-medium">{op.first_name} {op.last_name}</Link>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums font-medium text-muted-foreground">
                        {hours.toFixed(1)}h
                        {sheet.overtime_hours ? <span className="text-muted-foreground text-xs ml-1">({sheet.overtime_hours.toFixed(1)} OT)</span> : null}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="h-1.5 w-full rounded-full bg-[#444444] overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${barCls}`} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">{pct.toFixed(0)}% of 48h</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-medium ${statusCls}`}>{statusLabel}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Shift-level violations */}
        {wtdShifts.length > 0 && (
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <div className="px-4 py-2.5 bg-background/60 border-b border-border/60">
              <p className="text-xs font-medium text-orange-400 uppercase tracking-wide">Shift violations — last 28 days</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-background/40">
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Operative</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Shift</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Violations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {wtdShifts.map((shift) => {
                  const op = shift.operative as { id: string; first_name: string; last_name: string } | null
                  const flags = [
                    shift.wtd_hours_flag && 'Shift >10h',
                    shift.wtd_overnight_flag && '<11h rest',
                    shift.break_compliance_flag && 'Break <20min',
                  ].filter(Boolean)
                  return (
                    <tr key={shift.id} className="hover:bg-background/40">
                      <td className="px-4 py-2.5">
                        {op
                          ? <Link href={`/operatives/${op.id}`} className="text-forest-400 hover:underline font-medium">{op.first_name} {op.last_name}</Link>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs tabular-nums">
                        {new Date(shift.scheduled_start).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {' '}{new Date(shift.scheduled_start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        {' → '}{new Date(shift.scheduled_end).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {flags.map((f) => (
                            <span key={f as string} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-900/40 text-orange-400 border border-orange-800">
                              {f}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── 6. WORKFORCE STATUS ───────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Workforce Status
          <span className="ml-2 font-normal text-muted-foreground normal-case">({ops.length} operatives)</span>
        </h2>
        <div className="grid grid-cols-4 gap-3">
          {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
            <div key={status} className="rounded-xl border border-border/50 bg-card/40 p-4">
              <p className={`text-2xl font-bold tabular-nums ${STATUS_COLOURS[status] ?? 'text-muted-foreground'}`}>{count}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{STATUS_LABELS[status] ?? status}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-background/60">
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Operative</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Status</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Trade</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Engagement</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ops.map((op) => {
                const trade = op.trade_category as { name: string } | null
                return (
                  <tr key={op.id} className="hover:bg-background/40">
                    <td className="px-4 py-2.5">
                      <Link href={`/operatives/${op.id}`} className="text-forest-400 hover:underline font-medium">
                        {op.first_name} {op.last_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-medium ${STATUS_COLOURS[op.status ?? ''] ?? 'text-muted-foreground'}`}>
                        {STATUS_LABELS[op.status ?? ''] ?? op.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{trade?.name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs capitalize">
                      {op.engagement_method?.replace(/_/g, ' ') ?? '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {op.compliance_alert === 'expired_document' && <span className="text-xs text-red-400">Expired doc</span>}
                      {op.compliance_alert === 'expiring_soon' && <span className="text-xs text-orange-400">Expiring soon</span>}
                      {!op.compliance_alert && <span className="text-xs text-forest-400">Clear</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── NCR SUMMARY ───────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-400" /> Non-Conformance Incidents
          <span className="font-normal text-muted-foreground normal-case">({ncrList.length} total)</span>
        </h2>
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-xl border border-border/50 bg-card/40 p-3">
            <p className="text-2xl font-bold text-muted-foreground tabular-nums">{ncrList.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total NCRs</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/40 p-3">
            <p className={`text-2xl font-bold tabular-nums ${ncrUnresolved.length > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>{ncrUnresolved.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Unresolved</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/40 p-3">
            <p className={`text-2xl font-bold tabular-nums ${(ncrBySeverity['critical'] ?? 0) > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>{ncrBySeverity['critical'] ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Critical severity</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/40 p-3">
            <p className="text-2xl font-bold text-muted-foreground tabular-nums">{ncrList.length - ncrUnresolved.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Resolved</p>
          </div>
        </div>

        {/* Type breakdown */}
        {Object.keys(ncrByType).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(ncrByType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <span key={type} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border bg-card/60 text-muted-foreground border-border">
                {type.replace(/_/g, ' ')} <span className="font-bold text-muted-foreground">{count}</span>
              </span>
            ))}
          </div>
        )}

        {/* Unresolved table */}
        {ncrUnresolved.length > 0 && (
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <div className="px-4 py-2.5 bg-background/60 border-b border-border/60">
              <p className="text-xs font-medium text-red-400 uppercase tracking-wide">Unresolved ({ncrUnresolved.length})</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-background/40">
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Ref</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Operative</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Site</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Type</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Severity</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ncrUnresolved.map((n) => {
                  const op = n.operative as { id: string; first_name: string; last_name: string } | null
                  const site = n.site as { name: string } | null
                  const sevCls = n.severity === 'critical' ? 'text-red-400' : n.severity === 'major' ? 'text-orange-400' : 'text-yellow-400'
                  return (
                    <tr key={n.id} className="hover:bg-background/40">
                      <td className="px-4 py-2.5 text-muted-foreground text-xs tabular-nums">{n.reference_number ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        {op
                          ? <Link href={`/operatives/${op.id}`} className="text-forest-400 hover:underline font-medium">{op.first_name} {op.last_name}</Link>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{site?.name ?? '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs capitalize">{n.incident_type.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-2.5"><span className={`text-xs font-medium capitalize ${sevCls}`}>{n.severity}</span></td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs tabular-nums">
                        {new Date(n.incident_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── RAP PERFORMANCE ───────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-400" /> RAP Performance
          <span className="font-normal text-muted-foreground normal-case">({reviewList.length} reviews)</span>
        </h2>
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-xl border border-border/50 bg-card/40 p-3">
            <p className="text-2xl font-bold text-muted-foreground tabular-nums">{reviewList.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total reviews</p>
          </div>
          <div className="rounded-xl border border-forest-900/60 bg-forest-950/20 p-3">
            <p className="text-2xl font-bold text-forest-400 tabular-nums">{rapTrafficCounts['green'] ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Green</p>
          </div>
          <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-3">
            <p className="text-2xl font-bold text-amber-400 tabular-nums">{rapTrafficCounts['amber'] ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Amber</p>
          </div>
          <div className="rounded-xl border border-red-900/60 bg-red-950/20 p-3">
            <p className="text-2xl font-bold text-red-400 tabular-nums">{rapTrafficCounts['red'] ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Red</p>
          </div>
        </div>

        {rapRows.length > 0 && (
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <div className="px-4 py-2.5 bg-background/60 border-b border-border/60">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Average scores per operative (lowest first)</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-background/40">
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Operative</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Reviews</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs w-48">Avg Score</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Last Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rapRows.map((r) => {
                  const avg = r.avg
                  const pct = avg != null ? Math.min(100, (avg / 5) * 100) : null
                  const barCls = avg == null ? 'bg-[#444444]' : avg < 2.5 ? 'bg-red-500' : avg < 3.5 ? 'bg-amber-500' : 'bg-forest-500'
                  const scoreCls = avg == null ? 'text-muted-foreground' : avg < 2.5 ? 'text-red-400' : avg < 3.5 ? 'text-amber-400' : 'text-forest-400'
                  return (
                    <tr key={r.opId} className="hover:bg-background/40">
                      <td className="px-4 py-2.5">
                        <Link href={`/operatives/${r.opId}`} className="text-forest-400 hover:underline font-medium">{r.name}</Link>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground tabular-nums text-xs">{r.count}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 rounded-full bg-[#444444] overflow-hidden">
                            <div className={`h-full rounded-full ${barCls}`} style={{ width: `${pct ?? 0}%` }} />
                          </div>
                          <span className={`text-xs font-medium tabular-nums ${scoreCls}`}>
                            {avg != null ? avg.toFixed(1) : '—'} / 5
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs tabular-nums">
                        {r.latest ? new Date(r.latest).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── 6. ALLOCATION HISTORY ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Allocation History
            <span className="ml-2 font-normal text-muted-foreground normal-case">(last 200)</span>
          </h2>
          {canExport && (
            <a href="/api/reports/allocations-csv" className="flex items-center gap-1.5 text-xs text-forest-400 hover:text-forest-300 transition-colors">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </a>
          )}
        </div>
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-background/60">
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Operative</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Site</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Trade</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Start</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">End</th>
                <th className="text-right px-4 py-2.5 text-muted-foreground font-medium text-xs">Rate</th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium text-xs">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allocs.map((al) => {
                const op = al.operative as { id: string; first_name: string; last_name: string } | null
                const site = al.site as { name: string } | null
                const lr = al.labour_request as { trade_category: { name: string } | null } | null
                return (
                  <tr key={al.id} className="hover:bg-background/40">
                    <td className="px-4 py-2.5">
                      {op
                        ? <Link href={`/operatives/${op.id}`} className="text-forest-400 hover:underline font-medium">{op.first_name} {op.last_name}</Link>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{site?.name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{lr?.trade_category?.name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground tabular-nums text-xs">
                      {al.start_date ? new Date(al.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground tabular-nums text-xs">
                      {al.end_date ? new Date(al.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : <span className="text-muted-foreground">Ongoing</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground text-xs">
                      {al.agreed_day_rate != null ? `£${Number(al.agreed_day_rate).toFixed(0)}` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs capitalize text-muted-foreground">
                      {al.status?.replace(/_/g, ' ') ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
