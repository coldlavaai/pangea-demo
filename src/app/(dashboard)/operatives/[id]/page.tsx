import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import {
  ArrowLeft,
  Briefcase,
  FileText,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { EmptyState } from '@/components/empty-state'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'
import { RapAddReview } from '@/components/operatives/rap-add-review'
import type { OperativeCard } from '@/components/operatives/operative-cards-section'
import { OperativeInfoCards } from '@/components/operatives/operative-info-cards'
import { getUserRole } from '@/lib/auth/get-user-role'
import { DeleteOperativeButton } from '@/components/operatives/delete-operative-button'
import { StartOnboardingButton } from '@/components/operatives/start-onboarding-button'
import { RateActions } from '@/components/operatives/rate-actions'
import { CSCS_DOT_CLASS, CSCS_COLOUR_LABEL } from '@/lib/cscs-colours'
import { WorkHistorySection } from '@/components/operatives/work-history-section'
import { CommsTabClient } from '@/components/operatives/comms-tab-client'
import { QuickAssignAllocation } from '@/components/operatives/quick-assign-allocation'
import { TerminateAllocationButton } from '@/components/operatives/terminate-allocation-button'

const TZ = 'Europe/London'

type OperativeRow = Database['public']['Tables']['operatives']['Row'] & {
  trade_category: { name: string } | null
}
type DocumentRow = Database['public']['Tables']['documents']['Row']
type PayRateRow = Database['public']['Tables']['operative_pay_rates']['Row']
type AllocationRow = {
  id: string
  start_date: string
  end_date: string | null
  status: string | null
  agreed_day_rate: number | null
  site: { name: string } | null
}
type WorkHistoryRow = Database['public']['Tables']['work_history']['Row']
type NcrRow = {
  id: string
  reference_number: string | null
  incident_type: string
  severity: string
  incident_date: string
  resolved: boolean | null
  site: { name: string } | null
}
type ReviewRow = {
  id: string
  attitude_score: number
  performance_score: number
  reliability_score: number
  rap_average: number | null
  traffic_light: string | null
  comment: string | null
  site_manager_name: string | null
  created_at: string | null
  allocation: { id: string; site: { name: string } | null } | null
}
type MessageRow = {
  id: string
  body: string | null
  direction: string
  created_at: string | null
}
type ThreadRow = {
  id: string
  last_message: string | null
  last_message_at: string | null
  unread_count: number | null
}

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'documents', label: 'Documents' },
  { key: 'allocations', label: 'Allocations' },
  { key: 'rap', label: 'RAP' },
  { key: 'ncrs', label: 'NCRs' },
  { key: 'comms', label: 'Comms' },
]

const DOC_TYPE_LABELS: Record<string, string> = {
  right_to_work: 'Right to Work',
  photo_id: 'Photo ID',
  cscs_card: 'CSCS Card',
  cpcs_ticket: 'CPCS Ticket',
  npors_ticket: 'NPORS Ticket',
  lantra_cert: 'Lantra Certificate',
  first_aid: 'First Aid',
  asbestos_awareness: 'Asbestos Awareness',
  chainsaw_cs30: 'Chainsaw CS30',
  chainsaw_cs31: 'Chainsaw CS31',
  cv: 'CV',
  other: 'Other',
}

const NCR_TYPE_LABELS: Record<string, string> = {
  no_show: 'No Show',
  walk_off: 'Walk Off',
  late_arrival: 'Late Arrival',
  safety_breach: 'Safety Breach',
  drugs_alcohol: 'Drugs / Alcohol',
  conduct_issue: 'Conduct Issue',
  poor_attitude: 'Poor Attitude',
  poor_workmanship: 'Poor Workmanship',
  other: 'Other',
}

const CSCS_LABELS: Record<string, string> = {
  green: 'Green (Labourer)',
  blue: 'Blue (Skilled)',
  gold: 'Gold (Supervisor)',
  black: 'Black (Manager)',
  red: 'Red (Trainee)',
  white: 'White (Professional)',
}

const REEMPLOY_LABELS: Record<string, string> = {
  active: 'Active',
  caution: 'Caution',
  do_not_rehire: 'Do Not Rehire',
}

