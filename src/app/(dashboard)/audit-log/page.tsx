import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/get-user-role'
import { PageHeader } from '@/components/page-header'
import { AuditLogTable } from '@/components/audit-log/audit-log-table'

export default async function AuditLogPage() {
  const role = await getUserRole()
  if (role !== 'admin' && role !== 'super_admin' && role !== 'auditor') redirect('/unauthorized')

  const supabase = createServiceClient()
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!

  const { data: entries } = await supabase
    .from('audit_log')
    .select('id, table_name, record_id, action, old_values, new_values, user_id, changed_by_role, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(200)

  // Fetch user names for display
  const userIds = [...new Set((entries ?? []).map((e) => e.user_id).filter(Boolean))]
  const { data: users } = userIds.length
    ? await supabase
        .from('users')
        .select('id, first_name, last_name')
        .in('id', userIds as string[])
    : { data: [] }

  const userMap = Object.fromEntries(
    (users ?? []).map((u) => [u.id, `${u.first_name} ${u.last_name}`])
  )

  // Fetch operative names to resolve operative_id in allocations/timesheets
  const { data: operatives } = await supabase
    .from('operatives')
    .select('id, first_name, last_name')
    .eq('organization_id', orgId)

  const operativeMap = Object.fromEntries(
    (operatives ?? []).map((o) => [o.id, `${o.first_name} ${o.last_name}`])
  )

  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      <PageHeader
        title="Audit Log"
        description="Full change history — every insert, update and delete across key tables"
      />
      <AuditLogTable
        entries={(entries ?? []) as Parameters<typeof AuditLogTable>[0]['entries']}
        userMap={userMap}
        operativeMap={operativeMap}
      />
    </div>
  )
}
