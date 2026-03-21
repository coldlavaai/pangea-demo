import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Calendar, Clock, Zap, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { EmptyState } from '@/components/empty-state'
import type { Database } from '@/types/database'

type ShiftStatus = Database['public']['Enums']['shift_status']

const PAGE_SIZE = 25

interface SearchParams {
  status?: string
  page?: string
}

function fmtDateTime(ts: string) {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

export default async function ShiftsPage({
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
      .from('shifts')
      .select(
        `id, status, scheduled_start, scheduled_end, break_minutes, actual_start, actual_end,
         wtd_overnight_flag, wtd_hours_flag, break_compliance_flag,
         operative:operatives!shifts_operative_id_fkey(id, first_name, last_name, reference_number),
         site:sites!shifts_site_id_fkey(id, name)`,
        { count: 'exact' }
      )
      .eq('organization_id', orgId)
      .order('scheduled_start', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (params.status) q = q.eq('status', params.status as ShiftStatus)
    return q
  }

  const [
    { count: totalCount },
    { count: scheduledCount },
    { count: inProgressCount },
    { count: completedCount },
    { data: shifts, count: filteredCount },
  ] = await Promise.all([
    supabase.from('shifts').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
    supabase.from('shifts').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).in('status', ['scheduled', 'published', 'confirmed']),
    supabase.from('shifts').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'in_progress'),
    supabase.from('shifts').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'completed'),
    buildQuery(),
  ])

  const totalPages = Math.ceil((filteredCount ?? 0) / PAGE_SIZE)
  const statuses = [
    { value: '', label: 'All' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'no_show', label: 'No Show' },
    { value: 'cancelled', label: 'Cancelled' },
  ]

  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      <PageHeader title="Shifts" description="Operative shift schedule" />

      <div className="flex items-center gap-px rounded-lg border border-border bg-background/40 overflow-hidden divide-x divide-border">
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-lg font-bold text-foreground tabular-nums">{totalCount ?? 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</span>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-lg font-bold text-foreground tabular-nums">{scheduledCount ?? 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Scheduled</span>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <Zap className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-lg font-bold text-foreground tabular-nums">{inProgressCount ?? 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">In Progress</span>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-lg font-bold text-foreground tabular-nums">{completedCount ?? 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Completed</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {statuses.map(({ value, label }) => (
          <Link
            key={value || 'all'}
            href={value ? `/shifts?status=${value}` : '/shifts'}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              (params.status ?? '') === value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-input bg-background hover:bg-muted'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {!shifts || shifts.length === 0 ? (
        <EmptyState icon={Calendar} title="No shifts found" description="Shifts are created via allocations." />
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium">Operative</th>
                <th className="text-left px-4 py-3 font-medium">Site</th>
                <th className="text-left px-4 py-3 font-medium">Scheduled</th>
                <th className="text-left px-4 py-3 font-medium">Flags</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(shifts as Array<{
                id: string
                status: string | null
                scheduled_start: string
                scheduled_end: string
                break_minutes: number | null
                actual_start: string | null
                actual_end: string | null
                wtd_overnight_flag: boolean | null
                wtd_hours_flag: boolean | null
                break_compliance_flag: boolean | null
                operative: { id: string; first_name: string; last_name: string; reference_number: string | null } | null
                site: { id: string; name: string } | null
              }>).map((shift) => (
                <tr key={shift.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/shifts/${shift.id}`} className="font-medium hover:underline">
                      {shift.operative ? `${shift.operative.first_name} ${shift.operative.last_name}` : '—'}
                    </Link>
                    {shift.operative?.reference_number && (
                      <div className="text-xs text-muted-foreground font-mono">{shift.operative.reference_number}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {shift.site ? <Link href={`/sites/${shift.site.id}`} className="hover:underline">{shift.site.name}</Link> : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <div>{fmtDateTime(shift.scheduled_start)}</div>
                    <div>→ {fmtDateTime(shift.scheduled_end)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {shift.wtd_overnight_flag && (
                        <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 rounded">Overnight</span>
                      )}
                      {shift.wtd_hours_flag && (
                        <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded">WTD Hours</span>
                      )}
                      {shift.break_compliance_flag && (
                        <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded">Break</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={shift.status ?? 'scheduled'} />
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
                    <Link href={`/shifts?${new URLSearchParams({ ...params, page: String(currentPage - 1) })}`}><ChevronLeft className="h-4 w-4" /></Link>
                  </Button>
                )}
                {currentPage < totalPages && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/shifts?${new URLSearchParams({ ...params, page: String(currentPage + 1) })}`}><ChevronRight className="h-4 w-4" /></Link>
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