const REEMPLOY_COLOURS: Record<string, string> = {
  active: 'text-forest-400',
  caution: 'text-amber-400',
  do_not_rehire: 'text-red-400',
}


const ENGAGEMENT_LABELS: Record<string, string> = {
  self_employed:  'Self-Employed',
  cis_sole_trader: 'CIS Sole Trader',
  limited_company: 'Limited Company',
  agency:          'Agency',
  direct_paye:     'Direct PAYE',
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return format(toZonedTime(new Date(d), TZ), 'd MMM yyyy')
}

function fmtDateTime(d: string | null) {
  if (!d) return '—'
  return format(toZonedTime(new Date(d), TZ), 'd MMM yyyy, HH:mm')
}

export default async function OperativeProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab = 'overview' } = await searchParams
  const supabase = await createClient()
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!
  const userRole = await getUserRole()
  const canEditOperatives = ['super_admin', 'admin', 'director', 'labour_manager'].includes(userRole ?? '')

  // Core data — always needed for header/status strip
  const coreQueries = [
    supabase
      .from('operatives')
      .select(
        `*, trade_category:trade_categories!operatives_trade_category_id_fkey(name)`
      )
      .eq('id', id)
      .eq('organization_id', orgId)
      .single(),

    supabase
      .from('documents')
      .select('*')
      .eq('operative_id', id)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false }),

    supabase
      .from('operative_cards')
      .select('id, card_scheme, card_number, card_type, categories, expiry_date, scheme_name')
      .eq('operative_id', id)
      .eq('organization_id', orgId),
  ] as const

  // Tab-specific queries — only fetch what the active tab needs
  const needsAllocations = true // Always needed: EngagementStrip + tab badge counts
  const needsNcrs = tab === 'ncrs'
  const needsReviews = tab === 'rap'
  const needsComms = tab === 'comms'
  const needsPayRates = tab === 'overview'
  const needsWorkHistory = tab === 'overview'
  const needsSites = tab === 'allocations'

  const [
    { data: operative },
    { data: documents },
    { data: cards },
    allocationsResult,
    ncrsResult,
    reviewsResult,
    threadResult,
    payRatesResult,
    workHistoryResult,
    sitesResult,
  ] = await Promise.all([
    ...coreQueries,

    needsAllocations
      ? supabase
          .from('allocations')
          .select(
            `id, start_date, end_date, status, agreed_day_rate,
             site:sites!allocations_site_id_fkey(name)`
          )
          .eq('operative_id', id)
          .eq('organization_id', orgId)
          .order('start_date', { ascending: false })
      : Promise.resolve({ data: null }),

    needsNcrs
      ? supabase
          .from('non_conformance_incidents')
          .select(
            `id, reference_number, incident_type, severity, incident_date, resolved,
             site:sites!non_conformance_incidents_site_id_fkey(name)`
          )
          .eq('operative_id', id)
          .eq('organization_id', orgId)
          .order('incident_date', { ascending: false })
      : Promise.resolve({ data: null }),

    needsReviews
      ? supabase
          .from('performance_reviews')
          .select(
            `id, attitude_score, performance_score, reliability_score, safety_score, rap_average, traffic_light,
             comment, site_manager_name, created_at,
             allocation:allocations!performance_reviews_allocation_id_fkey(id, site:sites!allocations_site_id_fkey(name))`
          )
          .eq('operative_id', id)
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: null }),

    needsComms
      ? supabase
          .from('message_threads')
          .select('id, last_message, last_message_at, unread_count')
          .eq('operative_id', id)
          .eq('organization_id', orgId)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    needsPayRates
      ? supabase
          .from('operative_pay_rates')
          .select('*')
          .eq('operative_id', id)
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: null }),

    needsWorkHistory
      ? supabase
          .from('work_history')
          .select('*')
          .eq('operative_id', id)
          .eq('organization_id', orgId)
          .order('start_date', { ascending: false })
      : Promise.resolve({ data: null }),

    needsSites
      ? supabase
          .from('sites')
          .select('id, name')
          .eq('organization_id', orgId)
          .order('name')
      : Promise.resolve({ data: null }),
  ])

  const allocations = allocationsResult.data
  const ncrs = ncrsResult.data
  const reviews = reviewsResult.data
  const thread = threadResult.data as ThreadRow | null
  const payRates = payRatesResult.data
  const workHistory = workHistoryResult.data
  const sites = sitesResult.data

  if (!operative) notFound()

  let messages: MessageRow[] = []
  if (needsComms && thread?.id) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, body, direction, created_at')
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: false })
      .limit(50)
    messages = (msgs ?? []) as MessageRow[]
  }

  const op = operative as unknown as OperativeRow
  const docs = (documents ?? []) as DocumentRow[]
  const allocs = (allocations ?? []) as unknown as AllocationRow[]
  const ncrList = (ncrs ?? []) as unknown as NcrRow[]
  const reviewList = (reviews ?? []) as unknown as ReviewRow[]
  const cardList = (cards ?? []) as OperativeCard[]
  const payRateList = (payRates ?? []) as PayRateRow[]

  const activeTab = TABS.find((t) => t.key === tab)?.key ?? 'overview'

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title={`${op.first_name} ${op.last_name}${op.trading_name ? ` — ${op.trading_name}` : ''}`}
          description={op.reference_number ?? undefined}
        />
        <div className="flex items-center gap-2 shrink-0">
          <StartOnboardingButton
            operativeId={id}
            operativeName={`${op.first_name} ${op.last_name}`}
            hasPhone={!!op.phone}
            status={op.status ?? 'prospect'}
          />
          <DeleteOperativeButton
            operativeId={id}
            operativeName={`${op.first_name} ${op.last_name}`}
          />
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-border text-muted-foreground hover:bg-card"
          >
            <Link href={`/operatives/${id}/edit`}>Edit</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-border text-muted-foreground hover:bg-card"
          >
            <Link href="/operatives">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
        </div>
      </div>

      {/* Status strip */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-background px-5 py-3">
        <div className="flex items-center gap-2">
          {op.status ? <StatusBadge status={op.status} /> : '—'}
          {op.compliance_alert === 'expiring_soon' && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-400 border border-amber-800">
              Docs Expiring Soon
            </span>
          )}
          {op.compliance_alert === 'expired_document' && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 border border-red-800">
              Blocked — Expired Docs
            </span>
          )}
        </div>
        {op.cscs_card_type && CSCS_DOT_CLASS[op.cscs_card_type] && (
          <div className="flex items-center gap-1.5 text-sm">
            <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${CSCS_DOT_CLASS[op.cscs_card_type]}`} />
            <span className="text-muted-foreground">{CSCS_COLOUR_LABEL[op.cscs_card_type] ?? op.cscs_card_type} CSCS</span>
          </div>
        )}
        {op.nationality && (
          <span className="text-sm text-muted-foreground bg-card px-2 py-0.5 rounded">
            {op.nationality}
          </span>
        )}
        {op.preferred_language && op.preferred_language !== 'en' && (
          <span className="text-xs text-muted-foreground bg-card px-2 py-0.5 rounded uppercase">
            Lang: {op.preferred_language}
          </span>
        )}
        {op.rap_traffic_light && (
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${
                op.rap_traffic_light === 'green'
                  ? 'bg-forest-500'
                  : op.rap_traffic_light === 'amber'
                    ? 'bg-amber-500'
                    : 'bg-red-500'
              }`}
            />
            <span className="text-muted-foreground tabular-nums">
              RAP {op.avg_rap_score?.toFixed(1) ?? '—'}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{op.total_reviews ?? 0} reviews</span>
          </div>
        )}
        {op.reemploy_status && (
          <div className="text-sm">
            <span className="text-muted-foreground">Re-employ: </span>
            <span className={REEMPLOY_COLOURS[op.reemploy_status] ?? 'text-muted-foreground'}>
              {REEMPLOY_LABELS[op.reemploy_status] ?? op.reemploy_status}
            </span>
          </div>
        )}
        <div className="ml-auto text-sm text-muted-foreground">
          {op.total_jobs ?? 0} job{(op.total_jobs ?? 0) !== 1 ? 's' : ''} completed
        </div>
      </div>
      {op.blocked_reason && (
        <div className="flex items-center gap-2 rounded-lg border border-red-900/50 bg-red-950/30 px-5 py-2.5 text-sm text-red-400">
          <span className="font-medium">Block reason:</span>
          <span>{op.blocked_reason}</span>
        </div>
      )}

      {/* Engagement strip — always shown */}
      <EngagementStrip op={op} allocs={allocs} />

      {/* Data quality warning */}
      <DataQualityWarning op={op} operativeId={id} docs={docs} />

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => {
          const count =
            t.key === 'documents'
              ? docs.length
              : t.key === 'allocations'
                ? allocs.length
                : t.key === 'ncrs'
                  ? ncrList.length
                  : null
          const rapDot =
            t.key === 'rap' && op.avg_rap_score != null
              ? op.rap_traffic_light
              : null
          return (
            <Link
              key={t.key}
              href={`/operatives/${id}?tab=${t.key}`}
              className={cn(
                'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex items-center gap-1.5',
                activeTab === t.key
                  ? 'border-forest-500 text-forest-400'
                  : 'border-transparent text-muted-foreground hover:text-muted-foreground hover:border-border'
              )}
            >
              {t.label}
              {count !== null && count > 0 && (
                <span
                  className={cn(
                    'text-xs',
                    t.key === 'ncrs' ? 'text-red-400' : 'text-muted-foreground'
                  )}
                >
                  ({count})
                </span>
              )}
              {rapDot && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className={cn(
                    'inline-block h-2 w-2 rounded-full',
                    rapDot === 'green' ? 'bg-forest-500' : rapDot === 'amber' ? 'bg-amber-500' : 'bg-red-500'
                  )} />
                  {op.avg_rap_score!.toFixed(1)}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab op={op} cards={cardList} operativeId={id} payRates={payRateList} workHistory={(workHistory ?? []) as WorkHistoryRow[]} canEdit={canEditOperatives} />}
      {activeTab === 'documents' && (
        <DocumentsTab docs={docs} operativeId={id} />
      )}
      {activeTab === 'allocations' && (
        <AllocationsTab allocs={allocs} sites={sites ?? []} operativeId={id} />
      )}
      {activeTab === 'rap' && <RapTab op={op} reviews={reviewList} allocations={allocs} operativeId={id} />}
      {activeTab === 'ncrs' && <NcrsTab ncrs={ncrList} />}
      {activeTab === 'comms' && (
        <CommsTabClient messages={messages} thread={thread ?? null} />
      )}
    </div>
  )
}

