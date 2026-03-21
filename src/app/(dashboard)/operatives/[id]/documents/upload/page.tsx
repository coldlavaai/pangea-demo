import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { DocumentUploadForm } from '@/components/documents/document-upload-form'

export default async function UploadDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!

  const { data: operative } = await supabase
    .from('operatives')
    .select('id, first_name, last_name')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()

  if (!operative) notFound()

  const name = `${operative.first_name} ${operative.last_name}`

  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Upload Document"
          description={`Adding document for ${name}`}
        />
        <Link
          href={`/operatives/${id}?tab=documents`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>
      <DocumentUploadForm operativeId={id} operativeName={name} />
    </div>
  )
}
