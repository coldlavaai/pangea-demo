import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar, PoundSterling, Clock, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { AllocationStatusActions } from '@/components/allocations/allocation-status-actions'
import { SendOfferButton } from '@/components/allocations/send-offer-button'

function InfoCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  )
}

export default async function AllocationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = createServiceClient()
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!

  const { data: alloc } = await supabase
    .from('allocations')
    .select(`
      *,
      operative:operatives!allocations_operative_id_fkey(
        id, first_name, last_name, reference_number, phone, status,
        avg_rap_score, rap_traffic_light
      ),
      site:sites!allocations_site_id_fkey(id, name, address, postcode),
      labour_request:labour_requests!allocations_labour_request_id_fkey(id, headcount_required, headcount_filled)
    `)
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()

  if (!alloc) notFound()

  const operative = alloc.operative as {
    id: string; first_name: string; last_name: string; reference_number: string | null
    phone: string | null; status: string | null; avg_rap_score: number | null; rap_traffic_light: string | null
  } | null
  const site = alloc.site as { id: string; name: string; address: string; postcode: string } | null
  const req = alloc.labour_request as { id: string; headcount_required: number; headcount_filled: number } | null
  const operativeName = operative ? `${operative.first_name} ${operative.last_name}` : 'Unknown'

  const offerExpired = alloc.offer_expires_at && new Date(alloc.offer_expires_at) < new Date()

  const TRAFFIC_COLOURS: Record<string, string> = {
    green: 'text-green-500',
    amber: 'text-yellow-500',
    red: 'text-red-500',
  }

  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <PageHeader
            title={operativeName}
            description={site?.name ?? 'Allocation'}
          />
          <div className="mt-2">
            <StatusBadge status={alloc.status ?? 'pending'} />
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/allocations">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Allocation details */}
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-lg border bg-card p-5 space-y-4">
            <h2 className="font-medium">Allocation Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <InfoCard label="Operative">
                {operative ? (
                  <Link href={`/operatives/${operative.id}`} className="hover:underline text-primary font-medium">
                    {operativeName}
                  </Link>
                ) : '—'}
                {operative?.reference_number && (
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">{operative.reference_number}</div>
                )}
                {operative?.phone && (
                  <div className="text-xs text-muted-foreground mt-0.5">{operative.phone}</div>
                )}
              </InfoCard>

              <InfoCard label="Site">
                {site ? (
                  <Link href={`/sites/${site.id}`} className="hover:underline text-primary">
                    {site.name}
                  </Link>
                ) : '—'}
                {site && <div className="text-xs text-muted-foreground mt-0.5">{site.address}, {site.postcode}</div>}
              </InfoCard>

              <InfoCard label={<span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Planned Dates</span> as unknown as string}>
                {new Date(alloc.start_date).toLocaleDateString('en-GB')}
                {alloc.end_date && ` → ${new Date(alloc.end_date).toLocaleDateString('en-GB')}`}
              </InfoCard>

              {(alloc.actual_start_date || alloc.actual_end_date) && (
                <InfoCard label="Actual Dates">
                  {alloc.actual_start_date ? new Date(alloc.actual_start_date).toLocaleDateString('en-GB') : '—'}
                  {alloc.actual_end_date && ` → ${new Date(alloc.actual_end_date).toLocaleDateString('en-GB')}`}
                </InfoCard>
              )}

              <InfoCard label={<span className="flex items-center gap-1"><PoundSterling className="h-3 w-3" /> Day Rate</span> as unknown as string}>
                {alloc.agreed_day_rate != null ? `£${Number(alloc.agreed_day_rate).toFixed(2)}` : '—'}
              </InfoCard>

              <InfoCard label="Broadcast Rank">
                #{alloc.broadcast_rank ?? 1}
              </InfoCard>

              {req && (
                <InfoCard label={<span className="flex items-center gap-1"><Users className="h-3 w-3" /> Labour Request</span> as unknown as string}>
                  <Link href={`/requests/${req.id}`} className="hover:underline text-primary">
                    View request
                  </Link>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {req.headcount_filled}/{req.headcount_required} filled
                  </div>
                </InfoCard>
              )}
            </div>

            {alloc.notes && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{alloc.notes}</p>
              </div>
            )}
          </div>

          {/* Offer tracking */}
          {(alloc.offer_sent_at || alloc.offer_expires_at) && (
            <div className="rounded-lg border bg-card p-5 space-y-3">
              <h2 className="font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Offer Tracking
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {alloc.offer_sent_at && (
                  <InfoCard label="Offer Sent">
                    {new Date(alloc.offer_sent_at).toLocaleString('en-GB')}
                  </InfoCard>
                )}
                {alloc.offer_expires_at && (
                  <InfoCard label="Offer Expires">
                    <span className={offerExpired ? 'text-red-500 font-medium' : ''}>
                      {new Date(alloc.offer_expires_at).toLocaleString('en-GB')}
                      {offerExpired && ' — EXPIRED'}
                    </span>
                  </InfoCard>
                )}
                {alloc.offer_responded_at && (
                  <InfoCard label="Responded">
                    {new Date(alloc.offer_responded_at).toLocaleString('en-GB')}
                  </InfoCard>
                )}
              </div>
            </div>
          )}

          {/* Induction */}
          {alloc.induction_token && (
            <div className="rounded-lg border bg-card p-5 space-y-3">
              <h2 className="font-medium">Induction</h2>
              <div className="grid grid-cols-2 gap-4">
                <InfoCard label="Induction Link">
                  <a
                    href={`${process.env.NEXT_PUBLIC_APP_URL}/induction/${alloc.induction_token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-xs truncate block"
                  >
                    Open induction form
                  </a>
                </InfoCard>
                <InfoCard label="Completed">
                  {alloc.induction_complete
                    ? <span className="text-forest-600 font-medium">Yes — {alloc.induction_completed_at ? new Date(alloc.induction_completed_at).toLocaleDateString('en-GB') : ''}</span>
                    : <span className="text-muted-foreground">Pending</span>}
                </InfoCard>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* RAP summary */}
          {operative && (
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <p className="text-sm font-medium">RAP Score</p>
              <p className={`text-3xl font-bold ${operative.rap_traffic_light ? TRAFFIC_COLOURS[operative.rap_traffic_light] ?? '' : ''}`}>
                {operative.avg_rap_score != null ? operative.avg_rap_score.toFixed(1) : '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                <Link href={`/operatives/${operative.id}?tab=rap`} className="hover:underline text-primary">
                  View full RAP history
                </Link>
              </p>
            </div>
          )}

          {/* Send offer */}
          {alloc.status === 'pending' && (
            <SendOfferButton
              allocationId={id}
              alreadySent={!!alloc.offer_sent_at}
              operativeName={operativeName}
            />
          )}

          {/* Status actions */}
          <AllocationStatusActions
            allocationId={id}
            currentStatus={alloc.status ?? 'pending'}
            operativeName={operativeName}
          />
        </div>
      </div>
    </div>
  )
}
