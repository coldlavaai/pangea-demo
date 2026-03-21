import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/get-user-role'
import { MessageSquare } from 'lucide-react'
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

  const totalThreads = threads.length
  const unreadThreads = threads.filter(t => (t.unread_count ?? 0) > 0).length
  const intakeThreads = threads.filter(t => t.intake_state && t.intake_state !== 'complete').length

  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      <PageHeader
        title="WhatsApp"
        description="Conversation log — all inbound and outbound messages"
      />

      <div className="flex items-center gap-px rounded-lg border border-border bg-background/40 overflow-hidden divide-x divide-border">
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-lg font-bold text-foreground tabular-nums">{totalThreads}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Threads</span>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <span className={`text-lg font-bold tabular-nums ${unreadThreads > 0 ? 'text-amber-400' : 'text-muted-foreground'}`}>{unreadThreads}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Unread</span>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 flex-1">
          <span className={`text-lg font-bold tabular-nums ${intakeThreads > 0 ? 'text-blue-400' : 'text-muted-foreground'}`}>{intakeThreads}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">In Intake</span>
        </div>
      </div>
      <CommsThreadList threads={threads as Parameters<typeof CommsThreadList>[0]['threads']} />
    </div>
  )
}
