import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, MapPin, CheckCircle2, XCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { SitesFilterBar } from '@/components/sites/sites-filter-bar'

const PAGE_SIZE = 25

interface SearchParams {
  q?: string
  status?: string
  page?: string
}

export default async function SitesPage({
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
      .from('sites')
      .select('id, name, address, postcode, is_active, project_value, project_start_date, project_end_date, site_manager_name, site_manager_phone', { count: 'exact' })
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (params.q) {
      q = q.or(`name.ilike.%${params.q}%,postcode.ilike.%${params.q}%,address.ilike.%${params.q}%`)
    }
    if (params.status === 'active') q = q.eq('is_active', true)
    if (params.status === 'inactive') q = q.eq('is_active', false)
    return q
  }

  const [
    { count: totalCount },
    { count: activeCount },
    { count: inactiveCount },
    { data: sites, count: filteredCount },
  ] = await Promise.all([
    supabase.from('sites').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
    supabase.from('sites').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('is_active', true),
    supabase.from('sites').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('is_active', false),
    buildQuery(),
  ])

  const totalPages = Math.ceil((filteredCount ?? 0) / PAGE_SIZE)
  const hasFilters = params.q || params.status

  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      <PageHeader
        title="Sites"
        description="Construction sites and project locations"
        action={
          <Button asChild>
            <Link href="/sites/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Site
            </Link>
          </Button>
        }
      />

      {/* Stats */}
      <div className="flex items-center gap-px rounded-lg border border-border bg-background/40 overflow-hidden divide-x divide-border">
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-lg font-bold text-foreground tabular-nums">{totalCount ?? 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Sites</span>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-lg font-bold text-forest-400 tabular-nums">{activeCount ?? 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Active</span>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-lg font-bold text-muted-foreground tabular-nums">{inactiveCount ?? 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Inactive</span>
        </div>
      </div>

      {/* Filters */}
      <SitesFilterBar />

      {/* Table */}
      {!sites || sites.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={hasFilters ? 'No sites match your filters' : 'No sites yet'}
          description={hasFilters ? 'Try adjusting your search.' : 'Add your first site to get started.'}
          action={
            !hasFilters ? (
              <Button asChild>
                <Link href="/sites/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Site
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-3 py-1.5 font-medium">Site</th>
                <th className="text-left px-3 py-1.5 font-medium">Location</th>
                <th className="text-left px-3 py-1.5 font-medium">Manager</th>
                <th className="text-left px-3 py-1.5 font-medium">Project Value</th>
                <th className="text-left px-3 py-1.5 font-medium">Dates</th>
                <th className="text-left px-3 py-1.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => (
                <tr
                  key={site.id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-3 py-1.5">
                    <Link
                      href={`/sites/${site.id}`}
                      className="font-medium hover:underline"
                    >
                      {site.name}
                    </Link>
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {site.address}{site.postcode && <span className="ml-1.5 text-xs font-mono">{site.postcode}</span>}
                  </td>
                  <td className="px-3 py-1.5">
                    {site.site_manager_name ? (
                      <>
                        {site.site_manager_name}
                        {site.site_manager_phone && (
                          <span className="ml-1.5 text-xs text-muted-foreground">{site.site_manager_phone}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">
                    {site.project_value != null ? (
                      <span>£{Number(site.project_value).toLocaleString()}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-xs text-muted-foreground">
                    {site.project_start_date && new Date(site.project_start_date).toLocaleDateString('en-GB')}
                    {site.project_start_date && site.project_end_date && ' → '}
                    {site.project_end_date && new Date(site.project_end_date).toLocaleDateString('en-GB')}
                    {!site.project_start_date && !site.project_end_date && '—'}
                  </td>
                  <td className="px-3 py-1.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        site.is_active
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {site.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
              <span className="text-xs text-muted-foreground">
                Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, filteredCount ?? 0)} of {filteredCount} sites
              </span>
              <div className="flex gap-2">
                {currentPage > 1 && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/sites?${new URLSearchParams({ ...params, page: String(currentPage - 1) })}`}>
                      <ChevronLeft className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
                {currentPage < totalPages && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/sites?${new URLSearchParams({ ...params, page: String(currentPage + 1) })}`}>
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
