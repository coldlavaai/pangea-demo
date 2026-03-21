import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Link2, Clock, CheckCircle2, Zap, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { EmptyState } from '@/components/empty-state'
import type { Database } from '@/types/database'

type AllocationStatus = Database['public']['Enums']['allocation_status']

const PAGE_SIZE = 25

interface SearchParams {
  status?: string
  page?: string
}

export default async function AllocationsPage({
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
      .from('allocations')
      .select(
        `id, status, start_date, end_date, agreed_day_rate, offer_sent_at, offer_expires_at,
         operative:operatives!allocations_operative_id_fkey(id, first_name, last_name, reference_number, phone),
         site:sites!allocations_site_id_fkey(id, name),
         labour_request:labour_requests!allocations_labour_request_id_fkey(id)`,
        { count: 'exact' }
      )
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (params.status) q = q.eq('status', params.status as AllocationStatus)
    return q
  }

  const [
    { count: totalCount },
    { count: pendingCount },
    { count: activeCount },
    { count: confirmedCount },
    { data: allocations, count: filteredCount },
  ] = await Promise.all([
    supabase.from('allocations').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
    supabase.from('allocations').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'pending'),
    supabase.from('allocations').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'active'),
    supabase.from('allocations').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'confirmed'),
    buildQuery(),
  ])

  const totalPages = Math.ceil((filteredCount ?? 0) / PAGE_SIZE)
  const statuses = [
    { value: '', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
    { value: 'no_show', label: 'No Show' },
    { value: 'terminated', label: 'Terminated' },
  ]

  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      <PageHeader title="Allocations" description="All operative allocations" />

      <div className="flex items-center gap-px rounded-lg border border-border bg-background/40 overflow-hidden divide-x divide-border">
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-lg font-bold text-white tabular-nums">{totalCount ?? 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</span>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-lg font-bold text-amber-400 tabular-nums">{pendingCount ?? 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Pending</span>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-lg font-bold text-forest-400 tabular-nums">{confirmedCount ?? 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Confirmed</span>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <Zap className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-lg font-bold text-blue-400 tabular-nums">{activeCount ?? 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Active</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search operative, site..."
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-forest-600"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
        {statuses.map(({ value, label }) => {
          const active = (params.status ?? '') === value
          return (
            <Link
              key={value || 'all'}
              href={value ? `/allocations?status=${value}` : '/allocations'}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                active ? 'bg-primary text-primary-foreground border-primary' : 'border-input bg-background hover:bg-muted'
              }`}
            >
              {label}
            </Link>
          )
        })}
        </div>
      </div>

      {!allocations || allocations.length === 0 ? (
        <EmptyState icon={Link2} title="No allocations yet" description="Allocations are created from the labour pool search." />
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-3 py-2.5 font-medium">Operative</th>
                <th className="text-left px-3 py-2.5 font-medium">Phone</th>
                <th className="text-left px-3 py-2.5 font-medium">Site</th>
                <th className="text-left px-3 py-2.5 font-medium">Request</th>
                <th className="text-left px-3 py-2.5 font-medium">Dates</th>
                <th className="text-left px-3 py-2.5 font-medium">Day Rate</th>
                <th className="text-left px-3 py-2.5 font-medium">Offer Sent</th>
                <th className="text-left px-3 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(allocations as Array<{
                id: string
                status: string | null
                start_date: string
                end_date: string | null
                agreed_day_rate: number | null
                offer_sent_at: string | null
                offer_expires_at: string | null
                operative: { id: string; first_name: string; last_name: string; reference_number: string | null; phone: string | null } | null
                site: { id: string; name: string } | null
                labour_request: { id: string } | null
              }>).map((a) => (
                <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2.5">
                    <Link href={`/allocations/${a.id}`} className="font-medium hover:underline">
                      {a.operative ? `${a.operative.first_name} ${a.operative.last_name}` : '—'}
                    </Link>
                    {a.operative?.reference_number && (
                      <div className="text-xs text-muted-foreground font-mono">{a.operative.reference_number}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs font-mono tabular-nums">
                    {a.operative?.phone ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {a.site ? (
                      <Link href={`/sites/${a.site.id}`} className="hover:underline">{a.site.name}</Link>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {a.labour_request ? (
                      <Link href={`/requests/${a.labour_request.id}`} className="text-forest-400 hover:underline text-xs font-medium">View</Link>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground tabular-nums">
                    {new Date(a.start_date).toLocaleDateString('en-GB')}
                    {a.end_date && ` → ${new Date(a.end_date).toLocaleDateString('en-GB')}`}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {a.agreed_day_rate != null ? `£${Number(a.agreed_day_rate).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs tabular-nums">
                    {a.offer_sent_at ? new Date(a.offer_sent_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={a.status ?? 'pending'} />
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
                    <Link href={`/allocations?${new URLSearchParams({ ...params, page: String(currentPage - 1) })}`}>
                      <ChevronLeft className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
                {currentPage < totalPages && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/allocations?${new URLSearchParams({ ...params, page: String(currentPage + 1) })}`}>
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
