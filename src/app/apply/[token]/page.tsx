import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import UploadForm from './upload-form'
import DataForm from './data-form'
import { t, type ApplyLang } from '@/lib/i18n/apply'

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!

export const metadata = {
  title: 'Pangaea — Secure Portal',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OperativeRow = Record<string, any>

export default async function ApplyPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ type?: string; fields?: string; docs?: string; lang?: string }>
}) {
  const { token } = await params
  const { type: documentType, fields: fieldsParam, docs: docsParam, lang: langParam } = await searchParams
  const lang = (['en', 'pl', 'ro'].includes(langParam ?? '') ? langParam : 'en') as ApplyLang
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('operatives')
    .select('*')
    .eq('document_upload_token', token)
    .eq('organization_id', ORG_ID)
    .maybeSingle()

  const operative = data as OperativeRow | null

  if (!operative) return notFound()

  const expiresAt: string | null = operative.document_upload_token_expires_at ?? null
  const isExpired = !expiresAt || new Date(expiresAt) < new Date()

  const firstName = (operative.first_name as string) ?? 'there'

  // Determine mode based on URL params
  // ?type=passport    → workflow document upload (specific doc type)
  // ?fields=ni_number,email → workflow data form (one or more text fields)
  // ?docs=photo_id,right_to_work → combined profile completion (data + multiple docs)
  // (no params)       → Amber intake (address + ID + optional CSCS)
  const isWorkflowDoc = !!documentType
  const isWorkflowData = !!fieldsParam
  const dataFields = fieldsParam ? fieldsParam.split(',').map(f => f.trim()).filter(Boolean) : []
  const docTypes = docsParam ? docsParam.split(',').map(d => d.trim()).filter(Boolean) : []
  const isCombined = docTypes.length > 0  // profile_completion: data form + multiple upload sections

  // Amber intake: show CSCS slot if card type was extracted during intake
  const hasCSCS = !isWorkflowDoc && !isWorkflowData && !isCombined && !!operative.cscs_card_type

  const subtitleMap: Record<string, string> = {
    passport: 'Passport Upload',
    right_to_work: 'Right to Work',
    cscs_card: 'CSCS Card Upload',
    photo_id: 'Photo ID Upload',
    cpcs_ticket: 'CPCS Ticket Upload',
    npors_ticket: 'NPORS Ticket Upload',
    first_aid: 'First Aid Certificate',
    other: 'Document Upload',
  }

  const subtitle = isCombined
    ? 'Complete Your Profile'
    : isWorkflowData
      ? 'Update Your Details'
      : isWorkflowDoc
        ? (subtitleMap[documentType] ?? 'Document Upload')
        : 'Operative Registration'

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
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        {isExpired ? (
          <div className="rounded-xl border border-border bg-background p-6 text-center space-y-4">
            <div className="text-4xl">⏰</div>
            <h2 className="text-xl font-bold text-white">Link Expired</h2>
            <p className="text-muted-foreground text-sm">
              {t('link_expired', lang)}
            </p>
            <a
              href="https://wa.me/447414157366"
              className="inline-block bg-forest-700 hover:bg-forest-600 text-white font-semibold px-6 py-3 rounded-lg text-sm transition-colors"
            >
              WhatsApp Pangaea
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Welcome card */}
            <div className="rounded-xl border border-border bg-background p-5">
              <h2 className="text-base font-semibold text-foreground mb-1">
                Hi {firstName},
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {isCombined
                  ? t('instruction_multiple_fields', lang)
                  : isWorkflowData
                    ? dataFields.length === 1
                      ? t('instruction_single_field', lang)
                      : t('instruction_multiple_fields', lang)
                    : isWorkflowDoc
                      ? t('instruction_document', lang)
                      : hasCSCS
                        ? t('instruction_id_cscs', lang)
                        : t('instruction_id', lang)}
              </p>
            </div>

            {isCombined ? (
              <>
                {/* Combined mode: data form (if fields) + one upload card per doc type */}
                {dataFields.length > 0 && (
                  <div className="rounded-xl border border-border bg-background p-5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Your Details</p>
                    <DataForm token={token} firstName={firstName} dataFields={dataFields} lang={lang} />
                  </div>
                )}
                {docTypes.map((docType) => (
                  <div key={docType} className="rounded-xl border border-border bg-background p-5">
                    <UploadForm
                      token={token}
                      firstName={firstName}
                      hasCSCS={false}
                      workflowDocType={docType}
                    />
                  </div>
                ))}
              </>
            ) : (
              /* Standard single-mode form card */
              <div className="rounded-xl border border-border bg-background p-5">
                {isWorkflowData ? (
                  <DataForm token={token} firstName={firstName} dataFields={dataFields} lang={lang} />
                ) : (
                  <UploadForm
                    token={token}
                    firstName={firstName}
                    hasCSCS={hasCSCS}
                    workflowDocType={isWorkflowDoc ? documentType : undefined}
                  />
                )}
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-8">
          Pangaea Limited · Secure portal
        </p>
      </div>
    </div>
  )
}
