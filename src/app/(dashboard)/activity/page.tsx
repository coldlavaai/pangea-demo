import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/get-user-role'
import { PageHeader } from '@/components/page-header'
import { ActivityFeed } from '@/components/activity/activity-feed'

export default async function ActivityPage() {
  const role = await getUserRole()
  if (!role || role === 'auditor') redirect('/unauthorized')

  const supabase = createServiceClient()
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!

  const [{ data: notifications }, { data: emailLog }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('notifications') as any)
      .select('id, type, title, body, severity, operative_id, labour_request_id, ncr_id, link_url, read, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(200),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('email_log')
      .select('id, to_email, to_name, subject, template, status, error, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  // Normalise email_log rows into ActivityItem shape
  type EmailRow = { id: string; to_email: string; to_name: string | null; subject: string; template: string; status: string; error: string | null; created_at: string }
  const emailItems: ActivityItem[] = ((emailLog ?? []) as EmailRow[]).map(e => ({
    id: e.id,
    type: 'email_sent',
    title: e.subject,
    body: `To: ${e.to_name ? `${e.to_name} <${e.to_email}>` : e.to_email}${e.status === 'failed' ? ` · ⚠️ ${e.error ?? 'Failed'}` : ''}`,
    severity: e.status === 'failed' ? 'warning' : 'info',
    operative_id: null,
    labour_request_id: null,
    ncr_id: null,
    link_url: null,
    read: true, // email log items don't have an unread concept
    created_at: e.created_at,
  }))

  // Merge and sort by created_at desc
  const allItems = [...(notifications ?? []), ...emailItems]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 250)

  return (
    <div className="px-4 pt-2 pb-4 space-y-2 max-w-3xl">
      <PageHeader
        title="Activity"
        description="All platform events — site activity, applications, offers, and outgoing emails"
      />
      <ActivityFeed initialItems={allItems as ActivityItem[]} />
    </div>
  )
}

export interface ActivityItem {
  id: string
  type: string
  title: string
  body: string | null
  severity: 'info' | 'warning' | 'critical'
  operative_id: string | null
  labour_request_id: string | null
  ncr_id: string | null
  link_url: string | null
  read: boolean
  created_at: string
}
