import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { createNotification } from '@/lib/notifications/create'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface IDExtracted {
  first_name: string | null
  last_name: string | null
  date_of_birth: string | null   // YYYY-MM-DD
  expiry_date: string | null     // YYYY-MM-DD
  nationality: string | null
  document_number: string | null // passport / licence number
  doc_type: 'passport' | 'driving_licence' | 'other'
}

interface CSCSExtracted {
  card_colour: string | null
  card_number: string | null
  expiry_date: string | null     // YYYY-MM-DD
  card_type: string | null       // e.g. "Skilled Worker", "Labourer"
}

interface VerifyResult {
  valid: boolean
  feedback: string
  flags: string[]   // Cross-reference warnings (non-blocking)
  idExtracted?: IDExtracted
  cscsExtracted?: CSCSExtracted
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OperativeRow = Record<string, any>
type DocumentType = 'photo_id' | 'cscs_card' | 'right_to_work' | 'other' | 'cpcs_ticket' | 'npors_ticket' | 'lantra_cert' | 'first_aid' | 'asbestos_awareness' | 'chainsaw_cs30' | 'chainsaw_cs31' | 'cv'

// ------------------------------------------------------------------
// Fuzzy name comparison (handles typos, different ordering)
// ------------------------------------------------------------------

function namesMatch(docFirst: string | null, docLast: string | null, intakeFirst: string, intakeLast: string): boolean {
  if (!docFirst || !docLast) return true // Can't compare, don't flag
  const docLastNorm = docLast.toLowerCase().trim()
  const intakeLastNorm = intakeLast.toLowerCase().trim()
  const intakeFirstNorm = intakeFirst.toLowerCase().trim()
  // Surname must match
  if (docLastNorm !== intakeLastNorm) return false
  // First name: intake first name must appear somewhere in the doc's given names
  // Handles: "OLIVER RUSSEL BRIGGS" matching intake "Oliver" — middle names are fine
  const docFirstParts = docFirst.toLowerCase().split(/\s+/)
  if (docFirstParts.includes(intakeFirstNorm)) return true
  // Also accept exact given name match or one containing the other
  const docFirstNorm = docFirst.toLowerCase().trim()
  if (docFirstNorm === intakeFirstNorm) return true
  if (docFirstNorm.startsWith(intakeFirstNorm + ' ') || intakeFirstNorm.startsWith(docFirstNorm + ' ')) return true
  return false
}

// ------------------------------------------------------------------
// Vision: verify + extract — ID document
// ------------------------------------------------------------------

async function verifyAndExtractID(
  buffer: Buffer,
  mediaType: string,
  intakeFirst: string,
  intakeLast: string
): Promise<VerifyResult> {
  const base64 = buffer.toString('base64')
  const prompt = `This should be a UK passport or UK driving licence.

Your task:
1. Verify the document is genuine and legible (ONLY this affects "valid")
2. Extract the data from it
3. Check whether the name on the document includes the expected name

IMPORTANT — "valid" means the document is physically legible and appears genuine.
A name mismatch does NOT make the document invalid. Set valid=true as long as the document is real and readable.

Check quality (this is what determines "valid"):
- Is this actually a passport or UK driving licence?
- Is the image clear, in focus, well-lit?
- Is all text readable?
- Are all edges/corners visible?
- Is the expiry date visible?

Expected name: "${intakeFirst} ${intakeLast}"
For name_matches: return true if the surname matches AND the expected first name appears anywhere in the document's given names field (middle names are fine — ignore them).

Respond with JSON only (no markdown, no explanation):
{
  "valid": true or false,
  "feedback": "brief reason if document is unreadable or not a valid ID — leave empty string if document is fine",
  "doc_type": "passport" | "driving_licence" | "other",
  "document_number": "passport number or driving licence number exactly as printed, or null",
  "first_name": "all given names exactly as printed on document, or null",
  "last_name": "surname exactly as printed on document, or null",
  "date_of_birth": "YYYY-MM-DD or null",
  "expiry_date": "YYYY-MM-DD or null",
  "nationality": "extracted nationality or null",
  "name_matches": true or false
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: base64,
            },
          },
          { type: 'text', text: prompt },
        ],
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const clean = text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(clean)

    const flags: string[] = []
    if (parsed.valid && parsed.name_matches === false) {
      const docName = [parsed.first_name, parsed.last_name].filter(Boolean).join(' ')
      flags.push(`Name on document (${docName}) does not match intake name (${intakeFirst} ${intakeLast})`)
    }

    return {
      valid: parsed.valid === true,
      feedback: parsed.feedback ?? '',
      flags,
      idExtracted: {
        doc_type: parsed.doc_type ?? 'other',
        document_number: parsed.document_number ?? null,
        first_name: parsed.first_name ?? null,
        last_name: parsed.last_name ?? null,
        date_of_birth: parsed.date_of_birth ?? null,
        expiry_date: parsed.expiry_date ?? null,
        nationality: parsed.nationality ?? null,
      },
    }
  } catch (e) {
    console.error('[upload] ID vision error', e)
    return { valid: true, feedback: '', flags: [] }
  }
}

// ------------------------------------------------------------------
// Vision: verify + extract — CSCS card
// ------------------------------------------------------------------

async function verifyAndExtractCSCS(
  buffer: Buffer,
  mediaType: string,
  intakeColour: string | null
): Promise<VerifyResult> {
  const base64 = buffer.toString('base64')
  const prompt = `This should be a CSCS card (Construction Skills Certification Scheme card, used in UK construction).

Your task:
1. Verify this is a genuine, legible CSCS card
2. Extract the data from it
3. Check the card colour matches the expected colour

Check quality:
- Is this actually a CSCS card?
- Is the image clear and all text readable?
- Is the card colour clearly visible?
- Is the expiry date visible?

Expected card colour: "${intakeColour ?? 'unknown'}"

Respond with JSON only (no markdown, no explanation):
{
  "valid": true or false,
  "feedback": "reason if invalid or unreadable, empty string if all good",
  "card_colour": "the actual colour of the card (e.g. green, blue, gold, black, red, white) or null",
  "card_number": "card number as printed or null",
  "expiry_date": "YYYY-MM-DD or null",
  "card_type": "e.g. Skilled Worker, Labourer, Supervisor or null",
  "colour_matches": true or false
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: base64,
            },
          },
          { type: 'text', text: prompt },
        ],
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const clean = text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(clean)

    const flags: string[] = []
    if (parsed.valid && intakeColour && parsed.colour_matches === false) {
      flags.push(`CSCS colour on card (${parsed.card_colour ?? 'unknown'}) does not match intake answer (${intakeColour})`)
    }

    return {
      valid: parsed.valid === true,
      feedback: parsed.feedback ?? '',
      flags,
      cscsExtracted: {
        card_colour: parsed.card_colour ?? null,
        card_number: parsed.card_number ?? null,
        expiry_date: parsed.expiry_date ?? null,
        card_type: parsed.card_type ?? null,
      },
    }
  } catch (e) {
    console.error('[upload] CSCS vision error', e)
    return { valid: true, feedback: '', flags: [] }
  }
}

