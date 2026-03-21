import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Eye, MousePointer, Users, PoundSterling } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { AdvertActions } from '@/components/adverts/advert-actions'

const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  indeed: 'Indeed',
  other: 'Other',
}

export default async function AdvertDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!

  const { data: ad } = await supabase
    .from('adverts')
    .select('*, labour_request:labour_requests(id)')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()

  if (!ad) notFound()

  const ctr = ad.impressions && ad.clicks
    ? ((ad.clicks / ad.impressions) * 100).toFixed(1)
    : null

  const convRate = ad.clicks && ad.applications
    ? ((ad.applications / ad.clicks) * 100).toFixed(1)
    : null

  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title={PLATFORM_LABELS[ad.platform] ?? ad.platform}
          description={ad.external_url ?? undefined}
        />
        <div className="flex items-center gap-2 shrink-0">
          <Button asChild variant="outline" size="sm" className="border-border text-muted-foreground hover:bg-card">
            <Link href="/adverts">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <StatusBadge status={ad.status ?? 'draft'} />
        {ad.started_at && (
          <span className="text-xs text-muted-foreground">
            Started {new Date(ad.started_at).toLocaleDateString('en-GB')}
          </span>
        )}
        {ad.ended_at && (
          <span className="text-xs text-muted-foreground">
            · Ended {new Date(ad.ended_at).toLocaleDateString('en-GB')}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metrics */}
        <div className="md:col-span-2 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Impressions', value: (ad.impressions ?? 0).toLocaleString(), icon: Eye },
              { label: 'Clicks', value: (ad.clicks ?? 0).toLocaleString(), icon: MousePointer },
              { label: 'Applications', value: (ad.applications ?? 0).toLocaleString(), icon: Users },
              { label: 'Spend', value: ad.spend_to_date != null ? `£${Number(ad.spend_to_date).toFixed(2)}` : '—', icon: PoundSterling },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-lg border border-border bg-background/60 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
                <p className="text-xl font-semibold tabular-nums text-muted-foreground">{value}</p>
              </div>
            ))}
          </div>

          {/* Rates */}
          {(ctr || convRate) && (
            <div className="rounded-lg border border-border bg-background/40 p-4 flex gap-6">
              {ctr && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Click-through rate</p>
                  <p className="text-lg font-semibold text-muted-foreground">{ctr}%</p>
                </div>
              )}
              {convRate && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Click → Application rate</p>
                  <p className="text-lg font-semibold text-muted-foreground">{convRate}%</p>
                </div>
              )}
            </div>
          )}

          {/* External ID */}
          {ad.external_id && (
            <div className="rounded-lg border border-border bg-background/40 p-4">
              <p className="text-xs text-muted-foreground mb-1">External Ad ID</p>
              <p className="text-xs font-mono text-muted-foreground">{ad.external_id}</p>
            </div>
          )}
        </div>

        {/* Sidebar: actions + details */}
        <div className="space-y-4">
          <AdvertActions
            advertId={id}
            currentStatus={ad.status ?? 'draft'}
            budget={ad.budget != null ? Number(ad.budget) : null}
            externalUrl={ad.external_url}
            externalId={ad.external_id}
          />

          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            <p className="text-sm font-medium">Details</p>
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Platform</dt>
                <dd className="text-muted-foreground">{PLATFORM_LABELS[ad.platform] ?? ad.platform}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Budget</dt>
                <dd className="text-muted-foreground">{ad.budget != null ? `£${Number(ad.budget).toFixed(2)}` : '—'}</dd>
              </div>
              {ad.labour_request && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Linked Request</dt>
                  <dd>
                    <Link href={`/requests/${(ad.labour_request as { id: string }).id}`} className="text-forest-400 hover:underline">
                      View →
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
