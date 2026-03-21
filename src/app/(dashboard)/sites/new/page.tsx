import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { SiteForm } from '@/components/sites/site-form'

export default function NewSitePage() {
  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Add Site" description="Create a new construction site" />
        <Link href="/sites" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>
      <SiteForm mode="create" />
    </div>
  )
}
