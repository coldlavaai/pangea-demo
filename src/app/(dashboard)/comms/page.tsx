import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/get-user-role'
import { PageHeader } from '@/components/page-header'
import { CommsThreadList } from '@/components/comms/comms-thread-list'

export default async function CommsPage() {
  const role = await getUserRole()
  if (role === 'site_manager' || role === 'auditor') redirect('/unauthorized')
  const supabase = createServiceClient()
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!

  const { data: raw } = await supabase
    .from('message_threads')
    .select(`
      id,
      phone_number,
      operative_id,
      last_message,
      last_message_at,
      unread_count,
      intake_state,
      operative:operatives!message_threads_operative_id_fkey(
        id, first_name, last_name, reference_number, status
      )
    `)
    .eq('organization_id', orgId)
    .not('phone_number', 'like', 'tg:%')
    .order('last_message_at', { ascending: false, nullsFirst: false })

  // Drop threads where the operative was deleted (operative_id set but join returns null)
  const threads = (raw ?? []).filter(t => !(t.operative_id && !t.operative))

  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      <PageHeader
        title="WhatsApp"
        description="Conversation log — all inbound and outbound messages"
      />
      <CommsThreadList threads={threads as Parameters<typeof CommsThreadList>[0]['threads']} />
    </div>
  )
}
