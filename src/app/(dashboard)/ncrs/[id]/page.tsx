import { createServiceClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/get-user-role'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, User, MapPin, Calendar, FileText, Clock } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { NcrResolveButton } from '@/components/ncrs/ncr-resolve-button'
import { NcrDetailActions } from '@/components/ncrs/ncr-detail-actions'
import { NcrCommentsSection } from '@/components/ncrs/ncr-comments-section'

const NCR_TYPE_LABELS: Record<string, string> = {
  no_show: 'No Show',
  walk_off: 'Walk Off',
  late_arrival: 'Late Arrival',
  safety_breach: 'Safety Breach',
  drugs_alcohol: 'Drugs / Alcohol',
  conduct_issue: 'Conduct Issue',
  poor_attitude: 'Poor Attitude',
  poor_workmanship: 'Poor Workmanship',
  other: 'Other',
}

const SEVERITY_CLASSES: Record<string, string> = {
  minor: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  major: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  critical: 'bg-red-500/10 text-red-600 border-red-500/20',
}

const SEVERITY_HEADER_BORDER: Record<string, string> = {
  minor: 'border-l-yellow-400',
  major: 'border-l-orange-400',
  critical: 'border-l-red-500',
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-36 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wide pt-0.5">{label}</span>
      <div className="text-sm">{children}</div>
    </div>
  )
}

