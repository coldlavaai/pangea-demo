import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { RequestForm } from '@/components/requests/request-form'

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ site_id?: string }>
}) {
  const { site_id } = await searchParams
  const supabase = await createClient()
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!

  const [{ data: sites }, { data: tradeCategories }] = await Promise.all([
    supabase.from('sites').select('id, name').eq('organization_id', orgId).eq('is_active', true).order('name'),
    supabase.from('trade_categories').select('id, name').eq('organization_id', orgId).order('name'),
  ])

  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="New Labour Request" description="Request operatives for a site" />
        <Link href="/requests" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>
      <RequestForm
        mode="create"
        sites={sites ?? []}
        tradeCategories={tradeCategories ?? []}
        defaultSiteId={site_id}
      />
    </div>
  )
}
