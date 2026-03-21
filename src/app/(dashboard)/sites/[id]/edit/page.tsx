import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { SiteForm } from '@/components/sites/site-form'

export default async function EditSitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!

  const [{ data: site }, { data: managers }] = await Promise.all([
    supabase.from('sites').select('*').eq('id', id).eq('organization_id', orgId).single(),
    supabase.from('site_managers').select('*').eq('site_id', id).order('is_primary', { ascending: false }),
  ])

  if (!site) notFound()

  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <PageHeader title={`Edit — ${site.name}`} description="Update site details and managers" />
        <Link href={`/sites/${id}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>
      <SiteForm mode="edit" site={site} managers={managers ?? []} />
    </div>
  )
}
