import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Phone, Mail, Pencil, Building2, Users, Calendar, PoundSterling, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

type Tab = 'overview' | 'allocations' | 'managers'

export default async function SiteDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { tab = 'overview' } = await searchParams
  const activeTab = tab as Tab

  const supabase = createServiceClient()
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!

  const [
    { data: site },
    { data: managers },
    { data: allocations },
  ] = await Promise.all([
    supabase.from('sites').select('*').eq('id', id).eq('organization_id', orgId).single(),
    supabase.from('site_managers').select('*').eq('site_id', id).order('is_primary', { ascending: false }),
    supabase
      .from('allocations')
      .select(`
        id, status, start_date, end_date, agreed_day_rate,
        operative:operatives!allocations_operative_id_fkey(first_name, last_name, reference_number)
      `)
      .eq('site_id', id)
      .order('start_date', { ascending: false })
      .limit(50),
  ])

  if (!site) notFound()

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'managers', label: `Managers (${managers?.length ?? 0})` },
    { key: 'allocations', label: `Allocations (${allocations?.length ?? 0})` },
  ]

  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <PageHeader
            title={site.name}
            description={`${site.address}, ${site.postcode}`}
          />
          <span
            className={`mt-2 inline-flex items-center px-2.5 py-1 rounded text-sm font-medium ${
              site.is_active
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {site.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button asChild variant="outline" size="sm">
            <Link href={`/sites/${id}/edit`}>
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/sites">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <nav className="flex gap-1 border-b">
        {tabs.map(({ key, label }) => (
          <Link
            key={key}
            href={`/sites/${id}?tab=${key}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab site={site} />}
      {activeTab === 'managers' && <ManagersTab siteId={id} managers={managers ?? []} />}
      {activeTab === 'allocations' && <AllocationsTab allocations={allocations ?? []} />}
    </div>
  )
}

// ── Overview Tab ───────────────────────────────────────────────────────────────

function InfoCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  )
}

function OverviewTab({ site }: { site: { [key: string]: unknown } & Record<string, unknown> }) {
  const s = site as {
    address: string; postcode: string; contact_phone: string | null
    site_manager_name: string | null; site_manager_phone: string | null; site_manager_email: string | null
    project_value: number | null; project_start_date: string | null; project_end_date: string | null
    main_duties: string | null; notes: string | null; lat: number | null; lng: number | null
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Location */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2 font-medium">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          Location
        </div>
        <div className="space-y-3">
          <InfoCard label="Address">{s.address}</InfoCard>
          <InfoCard label="Postcode"><span className="font-mono">{s.postcode}</span></InfoCard>
          {s.contact_phone && <InfoCard label="Contact Phone">{s.contact_phone}</InfoCard>}
          {s.lat && s.lng && (
            <InfoCard label="Coordinates">
              <span className="font-mono text-xs">{s.lat}, {s.lng}</span>
            </InfoCard>
          )}
        </div>
      </div>

      {/* Primary Manager */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2 font-medium">
          <Users className="h-4 w-4 text-muted-foreground" />
          Primary Manager
        </div>
        {s.site_manager_name ? (
          <div className="space-y-3">
            <InfoCard label="Name">{s.site_manager_name}</InfoCard>
            {s.site_manager_phone && (
              <InfoCard label="Phone">
                <a href={`tel:${s.site_manager_phone}`} className="hover:underline flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {s.site_manager_phone}
                </a>
              </InfoCard>
            )}
            {s.site_manager_email && (
              <InfoCard label="Email">
                <a href={`mailto:${s.site_manager_email}`} className="hover:underline flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {s.site_manager_email}
                </a>
              </InfoCard>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No manager assigned</p>
        )}
      </div>

      {/* Project Details */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2 font-medium">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          Project Details
        </div>
        <div className="space-y-3">
          {s.project_value != null && (
            <InfoCard label="Contract Value">
              <span className="flex items-center gap-1">
                <PoundSterling className="h-3 w-3" />
                {Number(s.project_value).toLocaleString()}
              </span>
            </InfoCard>
          )}
          {s.project_start_date && (
            <InfoCard label="Start Date">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(s.project_start_date).toLocaleDateString('en-GB')}
              </span>
            </InfoCard>
          )}
          {s.project_end_date && (
            <InfoCard label="End Date">
              {new Date(s.project_end_date).toLocaleDateString('en-GB')}
            </InfoCard>
          )}
          {s.main_duties && <InfoCard label="Main Duties">{s.main_duties}</InfoCard>}
        </div>
      </div>

      {/* Notes */}
      {s.notes && (
        <div className="rounded-lg border bg-card p-5 space-y-2">
          <p className="font-medium">Notes</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{s.notes}</p>
        </div>
      )}
    </div>
  )
}

// ── Managers Tab ───────────────────────────────────────────────────────────────

type Manager = { id: string; name: string; phone: string; email: string | null; is_primary: boolean | null; is_active: boolean | null }

function ManagersTab({ siteId, managers }: { siteId: string; managers: Manager[] }) {
  if (managers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Users className="h-8 w-8 mx-auto mb-3 opacity-40" />
        <p>No managers added yet.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href={`/sites/${siteId}/edit`}>Edit site to add managers</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {managers.map((m) => (
        <div key={m.id} className="rounded-lg border bg-card p-4 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{m.name}</span>
              {m.is_primary && (
                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">Primary</span>
              )}
              {!m.is_active && (
                <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Inactive</span>
              )}
            </div>
            <a href={`tel:${m.phone}`} className="text-sm text-muted-foreground hover:underline flex items-center gap-1">
              <Phone className="h-3 w-3" />{m.phone}
            </a>
            {m.email && (
              <a href={`mailto:${m.email}`} className="text-sm text-muted-foreground hover:underline flex items-center gap-1">
                <Mail className="h-3 w-3" />{m.email}
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Allocations Tab ─────────────────────────────────────────────────────────────

type Allocation = {
  id: string
  status: string | null
  start_date: string
  end_date: string | null
  agreed_day_rate: number | null
  operative: { first_name: string; last_name: string; reference_number: string | null } | null
}

function AllocationsTab({ allocations }: { allocations: Allocation[] }) {
  if (allocations.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Calendar className="h-8 w-8 mx-auto mb-3 opacity-40" />
        <p>No allocations yet.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="text-left px-3 py-1.5 font-medium">Operative</th>
            <th className="text-left px-3 py-1.5 font-medium">Dates</th>
            <th className="text-left px-3 py-1.5 font-medium">Day Rate</th>
            <th className="text-left px-3 py-1.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {allocations.map((a) => (
            <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="px-3 py-1.5">
                {a.operative ? (
                  <div>
                    <div className="font-medium">{a.operative.first_name} {a.operative.last_name}</div>
                    {a.operative.reference_number && (
                      <div className="text-xs text-muted-foreground font-mono">{a.operative.reference_number}</div>
                    )}
                  </div>
                ) : '—'}
              </td>
              <td className="px-3 py-1.5 text-muted-foreground">
                {new Date(a.start_date).toLocaleDateString('en-GB')}
                {a.end_date && ` → ${new Date(a.end_date).toLocaleDateString('en-GB')}`}
              </td>
              <td className="px-3 py-1.5">
                {a.agreed_day_rate != null ? `£${Number(a.agreed_day_rate).toFixed(2)}` : '—'}
              </td>
              <td className="px-3 py-1.5">
                <StatusBadge status={a.status ?? 'pending'} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