// ── Data Quality ────────────────────────────────────────────────────────────────

function getDataQualityIssues(op: OperativeRow, docs: DocumentRow[]): string[] {
  const issues: string[] = []

  // Field checks
  if (!op.ni_number) issues.push('Missing NI number')
  if (!op.phone && !op.email) issues.push('No contact information — no phone or email on record')
  if (op.cscs_card_type && !op.cscs_expiry) issues.push('CSCS card type is set but no expiry date recorded')
  if (op.date_of_birth && op.date_of_birth < '1900-01-01') issues.push(`Date of birth appears invalid (${fmtDate(op.date_of_birth)})`)
  if (op.start_date && op.start_date < '1900-01-01') issues.push(`Start date appears invalid (${fmtDate(op.start_date)})`)
  if (op.cscs_expiry && op.cscs_expiry < '1900-01-01') issues.push(`CSCS expiry appears invalid (${fmtDate(op.cscs_expiry)})`)

  // Document checks — distinguish between missing, pending, and verified
  const verifiedDocTypes = new Set(
    docs.filter(d => d.status === 'verified').map(d => d.document_type)
  )
  const pendingDocTypes = new Set(
    docs.filter(d => d.status === 'pending').map(d => d.document_type)
  )

  if (!verifiedDocTypes.has('photo_id')) {
    if (pendingDocTypes.has('photo_id')) {
      issues.push('Photo ID uploaded — needs verifying')
    } else {
      issues.push('No photo ID on file (passport or driving licence)')
    }
  }
  if (!verifiedDocTypes.has('right_to_work')) {
    if (pendingDocTypes.has('right_to_work')) {
      issues.push('Right to Work document uploaded — needs verifying')
    } else {
      issues.push('No Right to Work document on file')
    }
  }
  if (op.cscs_card_type && !verifiedDocTypes.has('cscs_card')) {
    if (pendingDocTypes.has('cscs_card')) {
      issues.push('CSCS card uploaded — needs verifying')
    } else {
      issues.push('CSCS card type is set but no CSCS document uploaded')
    }
  }

  return issues
}

