import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { RequestForm } from '@/components/requests/request-form'

export default async function EditRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!

  const [{ data: req }, { data: sites }, { data: tradeCategories }] = await Promise.all([
    supabase.from('labour_requests').select('*').eq('id', id).eq('organization_id', orgId).single(),
    supabase.from('sites').select('id, name').eq('organization_id', orgId).eq('is_active', true).order('name'),
    supabase.from('trade_categories').select('id, name').eq('organization_id', orgId).order('name'),
  ])

  if (!req) notFound()

  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Edit Request" description="Update labour request details" />
        <Link href={`/requests/${id}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>
      <RequestForm
        mode="edit"
        sites={sites ?? []}
        tradeCategories={tradeCategories ?? []}
        request={req}
      />
    </div>
  )
}
