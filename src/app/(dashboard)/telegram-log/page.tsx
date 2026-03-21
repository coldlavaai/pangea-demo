import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/get-user-role'
import { PageHeader } from '@/components/page-header'
import Link from 'next/link'
import { MessageSquare, ChevronRight, User, Clock } from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  staff: 'Staff',
  site_manager: 'Site Manager',
  auditor: 'Auditor',
  director: 'Director',
  labour_manager: 'Labour Manager',
  project_manager: 'Project Manager',
}

export default async function TelegramLogPage() {
  const role = await getUserRole()
  if (role !== 'admin' && role !== 'super_admin' && role !== 'staff') redirect('/unauthorized')

  const supabase = createServiceClient()
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!

  // Get all staff users with a telegram_chat_id set
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: staffUsers } = await (supabase as any)
    .from('users')
    .select('id, first_name, last_name, role, telegram_chat_id')
    .eq('organization_id', orgId)
    .not('telegram_chat_id', 'is', null)
    .order('first_name')

  const typedStaff = (staffUsers ?? []) as Array<{ id: string; first_name: string; last_name: string; role: string; telegram_chat_id: number }>

  if (typedStaff.length === 0) {
    return (
      <div className="px-4 pt-2 pb-4 space-y-2">
        <PageHeader
          title="Telegram Conversations"
          description="All staff Telegram bot interactions"
        />
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground text-sm">
          No staff members have verified on Telegram yet.
        </div>
      </div>
    )
  }

  // Get threads for all verified Telegram users
  const chatIds = typedStaff.map(u => `tg:${u.telegram_chat_id}`)

  const { data: threads } = await supabase
    .from('message_threads')
    .select('id, phone_number, last_message, last_message_at, unread_count')
    .eq('organization_id', orgId)
    .in('phone_number', chatIds)

  const threadMap = Object.fromEntries(
    (threads ?? []).map(t => [t.phone_number, t])
  )

  // Get message counts per thread
  const threadIds = (threads ?? []).map(t => t.id)
  const { data: countRows } = threadIds.length
    ? await supabase
        .from('messages')
        .select('thread_id')
        .in('thread_id', threadIds)
    : { data: [] }

  const countMap: Record<string, number> = {}
  for (const row of countRows ?? []) {
    if (row.thread_id) countMap[row.thread_id] = (countMap[row.thread_id] ?? 0) + 1
  }

  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      <PageHeader
        title="Telegram Conversations"
        description="All staff Telegram bot interactions — full audit trail"
      />

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="border-b bg-muted/40 px-4 py-3 grid grid-cols-[1fr_2fr_auto_auto] gap-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <span>Staff Member</span>
          <span>Last Message</span>
          <span>Messages</span>
          <span />
        </div>

        {typedStaff.map((u) => {
          const tgPhone = `tg:${u.telegram_chat_id}`
          const thread = threadMap[tgPhone]
          const msgCount = thread ? (countMap[thread.id] ?? 0) : 0

          return (
            <div
              key={u.id}
              className="grid grid-cols-[1fr_2fr_auto_auto] gap-4 px-4 py-3 border-b last:border-0 items-center hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="font-medium text-sm">{u.first_name} {u.last_name}</p>
                  <p className="text-xs text-muted-foreground">{ROLE_LABELS[u.role] ?? u.role}</p>
                </div>
              </div>

              <div className="min-w-0">
                {thread?.last_message ? (
                  <>
                    <p className="text-sm truncate text-muted-foreground">{thread.last_message}</p>
                    {thread.last_message_at && (
                      <p className="text-xs text-muted-foreground/60 flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {new Date(thread.last_message_at).toLocaleString('en-GB', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground/50">No messages yet</span>
                )}
              </div>

              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                {msgCount}
              </div>

              <div>
                {thread ? (
                  <Link
                    href={`/telegram-log/${thread.id}`}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    View
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground/40">No thread</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