export default async function NcrDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = createServiceClient()
  const svcSupabase = supabase
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!
  const role = await getUserRole()
  const canEdit = role === 'admin' || role === 'super_admin' || role === 'staff'

  const [{ data: ncr }, { data: comments }] = await Promise.all([
    supabase
      .from('non_conformance_incidents')
      .select(`
        *,
        operative:operatives!non_conformance_incidents_operative_id_fkey(id, first_name, last_name, reference_number, status),
        site:sites!non_conformance_incidents_site_id_fkey(id, name),
        allocation:allocations!non_conformance_incidents_allocation_id_fkey(id)
      `)
      .eq('id', id)
      .eq('organization_id', orgId)
      .single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svcSupabase as any)
      .from('ncr_comments')
      .select('id, author_name, comment, created_at')
      .eq('ncr_id', id)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true }),
  ])

  if (!ncr) notFound()

  const operative = ncr.operative as {
    id: string; first_name: string; last_name: string; reference_number: string | null; status: string | null
  } | null
  const site = ncr.site as { id: string; name: string } | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const incidentTime = (ncr as any).incident_time as string | null

  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title={`NCR — ${NCR_TYPE_LABELS[ncr.incident_type] ?? ncr.incident_type}`}
          description={ncr.reference_number ?? id.slice(0, 8).toUpperCase()}
        />
        <Link href="/ncrs" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      {/* Auto-block alert */}
      {ncr.auto_blocked && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            This operative was <strong>automatically blocked</strong> due to reaching the NCR threshold.
          </span>
        </div>
      )}

      {/* Status banner */}
      <div className={`flex items-center gap-3 rounded-lg border-l-4 border px-3 py-1.5 ${
        ncr.resolved
          ? 'border-green-500/20 bg-green-500/5 border-l-green-500'
          : `border-orange-500/20 bg-orange-500/5 ${SEVERITY_HEADER_BORDER[ncr.severity] ?? 'border-l-orange-400'}`
      }`}>
        <span className={`text-sm font-semibold ${ncr.resolved ? 'text-green-600' : 'text-orange-500'}`}>
          {ncr.resolved ? 'Resolved' : 'Open'}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded border capitalize ${SEVERITY_CLASSES[ncr.severity] ?? ''}`}>
          {ncr.severity}
        </span>
        {ncr.resolved && ncr.resolved_at && (
          <span className="text-xs text-muted-foreground">
            {new Date(ncr.resolved_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        )}
        {!ncr.resolved && (
          <div className="ml-auto flex items-center gap-2">
            {canEdit && (
              <NcrDetailActions
                ncrId={id}
                canEdit={canEdit}
                current={{
                  description: ncr.description ?? '',
                  incident_type: ncr.incident_type ?? 'other',
                  severity: ncr.severity ?? 'minor',
                  incident_date: ncr.incident_date ?? new Date().toISOString().split('T')[0],
                  incident_time: incidentTime,
                }}
              />
            )}
            <NcrResolveButton ncrId={id} />
          </div>
        )}
        {ncr.resolved && canEdit && (
          <div className="ml-auto">
            <NcrDetailActions
              ncrId={id}
              canEdit={canEdit}
              current={{
                description: ncr.description ?? '',
                incident_type: ncr.incident_type ?? 'other',
                severity: ncr.severity ?? 'minor',
                incident_date: ncr.incident_date ?? new Date().toISOString().split('T')[0],
                incident_time: incidentTime,
              }}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Incident details */}
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            <FileText className="h-3.5 w-3.5" />
            Incident
          </div>
          <InfoRow label="Type">
            {NCR_TYPE_LABELS[ncr.incident_type] ?? ncr.incident_type}
          </InfoRow>
          <InfoRow label="Severity">
            <span className={`text-xs font-medium px-2 py-0.5 rounded border capitalize ${SEVERITY_CLASSES[ncr.severity] ?? ''}`}>
              {ncr.severity}
            </span>
          </InfoRow>
          <InfoRow label="Date & Time">
            <span className="flex items-center gap-1 flex-wrap">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              {new Date(ncr.incident_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              {incidentTime && (
                <span className="flex items-center gap-1 ml-1 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {incidentTime}
                </span>
              )}
            </span>
          </InfoRow>
          {ncr.reporter_name && (
            <InfoRow label="Reported By">{ncr.reporter_name}</InfoRow>
          )}
          {ncr.witness_name && (
            <InfoRow label="Witness">{ncr.witness_name}</InfoRow>
          )}
          {ncr.reported_via && (
            <InfoRow label="Via">
              <span className="capitalize text-muted-foreground">{ncr.reported_via}</span>
            </InfoRow>
          )}
        </div>

        {/* People + place */}
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            <User className="h-3.5 w-3.5" />
            Parties
          </div>
          <InfoRow label="Operative">
            {operative ? (
              <Link href={`/operatives/${operative.id}`} className="hover:underline font-medium">
                {operative.first_name} {operative.last_name}
              </Link>
            ) : '—'}
            {operative?.reference_number && (
              <span className="ml-2 font-mono text-xs text-muted-foreground">{operative.reference_number}</span>
            )}
            {operative?.status === 'blocked' && (
              <span className="ml-2 text-xs bg-red-500/10 text-red-600 border border-red-500/20 rounded px-1">BLOCKED</span>
            )}
          </InfoRow>
          <InfoRow label="Site">
            {site ? (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <Link href={`/sites/${site.id}`} className="hover:underline">{site.name}</Link>
              </span>
            ) : '—'}
          </InfoRow>
          {ncr.allocation && (
            <InfoRow label="Allocation">
              <Link href={`/allocations/${(ncr.allocation as { id: string }).id}`} className="text-xs hover:underline text-muted-foreground font-mono">
                View allocation
              </Link>
            </InfoRow>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</p>
        <p className="text-sm whitespace-pre-wrap">{ncr.description}</p>
      </div>

      {/* Resolution notes */}
      {ncr.resolved && ncr.resolution_notes && (
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-600">Resolution</p>
          <p className="text-sm whitespace-pre-wrap">{ncr.resolution_notes}</p>
        </div>
      )}

      {/* Comments */}
      <NcrCommentsSection
        ncrId={id}
        comments={(comments ?? []) as unknown as Array<{ id: string; author_name: string; comment: string; created_at: string | null }>}
      />
    </div>
  )
}
