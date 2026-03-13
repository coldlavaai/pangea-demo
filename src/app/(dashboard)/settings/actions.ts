'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/get-user-role'
import { revalidatePath } from 'next/cache'

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!

async function assertAdmin() {
  const role = await getUserRole()
  if (role !== 'admin' && role !== 'super_admin') throw new Error('Unauthorized')
}

export async function updateUserRole(userId: string, role: string) {
  await assertAdmin()
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('users')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ role: role as any })
    .eq('id', userId)
  if (error) throw new Error(error.message)
  revalidatePath('/settings')
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  await assertAdmin()
  const supabase = createServiceClient()
  const { error } = await supabase.from('users').update({ is_active: isActive }).eq('id', userId)
  if (error) throw new Error(error.message)
  revalidatePath('/settings')
}

export async function updateUserDetails(userId: string, data: {
  first_name: string
  last_name: string
  phone_number: string | null
  telegram_chat_id: number | null
}) {
  await assertAdmin()
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('users') as any).update({
    first_name: data.first_name,
    last_name: data.last_name,
    phone_number: data.phone_number || null,
    telegram_chat_id: data.telegram_chat_id,
  }).eq('id', userId)
  if (error) throw new Error(error.message)
  revalidatePath('/settings')
}

export async function deleteUser(userId: string) {
  await assertAdmin()
  const supabase = createServiceClient()

  // Get auth_user_id before deleting
  const { data: user } = await supabase.from('users').select('auth_user_id').eq('id', userId).single()

  // Null out every FK reference to this user across all tables
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  await Promise.all([
    db.from('documents').update({ verified_by: null }).eq('verified_by', userId),
    db.from('labour_requests').update({ requested_by: null }).eq('requested_by', userId),
    db.from('allocations').update({ allocated_by: null }).eq('allocated_by', userId),
    db.from('timesheets').update({ submitted_by: null }).eq('submitted_by', userId),
    db.from('timesheets').update({ approved_by: null }).eq('approved_by', userId),
    db.from('timesheets').update({ locked_by: null }).eq('locked_by', userId),
    db.from('performance_reviews').update({ reviewer_id: null }).eq('reviewer_id', userId),
    db.from('non_conformance_incidents').update({ reported_by: null }).eq('reported_by', userId),
    db.from('non_conformance_incidents').update({ resolved_by: null }).eq('resolved_by', userId),
    db.from('ncr_comments').update({ user_id: null }).eq('user_id', userId),
    db.from('audit_log').update({ user_id: null }).eq('user_id', userId),
    db.from('alerts').update({ read_by: null }).eq('read_by', userId),
    db.from('advert_templates').update({ created_by: null }).eq('created_by', userId),
    db.from('adverts').update({ created_by: null }).eq('created_by', userId),
    db.from('operatives').update({ created_by: null }).eq('created_by', userId),
    db.from('message_threads').update({ staff_user_id: null }).eq('staff_user_id', userId),
    db.from('user_sites').delete().eq('user_id', userId),
  ])

  // Delete public.users row
  const { error } = await supabase.from('users').delete().eq('id', userId)
  if (error) throw new Error(error.message)

  // Delete Supabase Auth user if linked
  if (user?.auth_user_id) {
    await supabase.auth.admin.deleteUser(user.auth_user_id)
  }

  revalidatePath('/settings')
}

export async function toggleReceiveNotifications(userId: string, value: boolean) {
  await assertAdmin()
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('users') as any).update({ receive_notifications: value }).eq('id', userId)
  if (error) throw new Error(error.message)
  revalidatePath('/settings')
}

export async function addUserSite(userId: string, siteId: string, orgId: string) {
  await assertAdmin()
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('user_sites')
    .insert({ user_id: userId, site_id: siteId, organization_id: orgId })
  if (error && error.code !== '23505') throw new Error(error.message) // ignore duplicate
  revalidatePath('/settings')
}

export async function removeUserSite(userId: string, siteId: string) {
  await assertAdmin()
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('user_sites')
    .delete()
    .eq('user_id', userId)
    .eq('site_id', siteId)
  if (error) throw new Error(error.message)
  revalidatePath('/settings')
}

