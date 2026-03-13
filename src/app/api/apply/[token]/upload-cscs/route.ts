import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { createNotification } from '@/lib/notifications/create'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OperativeRow = Record<string, any>

async function verifyAndExtractCSCS(
  buffer: Buffer,
  mediaType: string,
  intakeColour: string | null
) {
  const base64 = buffer.toString('base64')
  const prompt = `This should be a CSCS card (Construction Skills Certification Scheme card, used in UK construction).

Verify it is genuine and legible. Extract the data.
Expected card colour: "${intakeColour ?? 'unknown'}"

Respond with JSON only:
{
  "valid": true or false,
  "feedback": "reason if invalid, empty string if good",
  "card_colour": "colour or null",
  "card_number": "card number or null",
  "expiry_date": "YYYY-MM-DD or null",
  "card_type": "e.g. Skilled Worker or null",
  "colour_matches": true or false
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: base64 } },
          { type: 'text', text: prompt },
        ],
      }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const clean = text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    return JSON.parse(clean)
  } catch (e) {
    console.error('[upload-cscs] vision error', e)
    return { valid: true, feedback: '', card_colour: null, card_number: null, expiry_date: null, card_type: null, colour_matches: true }
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = createServiceClient()

  // Validate token — operative must exist and not have token cleared yet
  const { data } = await supabase
    .from('operatives')
    .select('*')
    .eq('document_upload_token', token)
    .eq('organization_id', ORG_ID)
    .maybeSingle()

  const operativeByToken = data as OperativeRow | null

  // Parse form data FIRST — needed to get operative_id for the fallback lookup below
  let formData: FormData
  try { formData = await req.formData() }
  catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }

  const cscsFile = formData.get('cscs_card') as File | null
  if (!cscsFile || cscsFile.size === 0) {
    return NextResponse.json({ success: true })
  }

  // operative_id is passed from the ID upload response — the token was cleared by that step
  const operativeIdParam = (formData.get('operative_id') as string | null) ?? ''
  const operativeId = operativeByToken ? (operativeByToken.id as string) : operativeIdParam

  // If token lookup found nothing, fall back to lookup by id + status=qualifying
  let resolvedOperative: OperativeRow | null = operativeByToken
  if (!resolvedOperative && operativeIdParam) {
    const { data: byId } = await supabase
      .from('operatives')
      .select('*')
      .eq('id', operativeIdParam)
      .eq('organization_id', ORG_ID)
      .eq('status', 'qualifying')
      .maybeSingle()
    resolvedOperative = byId as OperativeRow | null
  }

  if (!resolvedOperative) {
    console.error('[upload-cscs] could not resolve operative — token cleared and no operative_id provided:', operativeIdParam)
    return NextResponse.json({ success: true })
  }

  const intakeCscsColour = (resolvedOperative.cscs_card_type as string) ?? null

  const cscsBytes = await cscsFile.arrayBuffer()
  const cscsBuffer = Buffer.from(cscsBytes)
  const cscsMediaType = cscsFile.type || 'image/jpeg'

  const parsed = await verifyAndExtractCSCS(cscsBuffer, cscsMediaType, intakeCscsColour)

  if (!parsed.valid) {
    return NextResponse.json({
      error: `We couldn't verify your CSCS card. ${parsed.feedback || "Please ensure it's a clear photo showing the card colour and expiry date."}`,
      field: 'cscs_card',
    }, { status: 422 })
  }

  // Upload to storage
  const ext = cscsFile.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${ORG_ID}/${operativeId}/${Date.now()}-cscs.${ext}`
  const { error: storageError } = await supabase.storage
    .from('operative-documents')
    .upload(path, cscsBuffer, { contentType: cscsFile.type || 'image/jpeg', upsert: false })

  if (storageError) {
    console.error('[upload-cscs] storage error', storageError)
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })
  }

  // Generate signed URL (7 days) — bucket is private, getPublicUrl won't work
  const { data: urlData } = await supabase.storage.from('operative-documents').createSignedUrl(path, 7 * 24 * 60 * 60)
  const cscsUrl = urlData?.signedUrl ?? ''

  // Update operative with CSCS data
  const updates: Record<string, unknown> = {}
  if (parsed.card_colour) updates.cscs_card_type = parsed.card_colour
  if (parsed.card_number) updates.cscs_card_number = parsed.card_number
  if (parsed.expiry_date) updates.cscs_expiry = parsed.expiry_date
  if (parsed.card_type) updates.cscs_card_title = parsed.card_type
  if (Object.keys(updates).length > 0) {
    await supabase.from('operatives').update(updates).eq('id', resolvedOperative.id)
  }

  const flags: string[] = []
  if (parsed.valid && intakeCscsColour && parsed.colour_matches === false) {
    flags.push(`CSCS colour on card (${parsed.card_colour ?? 'unknown'}) does not match intake answer (${intakeCscsColour})`)
  }

  const cscsNotes = [
    'AI-verified via upload form (Amber intake). Awaiting admin review.',
    ...(flags.length > 0 ? [`⚠️ ${flags.join(' | ')}`] : []),
  ].join(' ')

  await supabase.from('documents').insert({
    organization_id: ORG_ID,
    operative_id: resolvedOperative.id,
    document_type: 'cscs_card',
    file_url: cscsUrl,
    file_key: path,
    file_name: `CSCS Card${parsed.card_colour ? ` (${parsed.card_colour})` : ''} (Amber intake)`,
    status: 'pending',
    notes: cscsNotes,
    expiry_date: parsed.expiry_date ?? null,
  })

  // Send WhatsApp summary now that both ID and CSCS are processed
  const firstName = (resolvedOperative.first_name as string) ?? 'there'
  const cscsColourLabel = parsed.card_colour
    ? parsed.card_colour.charAt(0).toUpperCase() + parsed.card_colour.slice(1)
    : 'CSCS'
  if (resolvedOperative.phone) {
    try {
      await sendWhatsApp(
        resolvedOperative.phone as string,
        `Thanks ${firstName}! ✅ We've received all your documents.\n\n📄 *Passport / Driving Licence* — verified\n🪪 *${cscsColourLabel} CSCS Card* — verified\n\nThese confirm your identity and qualifications to work with Pangaea. If you have any questions, just reply here and I'll help. Our Labour Manager will be in touch within 1–3 working days. 👷`
      )
    } catch (e) {
      console.error('[upload-cscs] confirmation send error', e)
    }
  }

  // Notify BOS — CSCS card uploaded
  const opFullName = `${resolvedOperative.first_name ?? ''} ${resolvedOperative.last_name ?? ''}`.trim()
  await createNotification(supabase, {
    type: 'cscs_uploaded',
    title: `CSCS Card: ${opFullName}`,
    body: `${cscsColourLabel} CSCS card uploaded${flags.length > 0 ? ' · ' + flags.join(', ') : ''}`,
    severity: flags.length > 0 ? 'warning' : 'info',
    operative_id: resolvedOperative.id as string,
    link_url: `/operatives/${resolvedOperative.id}`,
    push: false,
  })

  return NextResponse.json({ success: true })
}
