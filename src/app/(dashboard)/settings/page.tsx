import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/get-user-role'
import { PageHeader } from '@/components/page-header'
import { SettingsTabs } from '@/components/settings/settings-tabs'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; connected?: string; error?: string }>
}) {
  const role = await getUserRole()
  if (role !== 'admin' && role !== 'super_admin') redirect('/unauthorized')

  const supabase = await createClient()
  const serviceSupabase = createServiceClient()
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!
  const params = await searchParams

  const { data: { user: authUser } } = await supabase.auth.getUser()

  const [{ data: org }, { data: trades }, { data: users }, { data: sites }, { data: userSites }, { data: emailIntegration }, { data: savedTemplates }] = await Promise.all([
    serviceSupabase.from('organizations').select('id, name, slug, settings').eq('id', orgId).single(),
    serviceSupabase.from('trade_categories').select('*').eq('organization_id', orgId).order('sort_order').order('name'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (serviceSupabase.from('users') as any).select('id, first_name, last_name, email, role, is_active, created_at, phone_number, auth_user_id, receive_notifications, telegram_chat_id').eq('organization_id', orgId).order('first_name'),
    serviceSupabase.from('sites').select('id, name').eq('organization_id', orgId).neq('is_active', false).order('name'),
    serviceSupabase.from('user_sites').select('user_id, site_id').eq('organization_id', orgId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (serviceSupabase as any).from('email_integrations')
      .select('email_address, display_name, token_expires_at, updated_at')
      .eq('organization_id', orgId)
      .eq('provider', 'outlook')
      .maybeSingle(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (serviceSupabase as any).from('email_templates')
      .select('template_key, subject, body_html')
      .eq('organization_id', orgId),
  ])

  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      <PageHeader title="Settings" description="Organisation configuration and management" />
      <SettingsTabs
        orgId={orgId}
        currentAuthUserId={authUser?.id ?? ''}
        org={{
          id: orgId,
          name: org?.name ?? '',
          slug: org?.slug ?? '',
          settings: (org?.settings ?? {}) as Record<string, unknown>,
        }}
        trades={(trades ?? []) as Parameters<typeof SettingsTabs>[0]['trades']}
        users={(users ?? []) as Parameters<typeof SettingsTabs>[0]['users']}
        sites={(sites ?? []) as Parameters<typeof SettingsTabs>[0]['sites']}
        userSites={(userSites ?? []) as Parameters<typeof SettingsTabs>[0]['userSites']}
        emailIntegration={emailIntegration ?? null}
        savedTemplates={(savedTemplates ?? []) as Parameters<typeof SettingsTabs>[0]['savedTemplates']}
        defaultTab={params.tab}
      />
    </div>
  )
}