function DataQualityWarning({ op, operativeId, docs }: { op: OperativeRow; operativeId: string; docs: DocumentRow[] }) {
  const issues = getDataQualityIssues(op, docs)
  if (issues.length === 0) return null
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-800/60 bg-amber-950/30 px-5 py-3.5">
      <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-300 mb-1.5">
          {issues.length} data quality {issues.length === 1 ? 'issue' : 'issues'} — needs review
        </p>
        <ul className="space-y-1">
          {issues.map((issue, i) => (
            <li key={i} className="text-xs text-amber-400/80 flex items-center gap-1.5">
              <span className="inline-block h-1 w-1 rounded-full bg-amber-500 shrink-0" />
              {issue}
            </li>
          ))}
        </ul>
        <Link href={`/operatives/${operativeId}/edit`} className="inline-block mt-2 text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2">
          Edit profile to fix
        </Link>
      </div>
    </div>
  )
}

// ── Engagement Strip ───────────────────────────────────────────────────────────

function EngagementStrip({ op, allocs }: { op: OperativeRow; allocs: AllocationRow[] }) {
  // 13-week green light: MAX(end_date) + 91 days for agency operatives
  let greenLightDate: Date | null = null
  if (op.engagement_method === 'agency' && allocs.length > 0) {
    const latestEnd = allocs
      .map(a => a.end_date)
      .filter(Boolean)
      .sort()
      .at(-1)
    if (latestEnd) {
      greenLightDate = new Date(latestEnd)
      greenLightDate.setDate(greenLightDate.getDate() + 91)
    }
  }

  const today = new Date()
  const isGreen = greenLightDate ? greenLightDate <= today : false

  if (!op.engagement_method) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border border-dashed bg-card/30 px-5 py-3 text-sm text-muted-foreground">
        <span>Engagement method not set</span>
        <Link href={`/operatives/${op.id}/edit`} className="text-xs text-muted-foreground hover:text-muted-foreground underline underline-offset-2">
          Edit profile to set
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-card/50 px-5 py-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs uppercase tracking-wide font-medium">Engagement</span>
        <span className="text-muted-foreground font-medium">{ENGAGEMENT_LABELS[op.engagement_method] ?? op.engagement_method}</span>
      </div>
      {op.agency_name && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs uppercase tracking-wide font-medium">Agency</span>
          <span className="text-muted-foreground">{op.agency_name}</span>
        </div>
      )}
      {op.trading_name && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs uppercase tracking-wide font-medium">Trading As</span>
          <span className="text-muted-foreground">{op.trading_name}</span>
        </div>
      )}
      {op.utr_number && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs uppercase tracking-wide font-medium">UTR</span>
          <span className="font-mono text-muted-foreground">{op.utr_number}</span>
        </div>
      )}
      {greenLightDate && (
        <div className={`ml-auto flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border ${
          isGreen
            ? 'border-forest-700 bg-forest-950/40 text-forest-400'
            : 'border-amber-700 bg-amber-950/40 text-amber-400'
        }`}>
          <span className={`h-2 w-2 rounded-full ${isGreen ? 'bg-forest-400' : 'bg-amber-400'}`} />
          {isGreen
            ? 'Direct engagement: green light'
            : `Direct engagement after: ${fmtDate(greenLightDate.toISOString().slice(0, 10))}`
          }
        </div>
      )}
    </div>
  )
}

