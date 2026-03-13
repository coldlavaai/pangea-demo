import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { sendWhatsAppTemplate } from '@/lib/whatsapp/send'
import { getTemplateSid } from '@/lib/whatsapp/templates'

/**
 * Start onboarding for an operative.
 *
 * This uses the proven Amber intake flow from Aztec:
 * 1. Find or create a message_thread for the operative's phone
 * 2. Set intake_state to 'start' on the thread (triggers Amber on next inbound)
 * 3. Send an initial WhatsApp message to the operative asking them to reply
 * 4. When they reply, the handler routes to Amber which runs the full intake flow
 *
 * Amber already skips questions based on existing data (built into the system prompt).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: operativeId } = await params

  // Auth check
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = process.env.NEXT_PUBLIC_ORG_ID!
  const supabase = createServiceClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any

  // Get operative
  const { data: operative, error: opError } = await supabase
    .from('operatives')
    .select('id, first_name, last_name, phone, status, email, date_of_birth, cscs_card_type, trade_category_id, experience_years, rtw_verified')
    .eq('id', operativeId)
    .eq('organization_id', orgId)
    .single()

  if (opError || !operative) {
    return NextResponse.json({ error: 'Operative not found' }, { status: 404 })
  }

  if (!operative.first_name || !operative.phone) {
    return NextResponse.json(
      { error: 'Operative must have at least a name and phone number to start onboarding' },
      { status: 422 }
    )
  }

  // Get org name for the message
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .single()
  const orgName = org?.name ?? 'Pangea'

  // Find or create message thread
  const { data: thread, error: threadErr } = await supabase
    .from('message_threads')
    .upsert(
      { organization_id: orgId, phone_number: operative.phone, operative_id: operativeId },
      { onConflict: 'phone_number,organization_id', ignoreDuplicates: false }
    )
    .select('id, intake_state')
    .single()

  if (threadErr || !thread) {
    console.error('[onboard] Thread upsert failed:', threadErr)
    return NextResponse.json({ error: 'Failed to create message thread' }, { status: 500 })
  }

  // Build intake_data with what we already know
  const intakeData: Record<string, unknown> = {}
  if (operative.first_name) intakeData.first_name = operative.first_name
  if (operative.last_name) intakeData.last_name = operative.last_name
  if (operative.email) intakeData.email = operative.email
  if (operative.rtw_verified) intakeData.rtw_confirmed = true
  if (operative.date_of_birth) intakeData.age_confirmed = true
  if (operative.cscs_card_type) intakeData.cscs_colour = operative.cscs_card_type
  if (operative.experience_years != null) intakeData.experience_years = operative.experience_years

  // Set intake_state to 'start' — Amber will pick up on next inbound
  // Also pre-populate intake_data with known fields so Amber skips them
  await supabase
    .from('message_threads')
    .update({
      intake_state: 'start',
      intake_data: intakeData,
      operative_id: operativeId,
    })
    .eq('id', thread.id)

  // Send initial outreach message via WhatsApp
  try {
    // Try to send a re-engage template first (works outside 24h window)
    const reEngageSid = getTemplateSid('RE_ENGAGE', 'en')
    if (reEngageSid) {
      await sendWhatsAppTemplate(operative.phone, reEngageSid, {
        '1': operative.first_name,
        '2': orgName,
      })
    } else {
      // Fallback: try freeform (only works within 24h)
      await sendWhatsApp(
        operative.phone,
        `Hi ${operative.first_name}, it's Amber from ${orgName}. We need to get a few details sorted to complete your registration. Can you reply to this message?`
      )
    }

    return NextResponse.json({
      success: true,
      summary: `Onboarding started for ${operative.first_name} ${operative.last_name}. Amber will handle the conversation when they reply.`,
    })
  } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    console.error('[onboard] Failed to send WhatsApp:', err?.message ?? err)
    return NextResponse.json(
      { error: 'Failed to send WhatsApp message: ' + (err?.message ?? 'unknown error') },
      { status: 500 }
    )
  }
}
