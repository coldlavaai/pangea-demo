import { createClient, createServiceClient } from '@/lib/supabase/server'
import { collapseImports } from '@/lib/collapse-imports'
import { format, addDays } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import {
  Users,
  MapPin,
  ClipboardList,
  HardHat,
  FileX,
  FileWarning,
  UserX,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  FileCheck,
  Bell,
  ClipboardX,
  Send,
} from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { RapQuickAdd } from '@/components/operatives/rap-quick-add'

const TZ = 'Europe/London'

function londonToday() {
  return format(toZonedTime(new Date(), TZ), 'yyyy-MM-dd')
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const serviceSupabase = createServiceClient()
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!
  const today = londonToday()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('users')
    .select('first_name')
    .eq('auth_user_id', user?.id ?? '')
    .single()
  const firstName = profile?.first_name ?? null
  const in7Days = format(addDays(toZonedTime(new Date(), TZ), 7), 'yyyy-MM-dd')
  const in30Days = format(addDays(toZonedTime(new Date(), TZ), 30), 'yyyy-MM-dd')

  // ── Stat card queries (parallel) ─────────────────────────────────────────
  const [
    { count: totalOperatives },
    { count: contactableOperatives },
    { count: activeSites },
    { count: openRequests },
    { data: openRequestsData },
    { count: workingToday },
    { count: startsToday },
    { count: expiredDocs },
    { count: expiring7Days },
    { count: expiring30Days },
    { count: unverifiedRtw },
    { count: blockedOperatives },
    { data: todaysAllocations },
    { data: recentNotifications },
    { count: openNcrs },
    { count: pendingOffers },
    { count: docsAwaitingReview },
  ] = await Promise.all([
    supabase
      .from('operatives')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId),

    supabase
      .from('operatives')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .or('phone.not.is.null,email.not.is.null'),

    supabase
      .from('sites')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('is_active', true),

    supabase
      .from('labour_requests')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .in('status', ['pending', 'searching', 'partial']),

    supabase
      .from('labour_requests')
      .select('headcount_required, headcount_filled')
      .eq('organization_id', orgId)
      .in('status', ['pending', 'searching', 'partial']),

    supabase
      .from('allocations')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'active'),

    supabase
      .from('allocations')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('start_date', today)
      .in('status', ['pending', 'confirmed', 'active']),

    supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .not('expiry_date', 'is', null)
      .lt('expiry_date', today),

    supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .not('expiry_date', 'is', null)
      .gte('expiry_date', today)
      .lte('expiry_date', in7Days),

    supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .not('expiry_date', 'is', null)
      .gt('expiry_date', in7Days)
      .lte('expiry_date', in30Days),

    supabase
      .from('operatives')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('rtw_verified', false)
      .not('status', 'eq', 'prospect'),

    supabase
      .from('operatives')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'blocked'),

    supabase
      .from('allocations')
      .select(`
        id,
        operative:operatives!allocations_operative_id_fkey(id, first_name, last_name),
        site:sites!allocations_site_id_fkey(name),
        attendance!left(status, arrived_at)
      `)
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .eq('start_date', today)
      .limit(20),

    serviceSupabase
      .from('notifications')
      .select('id, type, title, body, severity, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(60),

    serviceSupabase
      .from('non_conformance_incidents')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('resolved', false),

    serviceSupabase
      .from('allocations')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'pending')
      .not('offer_expires_at', 'is', null)
      .gt('offer_expires_at', new Date().toISOString()),

    serviceSupabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'pending'),
  ])

  const headcountNeeded =
    openRequestsData?.reduce(
      (sum, r) => sum + ((r.headcount_required ?? 0) - (r.headcount_filled ?? 0)),
      0
    ) ?? 0

  const totalCompliance =
    (expiredDocs ?? 0) + (expiring7Days ?? 0) + (expiring30Days ?? 0) +
    (unverifiedRtw ?? 0) + (blockedOperatives ?? 0)

  type AllocationRow = {
    id: string
    operative: { id: string; first_name: string; last_name: string } | null
    site: { name: string } | null
    attendance: Array<{ status: string; arrived_at: string | null }>
  }

  const allocs = (todaysAllocations as unknown as AllocationRow[]) ?? []

  const arrivedCount = allocs.filter((a) => a.attendance?.[0]?.status === 'arrived').length
  const noShowCount = allocs.filter((a) => a.attendance?.[0]?.status === 'no_show').length
  const awaitingCount = allocs.filter((a) => !a.attendance?.length).length

  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : 'Dashboard'}
        description={format(toZonedTime(new Date(), TZ), 'EEEE d MMMM yyyy')}
      />

      {/* ── Stats strip ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-px rounded-lg border border-border bg-background/40 overflow-hidden divide-x divide-border">
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-lg font-bold text-foreground tabular-nums">{totalOperatives ?? 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Operatives</span>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <span className="text-lg font-bold text-forest-400 tabular-nums">{contactableOperatives ?? 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Contactable</span>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-lg font-bold text-blue-400 tabular-nums">{activeSites ?? 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Sites</span>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <span className={`text-lg font-bold tabular-nums ${(openRequests ?? 0) > 0 ? 'text-amber-400' : 'text-muted-foreground'}`}>{openRequests ?? 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Requests</span>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <HardHat className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-lg font-bold text-foreground tabular-nums">{workingToday ?? 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Working</span>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <span className={`text-lg font-bold tabular-nums ${(openNcrs ?? 0) > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>{openNcrs ?? 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">NCRs</span>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <span className={`text-lg font-bold tabular-nums ${(pendingOffers ?? 0) > 0 ? 'text-purple-400' : 'text-muted-foreground'}`}>{pendingOffers ?? 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Offers</span>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <span className={`text-lg font-bold tabular-nums ${(docsAwaitingReview ?? 0) > 0 ? 'text-amber-400' : 'text-muted-foreground'}`}>{docsAwaitingReview ?? 0}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Docs Review</span>
        </div>
      </div>

      {/* ── Middle row: Compliance + Attendance ────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">

        {/* Compliance Alerts */}
        <div className="rounded-lg border border-border bg-background">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <h2 className="text-sm font-semibold text-muted-foreground">Compliance Alerts</h2>
            {totalCompliance > 0 && (
              <span className="rounded-full bg-red-900 px-2 py-0.5 text-xs font-medium text-red-300">
                {totalCompliance} issue{totalCompliance !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="divide-y divide-border">
            <ComplianceRow
              icon={FileX}
              label="Expired documents"
              count={expiredDocs ?? 0}
              severity="red"
              href="/documents?filter=expired"
            />
            <ComplianceRow
              icon={FileWarning}
              label="Expiring within 7 days"
              count={expiring7Days ?? 0}
              severity="red"
              href="/documents?filter=expiring-7"
            />
            <ComplianceRow
              icon={FileWarning}
              label="Expiring within 30 days"
              count={expiring30Days ?? 0}
              severity="amber"
              href="/documents?filter=expiring-30"
            />
            <ComplianceRow
              icon={ShieldAlert}
              label="Unverified RTW"
              count={unverifiedRtw ?? 0}
              severity="amber"
              href="/operatives?filter=unverified-rtw"
            />
            <ComplianceRow
              icon={UserX}
              label="Blocked operatives"
              count={blockedOperatives ?? 0}
              severity="red"
              href="/operatives?filter=blocked"
            />
          </div>
        </div>

        {/* Today's Attendance */}
        <div className="rounded-lg border border-border bg-background">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <h2 className="text-sm font-semibold text-muted-foreground">Today&apos;s Attendance</h2>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-forest-500" />
                {arrivedCount} arrived
              </span>
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-500" />
                {noShowCount} no show
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                {awaitingCount} awaiting
              </span>
            </div>
          </div>

          {allocs.length === 0 ? (
            <div className="p-3">
              <EmptyState
                icon={HardHat}
                title="No active allocations today"
                description="Active allocations will appear here"
              />
            </div>
          ) : (
            <div className="divide-y divide-border max-h-64 overflow-y-auto">
              {allocs.map((alloc) => {
                const attStatus = alloc.attendance?.[0]?.status
                return (
                  <div key={alloc.id} className="flex items-center justify-between px-4 py-2">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {alloc.operative?.first_name} {alloc.operative?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{alloc.site?.name ?? '—'}</p>
                    </div>
                    <StatusBadge status={attStatus ?? 'expected'} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Activity + Quick Actions ────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">

        {/* Recent Activity */}
        <div className="xl:col-span-2 rounded-lg border border-border bg-background">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <h2 className="text-sm font-semibold text-muted-foreground">Recent Activity</h2>
            <Link href="/activity" className="text-xs text-muted-foreground hover:text-muted-foreground transition-colors">
              View all →
            </Link>
          </div>

          {!recentNotifications || recentNotifications.length === 0 ? (
            <div className="p-3">
              <EmptyState
                icon={Bell}
                title="No recent activity"
                description="Platform activity will appear here"
              />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {collapseImports(recentNotifications as Array<{ id: string; type: string; title: string; body: string | null; severity: string; created_at: string }>).slice(0, 8).map((n) => {
                const dotColor =
                  n.severity === 'critical' ? 'bg-red-500' :
                  n.severity === 'warning' ? 'bg-amber-500' : 'bg-forest-500'
                return (
                  <div key={n.id} className="flex items-start gap-3 px-4 py-2">
                    <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${dotColor}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground truncate">{n.title}</p>
                      {n.body && <p className="text-xs text-muted-foreground truncate">{n.body}</p>}
                    </div>
                    <p className="text-xs text-muted-foreground shrink-0">
                      {format(toZonedTime(new Date(n.created_at), TZ), 'd MMM, HH:mm')}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="rounded-lg border border-border bg-background">
          <div className="px-4 py-2.5 border-b border-border">
            <h2 className="text-sm font-semibold text-muted-foreground">Quick Actions</h2>
          </div>
          <div className="p-3 space-y-1.5">
            <RapQuickAdd />
            <QuickAction href="/operatives/new" icon={Plus} label="Add Operative" />
            <QuickAction href="/requests/new" icon={Plus} label="Create Request" />
            <QuickAction href="/ncrs/new" icon={Plus} label="Log NCR" />
            <QuickAction href="/documents" icon={FileCheck} label="View Compliance" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ComplianceRow({
  icon: Icon,
  label,
  count,
  severity,
  href,
}: {
  icon: React.ElementType
  label: string
  count: number
  severity: 'red' | 'amber'
  href: string
}) {
  const colorClass =
    count > 0
      ? severity === 'red'
        ? 'text-red-400'
        : 'text-amber-400'
      : 'text-muted-foreground'

  return (
    <Link
      href={href}
      className="flex items-center justify-between px-4 py-2 hover:bg-card/50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <Icon className={`h-4 w-4 ${colorClass}`} />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span
        className={`text-sm font-semibold tabular-nums ${
          count > 0
            ? severity === 'red'
              ? 'text-red-400'
              : 'text-amber-400'
            : 'text-muted-foreground'
        }`}
      >
        {count}
      </span>
    </Link>
  )
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: React.ElementType
  label: string
}) {
  return (
    <Button
      asChild
      variant="outline"
      className="w-full justify-start gap-2 border-border text-muted-foreground hover:bg-card hover:text-foreground"
    >
      <Link href={href}>
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    </Button>
  )
}