// ------------------------------------------------------------------
// POST /api/apply/[token]/upload
// ------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = createServiceClient()

  // 1. Validate token
  const { data, error: opError } = await supabase
    .from('operatives')
    .select('*')
    .eq('document_upload_token', token)
    .eq('organization_id', ORG_ID)
    .maybeSingle()

  const operative = data as OperativeRow | null

  if (opError || !operative) {
    return NextResponse.json({ error: 'Invalid upload link.' }, { status: 404 })
  }

  // 2. Check expiry
  const expiresAt: string | null = operative.document_upload_token_expires_at ?? null
  if (!expiresAt || new Date(expiresAt) < new Date()) {
    return NextResponse.json({ error: 'This upload link has expired. Please contact Pangaea.' }, { status: 410 })
  }

  // 3. Parse multipart form data
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const idFile = formData.get('id_document') as File | null
  const cscsFile = formData.get('cscs_card') as File | null
  const workflowMode = formData.get('workflow_mode') === 'true'
  const workflowDocType = (formData.get('workflow_doc_type') as string | null) ?? null
  const addressLine1 = (formData.get('address_line1') as string | null)?.trim() ?? ''
  const addressLine2 = (formData.get('address_line2') as string | null)?.trim() ?? ''
  const city = (formData.get('city') as string | null)?.trim() ?? ''
  const postcode = (formData.get('postcode') as string | null)?.trim().toUpperCase() ?? ''

  if (!workflowMode && (!addressLine1 || !city || !postcode)) {
    return NextResponse.json({ error: 'Please fill in your address details.' }, { status: 400 })
  }

  if (!idFile) {
    return NextResponse.json({ error: 'Please upload your document.' }, { status: 400 })
  }

  const operativeId = operative.id as string
  // intake_data lives on message_threads, NOT on operatives — read typed fields directly
  const intakeFirst = (operative.first_name as string) ?? ''
  const intakeLast = (operative.last_name as string) ?? ''
  const intakeCscsColour = (operative.cscs_card_type as string) ?? null

  const allFlags: string[] = []
  const operativeUpdates: Record<string, unknown> = {
    document_upload_token: null,
    document_upload_token_expires_at: null,
    // Amber intake: update status + address. Workflow chase: skip both.
    ...(!workflowMode ? {
      status: 'qualifying',
      address_line1: addressLine1,
      ...(addressLine2 ? { address_line2: addressLine2 } : {}),
      city,
      postcode,
    } : {}),
  }

  // Helper: upload file to Supabase Storage — returns { url, key } or null
  async function uploadFile(file: File, label: string): Promise<{ url: string; key: string } | null> {
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const key = `${ORG_ID}/${operativeId}/${Date.now()}-${label}.${ext}`

    const { error } = await supabase.storage
      .from('operative-documents')
      .upload(key, buffer, { contentType: file.type || 'image/jpeg', upsert: false })

    if (error) {
      console.error('[upload] storage error', error)
      return null
    }

    // Generate signed URL (7 days) — bucket is private, getPublicUrl won't work
    const { data: urlData } = await supabase.storage.from('operative-documents').createSignedUrl(key, 7 * 24 * 60 * 60)
    return { url: urlData?.signedUrl ?? '', key }
  }

  // 4. Process ID document
  const idBytes = await idFile.arrayBuffer()
  const idBuffer = Buffer.from(idBytes)
  const idMediaType = idFile.type || 'image/jpeg'

  const idResult = await verifyAndExtractID(idBuffer, idMediaType, intakeFirst, intakeLast)

  if (!idResult.valid) {
    return NextResponse.json({
      error: "We couldn't read your ID document clearly. Please take a new photo — lay it flat, good lighting, all four edges in frame.",
      field: 'id_document',
    }, { status: 422 })
  }

  const idUpload = await uploadFile(idFile, 'id')
  if (!idUpload) {
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })
  }

  // Collect extracted data from ID
  if (idResult.idExtracted) {
    const { date_of_birth, expiry_date, nationality, document_number, doc_type } = idResult.idExtracted
    if (date_of_birth) operativeUpdates.date_of_birth = date_of_birth
    if (expiry_date) operativeUpdates.id_expiry = expiry_date
    if (nationality) operativeUpdates.nationality = nationality
    if (document_number) operativeUpdates.id_document_number = document_number

    // Derive RTW type from nationality + doc type (rtw_verified set later when admin clicks Verify)
    const n = (nationality ?? '').toLowerCase()
    let rtwType: string | null = null
    if (n.includes('british') || n.includes('united kingdom') || n === 'gbr') rtwType = 'british_citizen'
    else if (n.includes('irish') || n.includes('ireland') || n === 'irl') rtwType = 'irish_citizen'
    else if (doc_type === 'driving_licence') rtwType = 'driving_licence'
    else if (doc_type === 'passport') rtwType = 'passport'
    if (rtwType) operativeUpdates.rtw_type = rtwType
  }
  allFlags.push(...idResult.flags)

  const docType = idResult.idExtracted?.doc_type ?? 'other'
  const docLabel = docType === 'passport' ? 'Passport' : docType === 'driving_licence' ? 'Driving Licence' : 'ID Document'
  const idNotes = [
    'AI-verified via upload form (Amber intake). Awaiting manager review.',
    ...(idResult.flags.length > 0 ? [`⚠️ ${idResult.flags.join(' | ')}`] : []),
  ].join(' ')

  // 6. Build document record (CSCS handled separately by /upload-cscs route)
  // Map workflow doc types to the DocumentType enum
  const workflowDocTypeMap: Record<string, DocumentType> = {
    passport: 'photo_id',
    right_to_work: 'right_to_work',
    photo_id: 'photo_id',
    cscs_card: 'cscs_card',
    cpcs_ticket: 'cpcs_ticket',
    npors_ticket: 'npors_ticket',
    first_aid: 'first_aid',
  }
  const resolvedDocType: DocumentType = workflowMode && workflowDocType
    ? (workflowDocTypeMap[workflowDocType] ?? 'other')
    : 'photo_id'

  const documentInserts: {
    organization_id: string
    operative_id: string
    document_type: DocumentType
    file_url: string
    file_key: string
    file_name: string
    status: 'pending'
    notes: string
    expiry_date?: string | null
  }[] = [
    {
      organization_id: ORG_ID,
      operative_id: operativeId,
      document_type: resolvedDocType,
      file_url: idUpload.url,
      file_key: idUpload.key,
      file_name: workflowMode
        ? `${docLabel} (workflow chase)`
        : `${docLabel} (Amber intake)`,
      status: 'pending',
      notes: idNotes,
      expiry_date: idResult.idExtracted?.expiry_date ?? null,
    },
  ]

  const { error: docsError } = await supabase.from('documents').insert(documentInserts)
  if (docsError) {
    console.error('[upload] documents insert error', docsError)
    return NextResponse.json({ error: 'Failed to save documents. Please try again.' }, { status: 500 })
  }

  // 7. Update operative with extracted data + clear token
  await supabase
    .from('operatives')
    .update(operativeUpdates)
    .eq('id', operativeId)

  const firstName = operative.first_name ?? 'there'
  const fullName = `${operative.first_name ?? ''} ${operative.last_name ?? ''}`.trim()
  const docsUploaded = `📄 ${docLabel}`

  const flagSummary = allFlags.length > 0
    ? `\n\n⚠️ *Flags for review:*\n${allFlags.map(f => `• ${f}`).join('\n')}`
    : ''

  // 8. WhatsApp notifications
  // Workflow mode: acknowledge the upload, let them know we'll review it.
  // Amber intake: send full confirmation to operative + notify admin.
  if (workflowMode && operative.phone) {
    try {
      await sendWhatsApp(
        operative.phone,
        `Thanks ${firstName}! We've received your ${docLabel}. We'll review it and let you know once it's confirmed. — Pangaea`
      )
    } catch (e) {
      console.error('[upload] workflow acknowledgement error', e)
    }
  }

  if (!workflowMode) {
    if (operative.phone && !intakeCscsColour) {
      try {
        await sendWhatsApp(
          operative.phone,
          `Thanks ${firstName}! ✅ We've received your documents.\n\n📄 *${docLabel}* — verified\n\nThis confirms your identity so we can get you started with Pangaea. If you have any questions, just reply here and I'll help. Our Labour Manager will be in touch within 1–3 working days. 👷`
        )
      } catch (e) {
        console.error('[upload] confirmation send error', e)
      }
    }

    const staffNumber = process.env.STAFF_WHATSAPP_NUMBER
    if (staffNumber) {
      try {
        await sendWhatsApp(
          staffNumber,
          `📋 *Documents received — ${fullName}*\n\n*Phone:* ${operative.phone ?? 'unknown'}\n*Docs:* ${docsUploaded}${flagSummary}\n\n👉 Review & verify:\nhttps://pangaea-demo.vercel.app/operatives/${operativeId}?tab=documents`
        )
      } catch (e) {
        console.error('[upload] staff notify error', e)
      }
    }
  }

  // Update engagement tracking (last_upload_at not in generated types yet)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('operatives').update({ last_upload_at: new Date().toISOString() }).eq('id', operativeId)

  // Notify BOS + admin via Telegram
  await createNotification(supabase, {
    type: 'document_uploaded',
    title: `Document: ${fullName}`,
    body: `${docLabel} uploaded${allFlags.length > 0 ? ' · ' + allFlags.join(', ') : ''}`,
    severity: allFlags.length > 0 ? 'warning' : 'info',
    operative_id: operativeId,
    link_url: `/operatives/${operativeId}`,
    push: true,
  })

  // Notify workflow engine if this operative has an active document-chase workflow
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyDb = supabase as any
    const { data: activeTarget } = await anyDb
      .from('workflow_targets')
      .select('id, workflow_run_id')
      .eq('operative_id', operativeId)
      .in('status', ['contacted', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (activeTarget) {
      // Get the document id we just inserted
      const { data: newDoc } = await supabase
        .from('documents')
        .select('id')
        .eq('operative_id', operativeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (newDoc?.id) {
        const { processUpload } = await import('@/lib/workflows/engine')
        await processUpload(activeTarget.workflow_run_id, activeTarget.id, newDoc.id)
      }
    }
  } catch (e) {
    // Non-fatal — workflow hook failure never blocks the upload response
    console.error('[upload] workflow hook error', e)
  }

  // Return operativeId so the CSCS upload (separate request) can find the operative
  // even after the token has been cleared
  return NextResponse.json({ success: true, operativeId })
}
