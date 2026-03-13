import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { processDataSubmission } from '@/lib/workflows/engine'
import { createNotification } from '@/lib/notifications/create'

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!

// Fields that are allowed to be submitted via this route (whitelist for safety)
const ALLOWED_FIELDS = new Set([
  'email', 'phone', 'address', 'bank_details', 'ni_number', 'utr',
  'nok_name', 'nok_phone', 'date_of_birth',
])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OperativeRow = Record<string, any>

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = createServiceClient()

  // 1. Validate token + get operative
  const { data } = await supabase
    .from('operatives')
    .select('id, first_name, last_name, phone, document_upload_token_expires_at')
    .eq('document_upload_token', token)
    .eq('organization_id', ORG_ID)
    .maybeSingle()

  const operative = data as OperativeRow | null
  if (!operative) {
    return NextResponse.json({ error: 'Invalid link.' }, { status: 404 })
  }

  const expiresAt: string | null = operative.document_upload_token_expires_at ?? null
  if (!expiresAt || new Date(expiresAt) < new Date()) {
    return NextResponse.json({ error: 'This link has expired.' }, { status: 410 })
  }

  // 2. Parse body
  let body: { fields?: Record<string, string> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const fields = body.fields ?? {}
  const safeFields: Record<string, string> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (ALLOWED_FIELDS.has(key) && typeof value === 'string' && value.trim()) {
      safeFields[key] = value.trim()
    }
  }

  if (!Object.keys(safeFields).length) {
    return NextResponse.json({ error: 'No valid fields provided.' }, { status: 400 })
  }

  const operativeId = operative.id as string
  const firstName = (operative.first_name as string) ?? 'there'

  // 3. Map form keys to actual DB column names
  // Form keys (from DataForm) don't always match DB columns
  const FORM_TO_DB: Record<string, string | string[]> = {
    ni_number: 'ni_number',
    email: 'email',
    phone: 'phone',
    date_of_birth: 'date_of_birth',
    utr: 'utr_number',
    address: 'address_line1',
    nok_name: 'next_of_kin_name',
    nok_phone: 'next_of_kin_phone',
    // bank_details is a special case — single textarea with sort code + account number
    bank_details: ['bank_sort_code', 'bank_account_number'],
  }

  const dbUpdate: Record<string, string> = {}
  for (const [formKey, value] of Object.entries(safeFields)) {
    const mapping = FORM_TO_DB[formKey]
    if (!mapping) continue

    if (formKey === 'bank_details') {
      // Parse "Sort code: 12-34-56\nAccount number: 12345678" or similar freeform
      const sortMatch = value.match(/(\d{2}[\s-]?\d{2}[\s-]?\d{2})/)
      const accMatch = value.match(/(\d{7,8})/)
      if (sortMatch) dbUpdate.bank_sort_code = sortMatch[1].replace(/\s/g, '-')
      if (accMatch) dbUpdate.bank_account_number = accMatch[1]
    } else if (formKey === 'date_of_birth') {
      // Parse DD/MM/YYYY to ISO date (YYYY-MM-DD) for DB storage
      const dobMatch = value.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/)
      if (dobMatch) {
        const [, dd, mm, yyyy] = dobMatch
        dbUpdate[mapping as string] = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
      } else {
        // If already ISO format or can't parse, pass through
        dbUpdate[mapping as string] = value
      }
    } else if (typeof mapping === 'string') {
      dbUpdate[mapping] = value
    }
  }

  // Update operative record with correctly-mapped column names
  if (Object.keys(dbUpdate).length > 0) {
    const { error: updateErr } = await supabase.from('operatives').update(dbUpdate).eq('id', operativeId)
    if (updateErr) {
      console.error('[submit-data] operative update FAILED:', updateErr.message, { dbUpdate, operativeId })
      return NextResponse.json({ error: `Failed to save your details: ${updateErr.message}` }, { status: 500 })
    }
  }

  // 4. Do NOT clear the upload token — combined profile_completion links need it
  //    active for subsequent document uploads. Token expires in 24h naturally.

  // 5. Notify the workflow engine if there's an active data_collection target
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
      await processDataSubmission(activeTarget.workflow_run_id, activeTarget.id, safeFields)
    }
  } catch (e) {
    console.error('[submit-data] workflow hook error', e)
  }

  // 6. Update engagement tracking (last_upload_at not in generated types yet)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('operatives').update({ last_upload_at: new Date().toISOString() }).eq('id', operativeId)

  // 7. Create notification for admin
  const fullName = `${operative.first_name} ${operative.last_name}`.trim()
  const fieldNames = Object.keys(safeFields).join(', ').replace(/_/g, ' ')
  await createNotification(supabase, {
    type: 'document_uploaded',
    title: `${fullName} submitted data`,
    body: `Updated: ${fieldNames}`,
    severity: 'info',
    operative_id: operativeId,
    link_url: `/operatives/${operativeId}`,
    push: true,
  })

  // 8. Send WhatsApp confirmation with proper field labels
  const FIELD_DISPLAY: Record<string, string> = {
    ni_number: 'NI number', email: 'email', phone: 'phone number',
    bank_details: 'bank details', utr: 'UTR number', address: 'address',
    nok_name: 'next of kin name', nok_phone: 'next of kin phone',
    date_of_birth: 'date of birth',
  }
  if (operative.phone) {
    try {
      const labels = Object.keys(safeFields).map(k => FIELD_DISPLAY[k] ?? k.replace(/_/g, ' '))
      const fieldSummary = labels.length <= 2
        ? labels.join(' and ')
        : labels.slice(0, -1).join(', ') + ' and ' + labels[labels.length - 1]
      await sendWhatsApp(
        operative.phone as string,
        `Thanks ${firstName}! ✅ We've updated your record with your ${fieldSummary}. If anything looks wrong just reply here. — Pangaea`
      )
    } catch (e) {
      console.error('[submit-data] confirmation send error', e)
    }
  }

  return NextResponse.json({ success: true })
}
