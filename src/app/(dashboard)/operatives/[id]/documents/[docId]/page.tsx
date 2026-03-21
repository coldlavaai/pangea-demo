import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, FileText } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { DocumentActions } from '@/components/documents/document-actions'

const DOC_TYPE_LABELS: Record<string, string> = {
  right_to_work: 'Right to Work',
  photo_id: 'Photo ID',
  cscs_card: 'CSCS Card',
  cpcs_ticket: 'CPCS Ticket',
  npors_ticket: 'NPORS Ticket',
  lantra_cert: 'Lantra Certificate',
  first_aid: 'First Aid',
  asbestos_awareness: 'Asbestos Awareness',
  chainsaw_cs30: 'Chainsaw CS30',
  chainsaw_cs31: 'Chainsaw CS31',
  cv: 'CV',
  other: 'Other',
}

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string; docId: string }>
}) {
  const { id, docId } = await params
  const supabase = await createClient()
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!

  const [{ data: doc }, { data: operative }] = await Promise.all([
    supabase
      .from('documents')
      .select('*')
      .eq('id', docId)
      .eq('operative_id', id)
      .eq('organization_id', orgId)
      .single(),
    supabase
      .from('operatives')
      .select('id, first_name, last_name, id_document_number, id_expiry, date_of_birth, nationality, cscs_card_number, cscs_card_type, cscs_expiry, cscs_card_title')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single(),
  ])

  if (!doc || !operative) notFound()

  // Generate a fresh signed URL for viewing (1 hour) — service client bypasses bucket RLS
  let viewUrl = doc.file_url
  if (doc.file_key) {
    const serviceSupabase = createServiceClient()
    const { data: signed } = await serviceSupabase.storage
      .from('operative-documents')
      .createSignedUrl(doc.file_key, 3600)
    if (signed?.signedUrl) viewUrl = signed.signedUrl
  }

  const operativeName = `${operative.first_name} ${operative.last_name}`
  const today = new Date().toISOString().slice(0, 10)
  const isExpired = doc.expiry_date && doc.expiry_date < today

  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title={DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
          description={operativeName}
        />
        <Link
          href={`/operatives/${id}?tab=documents`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Metadata */}
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="font-medium">Details</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</dt>
              <dd className="mt-0.5">{DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</dt>
              <dd className="mt-0.5">
                <StatusBadge status={doc.status ?? 'pending'} />
              </dd>
            </div>
            {doc.expiry_date && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Expiry Date</dt>
                <dd className={`mt-0.5 ${isExpired ? 'text-red-500 font-medium' : ''}`}>
                  {new Date(doc.expiry_date).toLocaleDateString('en-GB')}
                  {isExpired && ' — EXPIRED'}
                </dd>
              </div>
            )}
            {doc.rtw_share_code && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Share Code</dt>
                <dd className="mt-0.5 font-mono">{doc.rtw_share_code}</dd>
              </div>
            )}
            {doc.notes && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</dt>
                <dd className="mt-0.5 text-muted-foreground">{doc.notes}</dd>
              </div>
            )}
            {doc.rejection_reason && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rejection Reason</dt>
                <dd className="mt-0.5 text-red-500">{doc.rejection_reason}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Uploaded</dt>
              <dd className="mt-0.5">{new Date(doc.created_at!).toLocaleDateString('en-GB')}</dd>
            </div>

            {/* Extracted data — photo_id */}
            {doc.document_type === 'photo_id' && (operative.id_document_number || operative.date_of_birth || operative.nationality || operative.id_expiry) && (
              <>
                <div className="border-t pt-3 mt-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Extracted by AI</p>
                </div>
                {operative.id_document_number && (
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Document No.</dt>
                    <dd className="mt-0.5 font-mono text-sm">{operative.id_document_number}</dd>
                  </div>
                )}
                {operative.date_of_birth && (
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date of Birth</dt>
                    <dd className="mt-0.5">{new Date(operative.date_of_birth).toLocaleDateString('en-GB')}</dd>
                  </div>
                )}
                {operative.nationality && (
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nationality</dt>
                    <dd className="mt-0.5">{operative.nationality}</dd>
                  </div>
                )}
                {operative.id_expiry && (
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">ID Expiry</dt>
                    <dd className="mt-0.5">{new Date(operative.id_expiry).toLocaleDateString('en-GB')}</dd>
                  </div>
                )}
              </>
            )}

            {/* Extracted data — cscs_card */}
            {doc.document_type === 'cscs_card' && (operative.cscs_card_number || operative.cscs_card_type || operative.cscs_expiry || operative.cscs_card_title) && (
              <>
                <div className="border-t pt-3 mt-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Extracted by AI</p>
                </div>
                {operative.cscs_card_number && (
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Card Number</dt>
                    <dd className="mt-0.5 font-mono text-sm">{operative.cscs_card_number}</dd>
                  </div>
                )}
                {operative.cscs_card_type && (
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Card Colour</dt>
                    <dd className="mt-0.5 capitalize">{operative.cscs_card_type}</dd>
                  </div>
                )}
                {operative.cscs_card_title && (
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Card Title</dt>
                    <dd className="mt-0.5">{operative.cscs_card_title}</dd>
                  </div>
                )}
                {operative.cscs_expiry && (
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Expiry</dt>
                    <dd className="mt-0.5">{new Date(operative.cscs_expiry).toLocaleDateString('en-GB')}</dd>
                  </div>
                )}
              </>
            )}
          </dl>
        </div>

        {/* File preview / download */}
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <h2 className="font-medium">File</h2>
          {viewUrl ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{doc.file_name}</p>
              {(viewUrl.match(/\.(jpg|jpeg|png|webp)(\?|$)/i) || doc.file_key?.match(/\.(jpg|jpeg|png|webp)$/i)) ? (
                // Image preview
                <div className="rounded border overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={viewUrl}
                    alt={doc.file_name ?? 'Document'}
                    className="max-w-full max-h-96 object-contain mx-auto"
                  />
                </div>
              ) : (
                // PDF / other — just show icon
                <div className="flex items-center gap-3 rounded-lg border border-dashed p-6 text-muted-foreground">
                  <FileText className="h-8 w-8 shrink-0" />
                  <span className="text-sm">{doc.file_name}</span>
                </div>
              )}
              <a
                href={viewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                Open / Download
              </a>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No file attached</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <DocumentActions
        docId={docId}
        operativeId={id}
        currentStatus={doc.status ?? 'pending'}
        fileKey={doc.file_key}
        documentType={doc.document_type}
      />
    </div>
  )
}