// ── Overview Tab ───────────────────────────────────────────────────────────────

function OverviewTab({ op, cards, operativeId, payRates, workHistory, canEdit }: { op: OperativeRow; cards: OperativeCard[]; operativeId: string; payRates: PayRateRow[]; workHistory: WorkHistoryRow[]; canEdit: boolean }) {
  const latestRate = payRates[0] ?? null
  return (
    <div className="space-y-3">
      {/* Pay Rate Card — shown when a rate exists */}
      {(op.day_rate != null || payRates.length > 0) && (
        <RateActions
          operativeId={operativeId}
          operativeName={`${op.first_name} ${op.last_name}`}
          dayRate={op.day_rate}
          hourlyRate={op.hourly_rate}
          grade={op.grade}
          rateStatus={op.rate_status as 'estimated' | 'confirmed' | null}
          latestQuartile={latestRate?.quartile ?? null}
          rateHistory={payRates}
        />
      )}
    {/* Editable info cards — client component with inline editing */}
    <OperativeInfoCards op={op as Record<string, unknown>} operativeId={operativeId} cards={cards} canEdit={canEdit} />

    {/* Work History */}
    <WorkHistorySection
      operativeId={operativeId}
      cvSummary={op.cv_summary ?? null}
      workHistory={workHistory}
    />
    </div>
  )
}

