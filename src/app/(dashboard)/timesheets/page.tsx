import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Clock, ChevronLeft, ChevronRight, FileText, Edit, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { EmptyState } from '@/components/empty-state'
import { TimesheetsSearch } from '@/components/timesheets/timesheets-search'
import type { Database } from '@/types/database'

type TimesheetStatus = Database['public']['Enums']['timesheet_status']

const PAGE_SIZE = 25

interface SearchParams {
  status?: string
  page?: string
  operative?: string
}

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = createServiceClient()
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!
  const currentPage = Math.max(1, parseInt(params.page ?? '1', 10))
  const offset = (currentPage - 1) * PAGE_SIZE

  // If operative filter is set, resolve matching operative IDs first
  let operativeIds: string[] | null = null
  if (params.operative?.trim()) {
    const term = params.operative.trim()
    const { data: matchedOps } = await supabase
      .from('operatives')
      .select('id, first_name, last_name')
      .eq('organization_id', orgId)
      .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`)
      .limit(50)
    operativeIds = (matchedOps ?? []).map((o) => o.id)
  }

  const buildQuery = () => {
    let q = supabase
      .from('timesheets')
      .select(
        `id, week_start, total_hours, total_days, gross_pay, day_rate_used, status,
         operative:operatives!timesheets_operative_id_fkey(id, first_name, last_name, reference_number)`,
        { count: 'exact' }
      )
      .eq('organization_id', orgId)
      .order('week_start', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (params.status) q = q.eq('status', params.status as TimesheetStatus)
    if (operativeIds !== null) {
      if (operativeIds.length === 0) return null // no matches
      q = q.in('operative_id', operativeIds)
    }
    return q
  }

  const query = buildQuery()

  const [
    { count: totalCount },
    { count: draftCount },
    { count: pendingCount },
    { count: approvedCount },
    queryResult,
  ] = await Promise.all([
    supabase.from('timesheets').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
    supabase.from('timesheets').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'draft'),
    supabase.from('timesheets').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'submitted'),
    supabase.from('timesheets').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'approved'),
    query ? query : Promise.resolve({ data: [], count: 0, error: null }),
  ])

  const timesheets = queryResult.data
  const filteredCount = queryResult.count

  const totalPages = Math.ceil((filteredCount ?? 0) / PAGE_SIZE)
  const statuses = [
    { value: '', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'locked', label: 'Locked' },
  ]

  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      <PageHeader title="Timesheets" description="Weekly operative timesheets" />

      <div className="flex items-center gap-px rounded-lg border border-border bg-background/40 overflow-hidden divide-x divide-border">
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-lg font-bold text-foreground tabular-nums">{totalCount ?? 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</span>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <Edit className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-lg font-bold text-muted-foreground tabular-nums">{draftCount ?? 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Draft</span>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-lg font-bold text-amber-400 tabular-nums">{pendingCount ?? 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Pending Approval</span>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-lg font-bold text-forest-400 tabular-nums">{approvedCount ?? 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Approved</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {statuses.map(({ value, label }) => (
          <Link
            key={value || 'all'}
            href={value ? `/timesheets?status=${value}${params.operative ? `&operative=${encodeURIComponent(params.operative)}` : ''}` : `/timesheets${params.operative ? `?operative=${encodeURIComponent(params.operative)}` : ''}`}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              (params.status ?? '') === value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-input bg-background hover:bg-muted'
            }`}
          >
            {label}
          </Link>
        ))}
        <div className="ml-auto">
          <TimesheetsSearch defaultValue={params.operative} />
        </div>
      </div>

      {!timesheets || timesheets.length === 0 ? (
        <EmptyState icon={Clock} title="No timesheets yet" description="Timesheets are generated from approved shifts." />
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-3 py-1.5 font-medium">Operative</th>
                <th className="text-left px-3 py-1.5 font-medium">Week</th>
                <th className="text-left px-3 py-1.5 font-medium">Day Rate</th>
                <th className="text-left px-3 py-1.5 font-medium">Days</th>
                <th className="text-left px-3 py-1.5 font-medium">Hours</th>
                <th className="text-left px-3 py-1.5 font-medium">Gross Pay</th>
                <th className="text-left px-3 py-1.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(timesheets as Array<{
                id: string
                week_start: string
                total_hours: number | null
                total_days: number | null
                gross_pay: number | null
                day_rate_used: number | null
                status: string | null
                operative: { id: string; first_name: string; last_name: string; reference_number: string | null } | null
              }>).map((ts) => (
                <tr key={ts.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-1.5">
                    <Link href={`/timesheets/${ts.id}`} className="font-medium hover:underline">
                      {ts.operative ? `${ts.operative.first_name} ${ts.operative.last_name}` : '—'}
                    </Link>
                    {ts.operative?.reference_number && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground font-mono">{ts.operative.reference_number}</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    w/c {new Date(ts.week_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                    {ts.day_rate_used ? `£${Number(ts.day_rate_used).toFixed(0)}` : '—'}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">{ts.total_days ?? 0}</td>
                  <td className="px-3 py-1.5 tabular-nums">{ts.total_hours != null ? Number(ts.total_hours).toFixed(1) : '0.0'}</td>
                  <td className="px-3 py-1.5 tabular-nums font-medium">
                    {ts.gross_pay != null ? `£${Number(ts.gross_pay).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-3 py-1.5">
                    <StatusBadge status={ts.status ?? 'draft'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
              <span className="text-xs text-muted-foreground">{offset + 1}–{Math.min(offset + PAGE_SIZE, filteredCount ?? 0)} of {filteredCount}</span>
              <div className="flex gap-2">
                {currentPage > 1 && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/timesheets?${new URLSearchParams({ ...params, page: String(currentPage - 1) })}`}><ChevronLeft className="h-4 w-4" /></Link>
                  </Button>
                )}
                {currentPage < totalPages && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/timesheets?${new URLSearchParams({ ...params, page: String(currentPage + 1) })}`}><ChevronRight className="h-4 w-4" /></Link>
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
