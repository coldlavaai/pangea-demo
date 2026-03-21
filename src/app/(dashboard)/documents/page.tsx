import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AlertTriangle, CheckCircle, Clock, XCircle, FileText } from 'lucide-react'
import { CSCS_DOT_CLASS } from '@/lib/cscs-colours'
import { PageHeader } from '@/components/page-header'

import { StatusBadge } from '@/components/status-badge'
import { EmptyState } from '@/components/empty-state'
import { DocTypeFilter } from '@/components/documents/doc-type-filter'
import type { Database } from '@/types/database'

type DocumentType = Database['public']['Enums']['document_type']
type DocumentStatus = Database['public']['Enums']['document_status']

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

// Days-until thresholds
const EXPIRY_WARNING_DAYS = 30   // amber: expires within 30 days
const EXPIRY_CRITICAL_DAYS = 7  // red: expires within 7 days

interface SearchParams {
  urgency?: 'expired' | 'critical' | 'warning' | 'ok'
  type?: string
  page?: string
}

const PAGE_SIZE = 50

type DocRow = {
  id: string
  document_type: DocumentType
  status: DocumentStatus | null
  expiry_date: string | null
  file_name: string | null
  operative: { id: string; first_name: string; last_name: string; reference_number: string | null; cscs_card_type: string | null; nationality: string | null } | null
}

function urgencyForDoc(doc: DocRow, today: string, warnDate: string, critDate: string) {
  if (!doc.expiry_date) return 'ok'
  if (doc.expiry_date < today) return 'expired'
  if (doc.expiry_date < critDate) return 'critical'
  if (doc.expiry_date < warnDate) return 'warning'
  return 'ok'
}