// ── Documents Tab ──────────────────────────────────────────────────────────────

function DocumentsTab({
  docs,
  operativeId,
}: {
  docs: DocumentRow[]
  operativeId: string
}) {
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {docs.length} document{docs.length !== 1 ? 's' : ''}
        </p>
        <Button
          asChild
          size="sm"
          className="bg-forest-600 hover:bg-forest-700"
        >
          <Link href={`/operatives/${operativeId}/documents/upload`}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Link>
        </Button>
      </div>

      {docs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description="Upload the operative's first document above."
        />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/80">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Type</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">File</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Expiry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {docs.map((doc) => {
                const expired = doc.expiry_date && doc.expiry_date < today
                return (
                  <tr key={doc.id} className="hover:bg-background/50">
                    <td className="px-4 py-3 text-muted-foreground">
                      <Link
                        href={`/operatives/${operativeId}/documents/${doc.id}`}
                        className="hover:underline text-forest-400"
                      >
                        {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {doc.file_name ? (
                        <Link
                          href={`/operatives/${operativeId}/documents/${doc.id}`}
                          className="text-muted-foreground hover:text-forest-400 hover:underline"
                        >
                          {doc.file_name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {doc.status ? <StatusBadge status={doc.status} /> : '—'}
                    </td>
                    <td
                      className={cn(
                        'px-4 py-3 tabular-nums',
                        expired ? 'text-red-400' : 'text-muted-foreground'
                      )}
                    >
                      {fmtDate(doc.expiry_date)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Allocations Tab ────────────────────────────────────────────────────────────

function AllocationsTab({
  allocs,
  sites,
  operativeId,
}: {
  allocs: AllocationRow[]
  sites: { id: string; name: string }[]
  operativeId: string
}) {
  return (
    <div className="space-y-4">
      <QuickAssignAllocation operativeId={operativeId} sites={sites} />
      {allocs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No allocations yet"
          description="This operative has not been allocated to any site."
        />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/80">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Site</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Start</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">End</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Rate</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allocs.map((a) => {
                const canTerminate = ['pending', 'confirmed', 'active'].includes(a.status ?? '')
                return (
                <tr key={a.id} className="hover:bg-background/50">
                  <td className="px-4 py-3 text-muted-foreground">
                    {a.site?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap">
                    {fmtDate(a.start_date)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap">
                    {fmtDate(a.end_date)}
                  </td>
                  <td className="px-4 py-3">
                    {a.status ? <StatusBadge status={a.status} /> : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">
                    {a.agreed_day_rate != null ? `£${a.agreed_day_rate}/d` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canTerminate && (
                      <TerminateAllocationButton
                        allocationId={a.id}
                        siteName={a.site?.name ?? 'this site'}
                      />
                    )}
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── RAP Tab ────────────────────────────────────────────────────────────────────

function RapTab({
  op,
  reviews,
  allocations,
  operativeId,
}: {
  op: OperativeRow
  reviews: ReviewRow[]
  allocations: AllocationRow[]
  operativeId: string
}) {
  const TL_DOT: Record<string, string> = {
    green: 'bg-forest-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  }
  const TL_RING: Record<string, string> = {
    green: 'bg-forest-900/60',
    amber: 'bg-amber-900/60',
    red: 'bg-red-900/60',
  }

  return (
    <div className="space-y-4">
      {/* Score card + Add Review button */}
      <div className="rounded-lg border border-border bg-background p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Current RAP Score
            </h3>
            {op.rap_traffic_light ? (
              <div className="flex items-center gap-4">
                <span className={cn('inline-flex h-10 w-10 rounded-full items-center justify-center', TL_RING[op.rap_traffic_light] ?? 'bg-card')}>
                  <span className={cn('h-4 w-4 rounded-full', TL_DOT[op.rap_traffic_light] ?? 'bg-muted')} />
                </span>
                <div>
                  <p className="text-3xl font-bold text-foreground tabular-nums">
                    {op.avg_rap_score?.toFixed(1) ?? '—'}
                    <span className="text-base text-muted-foreground ml-1">/ 5.0</span>
                    {op.avg_rap_score != null && (
                      <span className="text-base text-muted-foreground ml-3">({(op.avg_rap_score * 4).toFixed(0)}/20)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Based on {op.total_reviews ?? 0} review{(op.total_reviews ?? 0) !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No reviews yet.</p>
            )}
          </div>
          <RapAddReview operativeId={operativeId} operativeName={`${op.first_name} ${op.last_name}`} allocations={allocations} />
        </div>
      </div>

      {/* Review history */}
      {reviews.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-2.5 font-medium text-xs">Date</th>
                <th className="text-left px-4 py-2.5 font-medium text-xs">Allocation / Site</th>
                <th className="text-center px-3 py-2.5 font-medium text-xs">R</th>
                <th className="text-center px-3 py-2.5 font-medium text-xs">A</th>
                <th className="text-center px-3 py-2.5 font-medium text-xs">P</th>
                <th className="text-center px-3 py-2.5 font-medium text-xs">S</th>
                <th className="text-center px-3 py-2.5 font-medium text-xs">Avg</th>
                <th className="text-left px-4 py-2.5 font-medium text-xs">Notes</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB') : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {(r.allocation as { id: string; site: { name: string } | null } | null)?.site?.name ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums">{r.reliability_score}/5</td>
                  <td className="px-3 py-2.5 text-center tabular-nums">{r.attitude_score}/5</td>
                  <td className="px-3 py-2.5 text-center tabular-nums">{r.performance_score}/5</td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">{(r as Record<string, unknown>).safety_score != null ? `${(r as Record<string, unknown>).safety_score}/5` : '—'}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={cn(
                      'inline-flex items-center gap-1 text-xs font-semibold',
                      r.traffic_light === 'green' ? 'text-forest-400' : r.traffic_light === 'amber' ? 'text-amber-400' : 'text-red-400'
                    )}>
                      <span className={cn('h-2 w-2 rounded-full', TL_DOT[r.traffic_light ?? ''] ?? 'bg-muted')} />
                      {r.rap_average?.toFixed(1) ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate">
                    {r.comment ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── NCRs Tab ───────────────────────────────────────────────────────────────────

function NcrsTab({ ncrs }: { ncrs: NcrRow[] }) {
  const SEV_COLOUR: Record<string, string> = {
    minor: 'text-amber-400',
    major: 'text-orange-400',
    critical: 'text-red-400',
  }

  return (
    <div className="space-y-4">
      {ncrs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No NCRs"
          description="No non-conformance incidents have been raised against this operative."
        />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/80">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Ref</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Type</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Severity</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Date</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Site</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Resolved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ncrs.map((n) => (
                <tr key={n.id} className="hover:bg-background/50">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-muted-foreground">
                      {n.reference_number ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {NCR_TYPE_LABELS[n.incident_type] ?? n.incident_type}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('capitalize', SEV_COLOUR[n.severity] ?? 'text-muted-foreground')}>
                      {n.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap">
                    {fmtDate(n.incident_date)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {n.site?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {n.resolved ? (
                      <CheckCircle2 className="h-4 w-4 text-forest-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}


// InfoCard and InfoRow moved to src/components/operatives/operative-info-cards.tsx
// and src/components/operatives/editable-info-row.tsx
