import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { TimesheetActions } from '@/components/timesheets/timesheet-actions'
import { getCanExport } from '@/lib/export/check-export'

export default async function TimesheetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const canExport = await getCanExport()
  const supabase = createServiceClient()
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!

  const [{ data: ts }, { data: entries }] = await Promise.all([
    supabase
      .from('timesheets')
      .select(`
        *,
        operative:operatives!timesheets_operative_id_fkey(id, first_name, last_name, reference_number, phone, utr_number, ni_number)
      `)
      .eq('id', id)
      .eq('organization_id', orgId)
      .single(),
    supabase
      .from('timesheet_entries')
      .select('*')
      .eq('timesheet_id', id)
      .order('entry_date', { ascending: true }),
  ])

  if (!ts) notFound()

  const operative = ts.operative as {
    id: string; first_name: string; last_name: string; reference_number: string | null; phone: string | null; utr_number: string | null; ni_number: string | null
  } | null
  const operativeName = operative ? `${operative.first_name} ${operative.last_name}` : 'Unknown'
  const weekStr = new Date(ts.week_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  // CSV export data
  const exportData = (entries ?? []).map((e) => ({
    date: new Date(e.entry_date).toLocaleDateString('en-GB'),
    hours: String(e.hours_worked),
    overtime: String(e.overtime_hours ?? 0),
    dayRate: e.day_rate != null ? `£${Number(e.day_rate).toFixed(2)}` : '',
    pay: e.day_rate != null ? `£${(Number(e.hours_worked) / 8 * Number(e.day_rate)).toFixed(2)}` : '',
    notes: e.notes ?? '',
  }))

  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <PageHeader
            title={operativeName}
            description={`Week commencing ${weekStr}`}
          />
          <div className="mt-2">
            <StatusBadge status={ts.status ?? 'draft'} />
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/timesheets">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Entries */}
        <div className="md:col-span-2 space-y-4">
          <h2 className="font-medium">Entries</h2>

          {!entries || entries.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
              No timesheet entries yet.
            </div>
          ) : (
            <div className="rounded-lg border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-right px-4 py-3 font-medium">Hours</th>
                    <th className="text-right px-4 py-3 font-medium">Overtime</th>
                    <th className="text-right px-4 py-3 font-medium">Day Rate</th>
                    <th className="text-left px-4 py-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className={`border-b last:border-0 ${e.is_manual ? 'bg-yellow-50/40 dark:bg-yellow-950/10' : ''}`}>
                      <td className="px-4 py-2.5">
                        {new Date(e.entry_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {e.is_manual && <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400">Manual</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{Number(e.hours_worked).toFixed(1)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {Number(e.overtime_hours ?? 0) > 0 ? Number(e.overtime_hours).toFixed(1) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {e.day_rate != null ? `£${Number(e.day_rate).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{e.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-muted/20">
                  <tr>
                    <td className="px-4 py-2.5 font-medium">Totals</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">{Number(ts.total_hours ?? 0).toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{Number(ts.overtime_hours ?? 0).toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-lg">
                      {ts.gross_pay != null ? `£${Number(ts.gross_pay).toFixed(2)}` : '—'}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Summary card */}
          <div className="rounded-lg border bg-card p-5 space-y-3">
            <h2 className="font-medium">Summary</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Days worked</dt>
                <dd className="font-medium">{ts.total_days ?? 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total hours</dt>
                <dd className="font-medium tabular-nums">{Number(ts.total_hours ?? 0).toFixed(1)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Overtime hours</dt>
                <dd className="font-medium tabular-nums">{Number(ts.overtime_hours ?? 0).toFixed(1)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Day rate</dt>
                <dd className="font-medium">{ts.day_rate_used != null ? `£${Number(ts.day_rate_used).toFixed(2)}` : '—'}</dd>
              </div>
              <div className="flex justify-between border-t pt-2 mt-1">
                <dt className="font-semibold">Gross pay</dt>
                <dd className="font-bold text-lg">{ts.gross_pay != null ? `£${Number(ts.gross_pay).toFixed(2)}` : '—'}</dd>
              </div>
            </dl>

            {operative && (
              <div className="pt-2 border-t text-sm">
                <Link href={`/operatives/${operative.id}`} className="hover:underline text-primary">
                  {operativeName}
                </Link>
                {operative.phone && <div className="text-xs text-muted-foreground">{operative.phone}</div>}
              </div>
            )}
          </div>

          {/* Approval actions */}
          <TimesheetActions
            timesheetId={id}
            currentStatus={ts.status ?? 'draft'}
            operativeName={operativeName}
            weekStart={ts.week_start}
            exportData={exportData}
            operativeRef={operative?.reference_number ?? null}
            utrNumber={operative?.utr_number ?? null}
            niNumber={operative?.ni_number ?? null}
            canExport={canExport}
          />
        </div>
      </div>
    </div>
  )
}