export default async function CompliancePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = createServiceClient()
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const critDate = new Date(today.getTime() + EXPIRY_CRITICAL_DAYS * 86400000).toISOString().slice(0, 10)
  const warnDate = new Date(today.getTime() + EXPIRY_WARNING_DAYS * 86400000).toISOString().slice(0, 10)

  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  // Build the filtered query server-side for speed
  let query = supabase
    .from('documents')
    .select(`
      id, document_type, status, expiry_date, file_name,
      operative:operatives!documents_operative_id_fkey(id, first_name, last_name, reference_number, cscs_card_type, nationality)
    `, { count: 'exact' })
    .eq('organization_id', orgId)

  // Apply urgency filter at DB level
  if (params.urgency === 'expired') {
    query = query.not('expiry_date', 'is', null).lt('expiry_date', todayStr)
  } else if (params.urgency === 'critical') {
    query = query.not('expiry_date', 'is', null).gte('expiry_date', todayStr).lt('expiry_date', critDate)
  } else if (params.urgency === 'warning') {
    query = query.not('expiry_date', 'is', null).gte('expiry_date', critDate).lt('expiry_date', warnDate)
  }
  // 'ok' and no-filter: no date constraint needed

  if (params.type) {
    query = query.eq('document_type', params.type as DocumentType)
  }

  query = query.order('expiry_date', { ascending: true, nullsFirst: false })

  // Paginate
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const { data: allDocs, count: totalCount } = await query.range(from, to)

  const filtered = (allDocs ?? []) as DocRow[]
  const totalPages = Math.ceil((totalCount ?? 0) / PAGE_SIZE)

  // Counts query — lightweight head-only queries in parallel
  const [
    { count: expiredCount },
    { count: criticalCount },
    { count: warningCount },
    { count: totalDocsCount },
  ] = await Promise.all([
    supabase.from('documents').select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId).not('expiry_date', 'is', null).lt('expiry_date', todayStr),
    supabase.from('documents').select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId).not('expiry_date', 'is', null).gte('expiry_date', todayStr).lt('expiry_date', critDate),
    supabase.from('documents').select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId).not('expiry_date', 'is', null).gte('expiry_date', critDate).lt('expiry_date', warnDate),
    supabase.from('documents').select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId),
  ])

  const counts = {
    expired: expiredCount ?? 0,
    critical: criticalCount ?? 0,
    warning: warningCount ?? 0,
    ok: (totalDocsCount ?? 0) - (expiredCount ?? 0) - (criticalCount ?? 0) - (warningCount ?? 0),
  }

  const urgencyConfig = {
    expired: { label: 'Expired', icon: XCircle, colour: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950', border: 'border-red-200 dark:border-red-800' },
    critical: { label: `Expiring ≤${EXPIRY_CRITICAL_DAYS}d`, icon: AlertTriangle, colour: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950', border: 'border-orange-200 dark:border-orange-800' },
    warning: { label: `Expiring ≤${EXPIRY_WARNING_DAYS}d`, icon: Clock, colour: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-950', border: 'border-yellow-200 dark:border-yellow-800' },
    ok: { label: 'Valid / No expiry', icon: CheckCircle, colour: 'text-green-500', bg: '', border: '' },
  }

  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      <PageHeader
        title="Compliance"
        description="Document expiry tracking across all operatives"
      />

      {/* Stats */}
      <div className="flex items-center gap-px rounded-lg border border-border bg-background/40 overflow-hidden divide-x divide-border">
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-lg font-bold text-foreground tabular-nums">{counts.expired}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Expired</span>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-lg font-bold text-foreground tabular-nums">{counts.critical}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Critical</span>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-lg font-bold text-foreground tabular-nums">{counts.warning}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Warning</span>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <CheckCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-lg font-bold text-foreground tabular-nums">{counts.ok}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Valid</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {(['', 'expired', 'critical', 'warning', 'ok'] as const).map((u) => {
          const active = (params.urgency ?? '') === u
          const cfg = u ? urgencyConfig[u] : null
          return (
            <Link
              key={u || 'all'}
              href={u ? `/documents?urgency=${u}` : '/documents'}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-input bg-background hover:bg-muted'
              }`}
            >
              {cfg ? cfg.label : 'All'}
            </Link>
          )
        })}

        <DocTypeFilter currentType={params.type} />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents match"
          description="Try a different filter."
        />
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium">Operative</th>
                <th className="text-left px-4 py-3 font-medium">Document</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Expiry</th>
                <th className="text-left px-4 py-3 font-medium">Urgency</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => {
                const urgency = urgencyForDoc(doc, todayStr, warnDate, critDate)
                const cfg = urgencyConfig[urgency as keyof typeof urgencyConfig]
                const UrgIcon = cfg.icon

                return (
                  <tr key={doc.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      {doc.operative ? (
                        <Link
                          href={`/operatives/${doc.operative.id}?tab=documents`}
                          className="font-medium hover:underline"
                        >
                          {doc.operative.first_name} {doc.operative.last_name}
                        </Link>
                      ) : '—'}
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        {doc.operative?.reference_number && (
                          <span className="text-xs text-muted-foreground font-mono">
                            {doc.operative.reference_number}
                          </span>
                        )}
                        {doc.operative?.nationality && (
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {doc.operative.nationality}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/operatives/${doc.operative?.id}/documents/${doc.id}`}
                        className="hover:underline text-primary flex items-center gap-1.5"
                      >
                        {doc.document_type === 'cscs_card' && doc.operative?.cscs_card_type && CSCS_DOT_CLASS[doc.operative.cscs_card_type] && (
                          <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${CSCS_DOT_CLASS[doc.operative.cscs_card_type]}`} />
                        )}
                        {doc.file_name
                          ? doc.file_name.replace(' (Amber intake)', '')
                          : DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={doc.status ?? 'pending'} />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-sm">
                      {doc.expiry_date
                        ? new Date(doc.expiry_date).toLocaleDateString('en-GB')
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.colour}`}>
                        <UrgIcon className="h-3.5 w-3.5" />
                        {cfg.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground flex items-center justify-between">
            <span>
              Showing {from + 1}–{Math.min(from + filtered.length, totalCount ?? 0)} of {totalCount ?? 0} document{(totalCount ?? 0) !== 1 ? 's' : ''}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                {page > 1 && (
                  <Link
                    href={`/documents?${new URLSearchParams({ ...(params.urgency ? { urgency: params.urgency } : {}), ...(params.type ? { type: params.type } : {}), page: String(page - 1) }).toString()}`}
                    className="px-2 py-1 rounded text-xs hover:bg-muted transition-colors"
                  >
                    ← Prev
                  </Link>
                )}
                <span className="px-2 text-xs">
                  Page {page} of {totalPages}
                </span>
                {page < totalPages && (
                  <Link
                    href={`/documents?${new URLSearchParams({ ...(params.urgency ? { urgency: params.urgency } : {}), ...(params.type ? { type: params.type } : {}), page: String(page + 1) }).toString()}`}
                    className="px-2 py-1 rounded text-xs hover:bg-muted transition-colors"
                  >
                    Next →
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
