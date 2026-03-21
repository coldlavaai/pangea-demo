import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/get-user-role'
import { PageHeader } from '@/components/page-header'
import { OperativeForm } from '@/components/operatives/operative-form'

export default async function NewOperativePage() {
  const role = await getUserRole()
  if (role === 'site_manager' || role === 'auditor') redirect('/unauthorized')
  const supabase = await createClient()
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!

  const { data: tradeCategories } = await supabase
    .from('trade_categories')
    .select('id, name')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('name')

  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      <PageHeader
        title="Add Operative"
        description="Create a new operative record"
      />
      <OperativeForm
        mode="create"
        tradeCategories={tradeCategories ?? []}
      />
    </div>
  )
}