export async function inviteUser(data: {
  first_name: string
  last_name: string
  email: string
  role: string
  phone_number?: string
  site_ids?: string[]
}): Promise<{ error?: string; link?: string; role?: string }> {
  try {
    await assertAdmin()
  } catch {
    return { error: 'Unauthorized' }
  }

  const supabase = createServiceClient()

  // Pre-check: email already exists in this org?
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('organization_id', ORG_ID)
    .ilike('email', data.email)
    .maybeSingle()
  if (existing) return { error: 'A user with this email already exists.' }

  // Generate invite link — no email sent, no rate limits
  const { data: linkData, error: authError } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email: data.email,
    options: { data: { first_name: data.first_name, last_name: data.last_name } },
  })
  if (authError) return { error: authError.message }

  const authUserId = linkData.user.id

  // Upsert public.users row — handles any pre-existing row (triggers, retries, etc.)
  const { data: user, error: userError } = await supabase
    .from('users')
    .upsert(
      {
        organization_id: ORG_ID,
        auth_user_id: authUserId,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        role: data.role as any,
        phone_number: data.phone_number || null,
        is_active: true,
      },
      { onConflict: 'auth_user_id' }
    )
    .select('id')
    .single()

  if (userError) {
    await supabase.auth.admin.deleteUser(authUserId).catch(() => {})
    return { error: userError.message }
  }

  // Assign sites for site_manager
  if (data.role === 'site_manager' && data.site_ids && data.site_ids.length > 0) {
    await supabase.from('user_sites').insert(
      data.site_ids.map((siteId) => ({
        user_id: user.id,
        site_id: siteId,
        organization_id: ORG_ID,
      }))
    )
  }

  revalidatePath('/settings')

  // Build clean invite link through our domain (hides supabase.co URL)
  const rawLink = linkData.properties.action_link
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pangaea-demo.vercel.app'
  let cleanLink = rawLink
  try {
    const parsed = new URL(rawLink)
    const token = parsed.searchParams.get('token')
    if (token) cleanLink = `${appUrl}/join?token=${encodeURIComponent(token)}`
  } catch { /* keep rawLink */ }

  // Send invite email
  const { sendInviteEmail } = await import('@/lib/email/send')
  await sendInviteEmail({
    to: data.email,
    firstName: data.first_name,
    role: data.role,
    inviteLink: cleanLink,
    isSiteManager: data.role === 'site_manager',
  }).catch((e) => console.error('[inviteUser] email send failed:', e))

  // Send WhatsApp if phone provided and template configured
  const inviteSid = process.env.PANGAEA_USER_INVITE_SID
  if (data.phone_number && inviteSid) {
    const { sendWhatsAppTemplate } = await import('@/lib/whatsapp/send')
    await sendWhatsAppTemplate(data.phone_number, inviteSid, {
      '1': data.first_name,
      '2': ROLE_LABELS[data.role] ?? data.role,
      '3': data.role === 'site_manager'
        ? `Message @PangaeaSiteBot on Telegram with your email (${data.email}) to get started. Set your password: ${cleanLink}`
        : cleanLink,
    }).catch((e) => console.error('[inviteUser] WhatsApp send failed:', e))
  }

  return { link: cleanLink, role: data.role }
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  staff: 'Staff',
  site_manager: 'Site Manager',
  auditor: 'Auditor',
  director: 'Director',
  labour_manager: 'Labour Manager',
  project_manager: 'Project Manager',
}

export async function saveEmailTemplate(templateKey: string, subject: string, bodyHtml: string) {
  await assertAdmin()
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('email_templates').upsert(
    {
      organization_id: ORG_ID,
      template_key: templateKey,
      subject,
      body_html: bodyHtml,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'organization_id,template_key' }
  )
  if (error) throw new Error(error.message)
  revalidatePath('/settings')
}

export async function resetEmailTemplate(templateKey: string) {
  await assertAdmin()
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('email_templates')
    .delete()
    .eq('organization_id', ORG_ID)
    .eq('template_key', templateKey)
  revalidatePath('/settings')
}

export async function updateUserPhone(userId: string, phone: string | null) {
  await assertAdmin()
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('users')
    .update({ phone_number: phone || null })
    .eq('id', userId)
  if (error) throw new Error(error.message)
  revalidatePath('/settings')
}

