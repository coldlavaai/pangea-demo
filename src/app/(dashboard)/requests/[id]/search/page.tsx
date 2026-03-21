import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { LabourPoolResults } from '@/components/requests/labour-pool-results'

// Haversine distance in miles
function distanceMiles(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 3958.8
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Composite score: RAP (0-5) × 20 + distance bonus (max 30) + availability bonus (10)
function rankScore(rapScore: number | null, distMiles: number | null, status: string): number {
  const rap = rapScore != null ? (rapScore / 5) * 40 : 20  // 0–40 pts; unknown = 20
  const dist = distMiles != null
    ? Math.max(0, 30 - distMiles * 0.5)   // loses 0.5pt/mile, floors at 0
    : 15                                   // unknown = 15
  const avail = status === 'available' ? 20 : status === 'verified' ? 10 : 0
  // suppress unused parameter warning
  return Math.round(rap + dist + avail)
}

export type CandidateRow = {
  id: string
  first_name: string
  last_name: string
  reference_number: string | null
  phone: string | null
  status: string | null
  reemploy_status: string | null
  avg_rap_score: number | null
  rap_traffic_light: string | null
  lat: number | null
  lng: number | null
  trade_category: { name: string } | null
  // computed
  distance_miles: number | null
  rank_score: number
  already_allocated: boolean
}

interface SearchParams {
  trade_id?: string
  radius?: string
  include_working?: string
}

export default async function LabourPoolSearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<SearchParams>
}) {
  const { id: requestId } = await params
  const sp = await searchParams
  const includeWorking = sp.include_working === 'true'
  const supabase = await createClient()
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!

  // Load the request + site + existing allocation operative IDs in parallel
  const [{ data: req }, { data: existingAllocs }] = await Promise.all([
    supabase
      .from('labour_requests')
      .select(`
        id, headcount_required, headcount_filled, start_date, end_date, day_rate,
        trade_category_id,
        site:sites!labour_requests_site_id_fkey(id, name, lat, lng)
      `)
      .eq('id', requestId)
      .eq('organization_id', orgId)
      .single(),
    supabase
      .from('allocations')
      .select('operative_id')
      .eq('labour_request_id', requestId)
      .not('status', 'in', '(no_show,completed)'),
  ])

  if (!req) notFound()

  const site = req.site as { id: string; name: string; lat: number | null; lng: number | null } | null
  const alreadyAllocatedIds = new Set((existingAllocs ?? []).map((a) => a.operative_id))
  const maxRadius = parseInt(sp.radius ?? '50', 10)

  // Fetch available + verified operatives (not blocked, not do_not_rehire)
  const tradeFilter = sp.trade_id ?? req.trade_category_id

  // If a trade filter is set, also find operatives who have done that trade in their work history
  let extraOperativeIds: string[] = []
  if (tradeFilter) {
    // Look up the trade name so we can ILIKE match against job titles
    const { data: tradeCat } = await supabase
      .from('trade_categories')
      .select('name')
      .eq('id', tradeFilter)
      .single()

    if (tradeCat?.name) {
      const { data: historyMatches } = await supabase
        .from('work_history')
        .select('operative_id')
        .eq('organization_id', orgId)
        .ilike('job_title', `%${tradeCat.name}%`)

      extraOperativeIds = [...new Set((historyMatches ?? []).map((h) => h.operative_id))]
    }
  }

  let opQuery = supabase
    .from('operatives')
    .select(`
      id, first_name, last_name, reference_number, phone, status, reemploy_status,
      avg_rap_score, rap_traffic_light, lat, lng,
      trade_category:trade_categories!operatives_trade_category_id_fkey(name)
    `)
    .eq('organization_id', orgId)
    .in('status', includeWorking ? ['available', 'verified', 'working'] : ['available', 'verified'])
    .neq('reemploy_status', 'do_not_rehire')

  if (tradeFilter) {
    if (extraOperativeIds.length > 0) {
      // Include operatives who match on trade_category OR have relevant work history
      opQuery = opQuery.or(`trade_category_id.eq.${tradeFilter},id.in.(${extraOperativeIds.join(',')})`)
    } else {
      opQuery = opQuery.eq('trade_category_id', tradeFilter)
    }
  }

  const { data: rawOperatives } = await opQuery.limit(200)

  // Rank, compute distance, filter by radius
  const candidates: CandidateRow[] = (rawOperatives ?? []).map((op) => {
    const distMiles =
      site?.lat && site?.lng && op.lat && op.lng
        ? distanceMiles(site.lat, site.lng, op.lat, op.lng)
        : null

    return {
      ...op,
      trade_category: op.trade_category as { name: string } | null,
      distance_miles: distMiles != null ? Math.round(distMiles * 10) / 10 : null,
      rank_score: rankScore(op.avg_rap_score, distMiles, op.status ?? ''),
      already_allocated: alreadyAllocatedIds.has(op.id),
    }
  })
    .filter((c) => c.distance_miles == null || c.distance_miles <= maxRadius)
    .sort((a, b) => b.rank_score - a.rank_score)

  const alreadyAllocatedCount = req.headcount_filled
  const stillNeeded = req.headcount_required - alreadyAllocatedCount
  const hasReallocationCandidates = candidates.some((c) => c.already_allocated)

  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Labour Pool Search"
          description={`${site?.name ?? 'Site unknown'} · ${stillNeeded} operative${stillNeeded !== 1 ? 's' : ''} needed`}
        />
        <Link href={`/requests/${requestId}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Request
        </Link>
      </div>

      {/* Reallocation-first banner (GAP-053) */}
      {hasReallocationCandidates && (
        <div className="rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-950 dark:border-orange-800 px-3 py-1.5 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-orange-800 dark:text-orange-300">Reallocation candidates available</p>
            <p className="text-orange-700 dark:text-orange-400 mt-0.5">
              Some operatives below are already allocated to this request. Check reallocation opportunities before adding new operatives.
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      <LabourPoolResults
        candidates={candidates}
        requestId={requestId}
        siteId={site?.id ?? ''}
        requestStartDate={req.start_date}
        requestEndDate={req.end_date ?? null}
        requestDayRate={req.day_rate ?? null}
        siteHasCoords={!!(site?.lat && site?.lng)}
        tradeId={sp.trade_id ?? null}
        includeWorking={includeWorking}
      />
    </div>
  )
}
