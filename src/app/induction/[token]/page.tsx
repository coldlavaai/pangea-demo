import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import InductionForm from './induction-form'

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!

export const metadata = {
  title: 'Company Induction — Pangaea',
}

export default async function InductionPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = createServiceClient()

  const { data: allocation } = await supabase
    .from('allocations')
    .select(`
      id, induction_complete,
      operative:operatives!allocations_operative_id_fkey(first_name, last_name),
      site:sites!allocations_site_id_fkey(name)
    `)
    .eq('induction_token', token)
    .eq('organization_id', ORG_ID)
    .maybeSingle()

  if (!allocation) return notFound()

  const operative = allocation.operative as { first_name: string; last_name: string } | null
  const site = allocation.site as { name: string } | null
  const firstName = operative?.first_name ?? 'there'

  return (
    <div className="min-h-screen bg-background text-white">
      <div className="max-w-lg mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/20 shrink-0">
            <span className="text-[#D4AF37] font-bold text-base">A</span>
          </div>
          <div>
            <p className="font-bold text-foreground tracking-wide text-sm">PANGAEA</p>
            <p className="text-xs text-muted-foreground">Company Induction</p>
          </div>
        </div>

        {allocation.induction_complete ? (
          <div className="rounded-xl border border-forest-800/40 bg-forest-950/30 p-6 text-center space-y-4">
            <div className="text-4xl">✅</div>
            <h2 className="text-xl font-bold text-white">Already Completed</h2>
            <p className="text-muted-foreground text-sm">
              Your induction has already been recorded. No further action needed.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-background p-5">
              <h2 className="text-base font-semibold text-foreground mb-1">
                Hi {firstName} — welcome to Pangaea
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {site?.name ? `You are starting at ${site.name}. ` : ''}
                Please complete this short induction before your first day. It takes about 3 minutes.
              </p>
            </div>

            <InductionForm
              token={token}
              firstName={firstName}
              allocationId={allocation.id}
            />
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-8">
          Pangaea Limited · Company Induction Record
        </p>
      </div>
    </div>
  )
}
