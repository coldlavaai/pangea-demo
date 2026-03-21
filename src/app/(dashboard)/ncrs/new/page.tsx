import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { NcrForm } from '@/components/ncrs/ncr-form'

export default async function NewNcrPage({
  searchParams,
}: {
  searchParams: Promise<{ operative_id?: string; site_id?: string }>
}) {
  const { operative_id, site_id } = await searchParams
  const supabase = await createClient()
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!

  const [{ data: operatives }, { data: sites }] = await Promise.all([
    supabase
      .from('operatives')
      .select('id, first_name, last_name, reference_number')
      .eq('organization_id', orgId)
      .not('status', 'eq', 'blocked')
      .order('last_name'),
    supabase
      .from('sites')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('name'),
  ])

  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Raise NCR" description="Record a non-conformance incident" />
        <Link href="/ncrs" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>
      <NcrForm
        operatives={operatives ?? []}
        sites={sites ?? []}
        defaultOperativeId={operative_id}
        defaultSiteId={site_id}
      />
    </div>
  )
}
