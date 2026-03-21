import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, AlertTriangle, Plus, ChevronRight as ViewIcon, Clock, XCircle, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { SiteFilter } from '@/components/ncrs/site-filter'

const PAGE_SIZE = 25

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

const SEVERITY_CLASSES: Record<string, string> = {
  minor: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  major: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  critical: 'bg-red-500/10 text-red-600 border-red-500/20',
}

const SEVERITY_ROW_BORDER: Record<string, string> = {
  minor: 'border-l-yellow-400',
  major: 'border-l-orange-400',
  critical: 'border-l-red-500',
}

interface SearchParams {
  type?: string
  site_id?: string
  operative_id?: string
  resolved?: string
  page?: string
}

export default async function NcrsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = createServiceClient()
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!
  const currentPage = Math.max(1, parseInt(params.page ?? '1', 10))
  const offset = (currentPage - 1) * PAGE_SIZE

  const buildQuery = () => {
    let q = supabase
      .from('non_conformance_incidents')
      .select(
        `id, incident_type, severity, incident_date, resolved, auto_blocked, reference_number,
         operative:operatives!non_conformance_incidents_operative_id_fkey(id, first_name, last_name, reference_number),
         site:sites!non_conformance_incidents_site_id_fkey(id, name)`,
        { count: 'exact' }
      )
      .eq('organization_id', orgId)
      .order('incident_date', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (params.type) q = q.eq('incident_type', params.type as 'no_show' | 'walk_off' | 'late_arrival' | 'safety_breach' | 'drugs_alcohol' | 'conduct_issue' | 'poor_attitude' | 'poor_workmanship' | 'other')
    if (params.site_id) q = q.eq('site_id', params.site_id)
    if (params.operative_id) q = q.eq('operative_id', params.operative_id)
    if (params.resolved === 'open') q = q.eq('resolved', false)
    if (params.resolved === 'resolved') q = q.eq('resolved', true)
    return q
  }

  const [
    { count: totalCount },
    { count: openCount },
    { count: autoBlockedCount },
    { count: criticalCount },
    { data: ncrs, count: filteredCount },
    { data: sites },
  ] = await Promise.all([
    supabase.from('non_conformance_incidents').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
    supabase.from('non_conformance_incidents').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('resolved', false),
    supabase.from('non_conformance_incidents').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('auto_blocked', true),
    supabase.from('non_conformance_incidents').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('severity', 'critical').eq('resolved', false),
    buildQuery(),
    supabase.from('sites').select('id, name').eq('organization_id', orgId).order('name'),
  ])

  const totalPages = Math.ceil((filteredCount ?? 0) / PAGE_SIZE)

  const typeFilters = [
    { value: '', label: 'All Types' },
    ...Object.entries(NCR_TYPE_LABELS).map(([value, label]) => ({ value, label })),
  ]

  const statusFilters = [
    { value: '', label: 'All' },
    { value: 'open', label: 'Open' },
    { value: 'resolved', label: 'Resolved' },
  ]

  const buildHref = (overrides: Partial<SearchParams>) => {
    const next = { ...params, page: '1', ...overrides }
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(next).filter(([, v]) => v)) as Record<string, string>
    )
    return `/ncrs${qs.toString() ? `?${qs}` : ''}`
  }

  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      <PageHeader
        title="Non-Conformance Reports"
        description="Track and manage operative incidents"
        action={
          <Button asChild size="sm">
            <Link href="/ncrs/new">
              <Plus className="h-4 w-4 mr-1" />
              Raise NCR
            </Link>
          </Button>
        }
      />

      {/* Stats */}
      <div className="flex items-center gap-px rounded-lg border border-border bg-background/40 overflow-hidden divide-x divide-border">
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-lg font-bold text-foreground tabular-nums">{totalCount ?? 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</span>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <Clock className="h-3.5 w-3.5 text-orange-500 shrink-0" />
          <span className="text-lg font-bold text-orange-500 tabular-nums">{openCount ?? 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Open</span>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
          <span className="text-lg font-bold text-red-500 tabular-nums">{criticalCount ?? 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Critical</span>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <ShieldAlert className="h-3.5 w-3.5 text-red-600 shrink-0" />
          <span className="text-lg font-bold text-red-600 tabular-nums">{autoBlockedCount ?? 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Blocked</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {statusFilters.map(({ value, label }) => {
          const active = (params.resolved ?? '') === value
          return (
            <Link
              key={value || 'all-status'}
              href={buildHref({ resolved: value })}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                active ? 'bg-primary text-primary-foreground border-primary' : 'border-input bg-background hover:bg-muted'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {typeFilters.map(({ value, label }) => {
          const active = (params.type ?? '') === value
          return (
            <Link
              key={value || 'all-types'}
              href={buildHref({ type: value })}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                active ? 'bg-primary text-primary-foreground border-primary' : 'border-input bg-background hover:bg-muted'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </div>

      {/* Site filter */}
      {sites && sites.length > 0 && (
        <SiteFilter
          sites={sites}
          currentSiteId={params.site_id ?? ''}
          currentParams={{ type: params.type, resolved: params.resolved, operative_id: params.operative_id }}
        />
      )}

      {/* Table */}
      {!ncrs || ncrs.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No NCRs found"
          description="Non-conformance reports will appear here."
          action={
            <Button asChild size="sm">
              <Link href="/ncrs/new">Raise NCR</Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium">Ref</th>
                <th className="text-left px-4 py-3 font-medium">Operative</th>
                <th className="text-left px-4 py-3 font-medium">Site</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Severity</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {(ncrs as Array<{
                id: string
                incident_type: string
                severity: string
                incident_date: string
                incident_time?: string | null
                resolved: boolean | null
                auto_blocked: boolean | null
                reference_number: string | null
                operative: { id: string; first_name: string; last_name: string; reference_number: string | null } | null
                site: { id: string; name: string } | null
              }>).map((n) => (
                <tr key={n.id} className={`border-b last:border-0 hover:bg-muted/30 transition-colors border-l-4 ${SEVERITY_ROW_BORDER[n.severity] ?? 'border-l-transparent'}`}>
                  <td className="px-4 py-3">
                    <Link href={`/ncrs/${n.id}`} className="font-mono text-xs hover:underline text-muted-foreground">
                      {n.reference_number ?? n.id.slice(0, 8).toUpperCase()}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {n.operative ? (
                      <Link href={`/operatives/${n.operative.id}`} className="font-medium hover:underline">
                        {n.operative.first_name} {n.operative.last_name}
                      </Link>
                    ) : '—'}
                    {n.auto_blocked && (
                      <span className="ml-2 text-xs bg-red-500/10 text-red-600 border border-red-500/20 rounded px-1">BLOCKED</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {n.site?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {NCR_TYPE_LABELS[n.incident_type] ?? n.incident_type}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded border capitalize ${SEVERITY_CLASSES[n.severity] ?? ''}`}>
                      {n.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(n.incident_date).toLocaleDateString('en-GB')}
                    {n.incident_time && <span className="ml-1 text-muted-foreground/70">{n.incident_time}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {n.resolved ? (
                      <span className="text-xs text-green-600 font-medium">Resolved</span>
                    ) : (
                      <span className="text-xs text-orange-500 font-medium">Open</span>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    <Link href={`/ncrs/${n.id}`} className="text-muted-foreground/50 hover:text-foreground">
                      <ViewIcon className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
              <span className="text-xs text-muted-foreground">
                {offset + 1}–{Math.min(offset + PAGE_SIZE, filteredCount ?? 0)} of {filteredCount}
              </span>
              <div className="flex gap-2">
                {currentPage > 1 && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={buildHref({ page: String(currentPage - 1) })}>
                      <ChevronLeft className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
                {currentPage < totalPages && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={buildHref({ page: String(currentPage + 1) })}>
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
