import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil, Search, Calendar, Users, PoundSterling } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { RequestStatusActions } from '@/components/requests/request-status-actions'

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = createServiceClient()
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!

  const [{ data: req }, { data: allocations }] = await Promise.all([
    supabase
      .from('labour_requests')
      .select(`
        *,
        site:sites!labour_requests_site_id_fkey(id, name, address, postcode),
        trade_category:trade_categories!labour_requests_trade_category_id_fkey(name)
      `)
      .eq('id', id)
      .eq('organization_id', orgId)
      .single(),
    supabase
      .from('allocations')
      .select(`
        id, status, start_date, end_date, agreed_day_rate,
        operative:operatives!allocations_operative_id_fkey(id, first_name, last_name, reference_number, phone)
      `)
      .eq('labour_request_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!req) notFound()

  const site = req.site as { id: string; name: string; address: string; postcode: string } | null
  const trade = req.trade_category as { name: string } | null
  const headcountRemaining = req.headcount_required - req.headcount_filled
  const canSearch = req.status !== 'fulfilled' && req.status !== 'cancelled'

  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <PageHeader
            title={site?.name ?? 'Labour Request'}
            description={trade?.name ? `${trade.name} · ${req.headcount_required} operative${req.headcount_required !== 1 ? 's' : ''}` : `${req.headcount_required} operative${req.headcount_required !== 1 ? 's' : ''}`}
          />
          <div className="mt-2">
            <StatusBadge status={req.status ?? 'pending'} />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canSearch && (
            <Button asChild>
              <Link href={`/requests/${id}/search`}>
                <Search className="h-4 w-4 mr-2" />
                Find Operatives
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href={`/requests/${id}/edit`}>
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/requests">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Request details */}
        <div className="md:col-span-1 space-y-4">
          <div className="rounded-lg border bg-card p-5 space-y-4">
            <h2 className="font-medium">Request Details</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Site</dt>
                <dd className="mt-0.5">
                  {site ? (
                    <Link href={`/sites/${site.id}`} className="hover:underline text-primary">
                      {site.name}
                    </Link>
                  ) : '—'}
                </dd>
                {site?.address && <dd className="text-xs text-muted-foreground">{site.address}, {site.postcode}</dd>}
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Trade</dt>
                <dd className="mt-0.5">{trade?.name ?? 'Any'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Users className="h-3 w-3" /> Headcount
                </dt>
                <dd className="mt-0.5">
                  <span className="font-semibold text-lg">{req.headcount_filled}</span>
                  <span className="text-muted-foreground">/{req.headcount_required} filled</span>
                  {headcountRemaining > 0 && (
                    <span className="ml-2 text-orange-500 text-xs font-medium">({headcountRemaining} needed)</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Dates
                </dt>
                <dd className="mt-0.5">
                  {new Date(req.start_date).toLocaleDateString('en-GB')}
                  {req.end_date && ` → ${new Date(req.end_date).toLocaleDateString('en-GB')}`}
                </dd>
                {req.duration_weeks && (
                  <dd className="text-xs text-muted-foreground mt-0.5">{req.duration_weeks} week{req.duration_weeks !== 1 ? 's' : ''}</dd>
                )}
              </div>
              {req.day_rate != null && (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <PoundSterling className="h-3 w-3" /> Day Rate
                  </dt>
                  <dd className="mt-0.5">£{Number(req.day_rate).toFixed(2)}</dd>
                </div>
              )}
              {req.required_skills && req.required_skills.length > 0 && (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Required Skills</dt>
                  <dd className="mt-1 flex flex-wrap gap-1">
                    {req.required_skills.map((skill: string) => (
                      <span key={skill} className="px-2 py-0.5 rounded-full bg-muted text-xs">{skill}</span>
                    ))}
                  </dd>
                </div>
              )}
              {req.notes && (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</dt>
                  <dd className="mt-0.5 text-muted-foreground whitespace-pre-wrap">{req.notes}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Created</dt>
                <dd className="mt-0.5">{new Date(req.created_at!).toLocaleDateString('en-GB')}</dd>
              </div>
            </dl>
          </div>

          {/* Status actions */}
          <RequestStatusActions requestId={id} currentStatus={req.status ?? 'pending'} />
        </div>

        {/* Allocations */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">
              Allocations{' '}
              <span className="text-muted-foreground font-normal">({allocations?.length ?? 0})</span>
            </h2>
            {canSearch && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/requests/${id}/search`}>
                  <Search className="h-4 w-4 mr-1" />
                  Find Operatives
                </Link>
              </Button>
            )}
          </div>

          {!allocations || allocations.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No operatives allocated yet.</p>
              {canSearch && (
                <Button asChild variant="outline" className="mt-4">
                  <Link href={`/requests/${id}/search`}>
                    <Search className="h-4 w-4 mr-2" />
                    Search Labour Pool
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-lg border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium">Operative</th>
                    <th className="text-left px-4 py-3 font-medium">Dates</th>
                    <th className="text-left px-4 py-3 font-medium">Day Rate</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(allocations as Array<{
                    id: string
                    status: string | null
                    start_date: string
                    end_date: string | null
                    agreed_day_rate: number | null
                    operative: { id: string; first_name: string; last_name: string; reference_number: string | null; phone: string | null } | null
                  }>).map((alloc) => (
                    <tr key={alloc.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        {alloc.operative ? (
                          <div>
                            <Link
                              href={`/operatives/${alloc.operative.id}`}
                              className="font-medium hover:underline"
                            >
                              {alloc.operative.first_name} {alloc.operative.last_name}
                            </Link>
                            {alloc.operative.reference_number && (
                              <div className="text-xs text-muted-foreground font-mono">{alloc.operative.reference_number}</div>
                            )}
                            {alloc.operative.phone && (
                              <div className="text-xs text-muted-foreground">{alloc.operative.phone}</div>
                            )}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(alloc.start_date).toLocaleDateString('en-GB')}
                        {alloc.end_date && ` → ${new Date(alloc.end_date).toLocaleDateString('en-GB')}`}
                      </td>
                      <td className="px-4 py-3">
                        {alloc.agreed_day_rate != null ? `£${Number(alloc.agreed_day_rate).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={alloc.status ?? 'pending'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
