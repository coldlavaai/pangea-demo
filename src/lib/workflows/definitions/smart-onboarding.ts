/**
 * Smart Onboarding Workflow
 *
 * Intelligently collects missing data from operatives via WhatsApp conversation.
 * Analyses what's already present, skips known fields, asks in priority order.
 *
 * Phase 1: Conversational (RTW → age → CSCS → trade → experience → name → email)
 * Phase 2: Form link (NI, bank, address, NOK, documents)
 *
 * Updates the operative record in real-time after each reply.
 */

import type { WorkflowDefinition, WorkflowContext, WorkflowTargetWithOperative } from '../types'
import { generateUploadLink } from '../upload-link'
import { initiateEngagement } from '../engagement'
import { smartSendWhatsApp } from '@/lib/whatsapp/smart-send'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { analyseGaps, getQuestionForGap, type GapAnalysisResult } from '../onboarding/gap-analysis'
import { extractOnboardingData } from '../onboarding/amber-extract'

interface OnboardingTargetData {
  onboarding_phase: 'conversational' | 'form_pending' | 'complete'
  gaps_at_start: string[]
  collected: Record<string, unknown>
  current_question: string | null
  current_question_label: string | null
  rtw_rejected: boolean
  form_link: string | null
  form_fields: string[]
  document_types: string[]
  uploaded_docs: string[]
}

/** Fetch full operative + documents for gap analysis */
async function getOperativeWithDocs(supabase: unknown, operativeId: string, orgId: string) {
  const db = supabase as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data: operative } = await db
    .from('operatives')
    .select('*')
    .eq('id', operativeId)
    .eq('organization_id', orgId)
    .single()

  const { data: documents } = await db
    .from('documents')
    .select('document_type, status')
    .eq('operative_id', operativeId)
    .eq('organization_id', orgId)

  return { operative, documents: documents ?? [] }
}

/** Run gap analysis and determine next action */
async function analyseAndGetNext(
  supabase: unknown,
  operativeId: string,
  orgId: string
): Promise<{ gaps: GapAnalysisResult; operative: any }> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { operative, documents } = await getOperativeWithDocs(supabase, operativeId, orgId)
  const gaps = analyseGaps(operative, documents)
  return { gaps, operative }
}

/** Map extracted field names to DB column updates */
function mapExtractedToDbUpdate(extracted: Record<string, unknown>, supabase: unknown, orgId: string) {
  const update: Record<string, unknown> = {}

  if (extracted.rtw_confirmed === true) {
    update.rtw_verified = true
    update.rtw_type = 'self_declared'
  }
  if (extracted.age_confirmed === true && !extracted.date_of_birth) {
    // We know they're 18+ but don't have exact DOB
    // Don't update DOB — form will collect that later
  }
  if (extracted.date_of_birth) {
    update.date_of_birth = extracted.date_of_birth
  }
  if (extracted.cscs_colour) {
    const colour = String(extracted.cscs_colour).toLowerCase()
    if (['green', 'blue', 'gold', 'black', 'red', 'white', 'none'].includes(colour)) {
      update.cscs_card_type = colour === 'none' ? null : colour
    }
  }
  if (extracted.trade) {
    // We'll match to trade_category_id separately
  }
  if (extracted.experience_years !== undefined && extracted.experience_years !== null) {
    update.experience_years = Number(extracted.experience_years)
  }
  if (extracted.first_name) {
    update.first_name = extracted.first_name
  }
  if (extracted.last_name) {
    update.last_name = extracted.last_name
  }
  if (extracted.email) {
    update.email = String(extracted.email).toLowerCase().trim()
  }

  return update
}

/** Match a trade string to a trade_category_id */
async function matchTrade(supabase: unknown, orgId: string, tradeName: string): Promise<string | null> {
  const db = supabase as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data: trades } = await db
    .from('trade_categories')
    .select('id, name')
    .eq('organization_id', orgId)

  if (!trades?.length) return null

  const lower = tradeName.toLowerCase()
  // Exact match first
  const exact = trades.find((t: any) => t.name.toLowerCase() === lower) // eslint-disable-line @typescript-eslint/no-explicit-any
  if (exact) return exact.id

  // Partial match
  const partial = trades.find((t: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
    t.name.toLowerCase().includes(lower) || lower.includes(t.name.toLowerCase())
  )
  return partial?.id ?? null
}

/** Get org name for template messages */
async function getOrgName(supabase: unknown, orgId: string): Promise<string> {
  const db = supabase as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data } = await db
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .single()
  return data?.name ?? 'Pangaea'
}

export const smartOnboardingWorkflow: WorkflowDefinition = {
  type: 'smart_onboarding',
  label: 'Smart Onboarding',
  description: 'Intelligently collect missing data via WhatsApp conversation, then send form link for remaining details',
  requiredParams: ['operative_ids'],

  async onTrigger(ctx: WorkflowContext) {
    const { run, orgId } = ctx
    const supabase = ctx.supabase as any // eslint-disable-line @typescript-eslint/no-explicit-any
    const orgName = await getOrgName(supabase, orgId)

    // Get all targets for this run
    const { data: targets } = await supabase
      .from('workflow_targets')
      .select('*, operative:operatives!workflow_targets_operative_id_fkey(first_name, last_name, phone, email, cscs_card_type, preferred_language)')
      .eq('workflow_run_id', run.id)

    if (!targets?.length) return

    let contacted = 0

    for (const target of targets) {
      const op = target.operative
      if (!op?.phone) {
        // Skip — no phone number
        await supabase
          .from('workflow_targets')
          .update({ status: 'skipped', outcome: 'no_phone' })
          .eq('id', target.id)
        continue
      }

      // Run gap analysis
      const { gaps } = await analyseAndGetNext(supabase, target.operative_id, orgId)

      if (gaps.isFullyComplete) {
        await supabase
          .from('workflow_targets')
          .update({ status: 'completed', outcome: 'already_complete', data: { onboarding_phase: 'complete', gaps_at_start: [], collected: {} } })
          .eq('id', target.id)
        continue
      }

      // Build initial target data
      const targetData: OnboardingTargetData = {
        onboarding_phase: gaps.conversational.length > 0 ? 'conversational' : 'form_pending',
        gaps_at_start: [...gaps.conversational, ...gaps.formBased, ...gaps.documents].map(g => g.key),
        collected: {},
        current_question: gaps.nextConversationalQuestion?.key ?? null,
        current_question_label: gaps.nextConversationalQuestion?.label ?? null,
        rtw_rejected: false,
        form_link: null,
        form_fields: gaps.formBased.map(g => g.key),
        document_types: gaps.documents.map(g => g.key),
        uploaded_docs: [],
      }

      // Build first message
      let firstMessage: string
      if (gaps.nextConversationalQuestion) {
        const question = getQuestionForGap(gaps.nextConversationalQuestion, op.first_name ?? 'there')
        firstMessage = `Hi ${op.first_name ?? 'there'}, it's Amber from ${orgName}. We need to get a few details sorted to complete your onboarding.\n\n${question}`
      } else {
        // No conversational gaps — go straight to form
        const link = await generateUploadLink(supabase, target.operative_id, {
          dataFields: gaps.formBased.map(g => g.key),
          documentTypes: gaps.documents.map(g => g.key),
        })
        targetData.form_link = link
        targetData.onboarding_phase = 'form_pending'
        firstMessage = `Hi ${op.first_name ?? 'there'}, it's Amber from ${orgName}. We just need a few more details and documents from you. Please use this secure link to complete your profile: ${link}`
      }

      // Send via engagement handler (respects 24h window)
      // If within 24h session, send freeform directly instead of going through initiateEngagement
      const engagementState = await initiateEngagement(
        supabase,
        op.phone,
        op.first_name ?? 'there',
        op.preferred_language,
        orgName,
      )

      // If engaged (within 24h), send the first message as freeform
      if (engagementState === 'engaged') {
        await sendWhatsApp(op.phone, firstMessage)
      }
      // If re_engaged, the message will be sent when they reply (via onEngaged hook)

      // Update target
      const followUp = new Date(Date.now() + (run.follow_up_hours || 24) * 60 * 60 * 1000).toISOString()
      await supabase
        .from('workflow_targets')
        .update({
          status: 'contacted',
          engagement_state: engagementState,
          data: targetData,
          messages_sent: 1,
          last_contacted_at: new Date().toISOString(),
          next_follow_up_at: followUp,
        })
        .eq('id', target.id)

      // Set active workflow on thread
      await supabase
        .from('message_threads')
        .update({ active_workflow_id: run.id })
        .eq('operative_id', target.operative_id)
        .eq('organization_id', orgId)

      contacted++

      // Log event
      await supabase.from('workflow_events').insert({
        workflow_run_id: run.id,
        target_id: target.id,
        event_type: 'started',
        details: { gaps: targetData.gaps_at_start.length, phase: targetData.onboarding_phase },
      })
    }

    // Update run stats
    await supabase
      .from('workflow_runs')
      .update({ targets_contacted: contacted })
      .eq('id', run.id)
  },

  async onEngaged(ctx: WorkflowContext, target: WorkflowTargetWithOperative): Promise<string | null> {
    // Operative replied to RE_ENGAGE — now we have a 24h window
    const data = target.data as unknown as OnboardingTargetData
    const op = target.operative

    if (data.onboarding_phase === 'conversational' && data.current_question) {
      const { gaps } = await analyseAndGetNext(ctx.supabase, target.operative_id, ctx.orgId)
      const nextGap = gaps.nextConversationalQuestion
      if (nextGap) {
        return getQuestionForGap(nextGap, op.first_name ?? 'there')
      }
    }

    if (data.onboarding_phase === 'form_pending' && data.form_link) {
      return `Hi ${op.first_name ?? 'there'}, thanks for getting back to us! Please complete your details using this link: ${data.form_link}`
    }

    return null
  },

  async onInbound(
    ctx: WorkflowContext,
    target: WorkflowTargetWithOperative,
    message: string,
  ): Promise<string | null> {
    const { orgId } = ctx
    const supabase = ctx.supabase as any // eslint-disable-line @typescript-eslint/no-explicit-any
    const data = target.data as unknown as OnboardingTargetData
    const op = target.operative
    const orgName = await getOrgName(supabase, orgId)

    // If in form_pending phase, remind about the link
    if (data.onboarding_phase === 'form_pending') {
      if (data.form_link) {
        return `Hi ${op.first_name ?? 'there'}, we're still waiting for your details. Please use this link to complete your profile: ${data.form_link}`
      }
      return null
    }

    // Conversational phase — extract data from reply
    const { gaps } = await analyseAndGetNext(supabase, target.operative_id, orgId)
    const remainingLabels = gaps.conversational.filter(g => g.key !== data.current_question).map(g => g.label)

    const extraction = await extractOnboardingData({
      currentQuestion: data.current_question ?? 'general',
      currentQuestionLabel: data.current_question_label ?? 'General information',
      remainingGaps: remainingLabels,
      collectedSoFar: data.collected,
      operativeFirstName: op.first_name ?? 'there',
      messageBody: message,
      orgName,
    })

    // Handle RTW rejection
    if (extraction.rtwRejected) {
      data.rtw_rejected = true
      data.onboarding_phase = 'complete'

      await supabase
        .from('workflow_targets')
        .update({
          status: 'completed',
          outcome: 'rejected_rtw',
          data,
          response_text: message,
          response_at: new Date().toISOString(),
        })
        .eq('id', target.id)

      // Clear active workflow on thread
      await supabase
        .from('message_threads')
        .update({ active_workflow_id: null })
        .eq('operative_id', target.operative_id)
        .eq('organization_id', orgId)

      await supabase.from('workflow_events').insert({
        workflow_run_id: target.workflow_run_id,
        target_id: target.id,
        event_type: 'completed',
        details: { outcome: 'rejected_rtw' },
      })

      return extraction.reply || `Thanks for letting us know. Unfortunately we can only work with people who have the right to work in the UK. Best of luck!`
    }

    // Apply extracted data to operative record
    if (Object.keys(extraction.extracted).length > 0) {
      const dbUpdate = mapExtractedToDbUpdate(extraction.extracted, supabase, orgId)

      // Handle trade matching separately
      if (extraction.extracted.trade) {
        const tradeId = await matchTrade(supabase, orgId, String(extraction.extracted.trade))
        if (tradeId) dbUpdate.trade_category_id = tradeId
      }

      // Update operative record in real-time
      if (Object.keys(dbUpdate).length > 0) {
        await supabase
          .from('operatives')
          .update({ ...dbUpdate, updated_at: new Date().toISOString() })
          .eq('id', target.operative_id)
          .eq('organization_id', orgId)

        console.log(`[smart-onboarding] Updated operative ${target.operative_id}:`, Object.keys(dbUpdate))
      }

      // Track in collected
      Object.assign(data.collected, extraction.extracted)
    }

    // Re-analyse gaps after update
    const updatedGaps = (await analyseAndGetNext(supabase, target.operative_id, orgId)).gaps

    // Check if conversational phase is done
    if (updatedGaps.conversational.length === 0) {
      // Move to form phase if there are form/doc gaps
      if (updatedGaps.formBased.length > 0 || updatedGaps.documents.length > 0) {
        const link = await generateUploadLink(supabase, target.operative_id, {
          dataFields: updatedGaps.formBased.map(g => g.key),
          documentTypes: updatedGaps.documents.map(g => g.key),
        })

        data.onboarding_phase = 'form_pending'
        data.form_link = link
        data.form_fields = updatedGaps.formBased.map(g => g.key)
        data.document_types = updatedGaps.documents.map(g => g.key)
        data.current_question = null
        data.current_question_label = null

        await supabase
          .from('workflow_targets')
          .update({ data, response_text: message, response_at: new Date().toISOString() })
          .eq('id', target.id)

        await supabase.from('workflow_events').insert({
          workflow_run_id: target.workflow_run_id,
          target_id: target.id,
          event_type: 'phase_change',
          details: { from: 'conversational', to: 'form_pending', form_fields: data.form_fields, document_types: data.document_types },
        })

        const formIntro = updatedGaps.documents.length > 0
          ? `We also need a couple of documents from you.`
          : `We just need a few more details.`

        return `${extraction.reply}\n\n${formIntro} Please complete the rest using this secure link:\n${link}`
      }

      // Everything is done!
      data.onboarding_phase = 'complete'
      await supabase
        .from('workflow_targets')
        .update({ status: 'completed', outcome: 'onboarding_complete', data })
        .eq('id', target.id)

      await supabase
        .from('message_threads')
        .update({ active_workflow_id: null })
        .eq('operative_id', target.operative_id)
        .eq('organization_id', orgId)

      // Update operative status
      await supabase
        .from('operatives')
        .update({ status: 'qualifying', updated_at: new Date().toISOString() })
        .eq('id', target.operative_id)

      await supabase.from('workflow_events').insert({
        workflow_run_id: target.workflow_run_id,
        target_id: target.id,
        event_type: 'completed',
        details: { outcome: 'onboarding_complete' },
      })

      return `${extraction.reply}\n\nThat's everything we need — you're all set! We'll be in touch soon.`
    }

    // More conversational questions to ask
    const nextGap = updatedGaps.nextConversationalQuestion!
    data.current_question = nextGap.key
    data.current_question_label = nextGap.label

    await supabase
      .from('workflow_targets')
      .update({ data, response_text: message, response_at: new Date().toISOString() })
      .eq('id', target.id)

    // Claude already includes the next question in its reply
    // But if extraction failed (circuit breaker), ask explicitly
    if (Object.keys(extraction.extracted).length === 0) {
      return getQuestionForGap(nextGap, op.first_name ?? 'there')
    }

    return extraction.reply
  },

  async onUpload(
    ctx: WorkflowContext,
    target: WorkflowTargetWithOperative,
    documentId: string,
  ): Promise<void> {
    const supabase = ctx.supabase as any // eslint-disable-line @typescript-eslint/no-explicit-any
    const data = target.data as unknown as OnboardingTargetData

    // Get the document type
    const { data: doc } = await supabase
      .from('documents')
      .select('document_type')
      .eq('id', documentId)
      .single()

    if (doc?.document_type) {
      if (!data.uploaded_docs.includes(doc.document_type)) {
        data.uploaded_docs.push(doc.document_type)
      }
    }

    // Check if all expected docs are uploaded
    const allDocsUploaded = data.document_types.every(dt => data.uploaded_docs.includes(dt))

    // Re-check form fields too
    const { gaps } = await analyseAndGetNext(supabase, target.operative_id, ctx.orgId)

    if (allDocsUploaded && gaps.formBased.length === 0) {
      // Everything complete
      data.onboarding_phase = 'complete'
      await supabase
        .from('workflow_targets')
        .update({ status: 'completed', outcome: 'onboarding_complete', data })
        .eq('id', target.id)

      await supabase
        .from('message_threads')
        .update({ active_workflow_id: null })
        .eq('operative_id', target.operative_id)
        .eq('organization_id', ctx.orgId)

      // Update operative status
      await supabase
        .from('operatives')
        .update({ status: 'qualifying', updated_at: new Date().toISOString() })
        .eq('id', target.operative_id)

      // Notify operative
      if (target.operative.phone) {
        await sendWhatsApp(
          target.operative.phone,
          `That's everything — thank you! Your profile is now complete. We'll be in touch soon with opportunities.`,
        ).catch(() => {})
      }

      await supabase.from('workflow_events').insert({
        workflow_run_id: target.workflow_run_id,
        target_id: target.id,
        event_type: 'completed',
        details: { outcome: 'onboarding_complete', trigger: 'document_upload' },
      })
    } else {
      // Partial — update data
      await supabase
        .from('workflow_targets')
        .update({ data })
        .eq('id', target.id)

      await supabase.from('workflow_events').insert({
        workflow_run_id: target.workflow_run_id,
        target_id: target.id,
        event_type: 'document_uploaded',
        details: { document_type: doc?.document_type, uploaded_docs: data.uploaded_docs },
      })
    }
  },

  async onFollowUp(ctx: WorkflowContext, target: WorkflowTargetWithOperative): Promise<void> {
    const data = target.data as unknown as OnboardingTargetData
    const op = target.operative
    if (!op.phone) return

    const orgName = await getOrgName(ctx.supabase, ctx.orgId)

    if (data.onboarding_phase === 'conversational' && data.current_question) {
      // Re-ask current question
      const { gaps } = await analyseAndGetNext(ctx.supabase, target.operative_id, ctx.orgId)
      const currentGap = gaps.conversational.find(g => g.key === data.current_question)
      const question = currentGap
        ? getQuestionForGap(currentGap, op.first_name ?? 'there')
        : `Hi ${op.first_name ?? 'there'}, just checking in — we still need a few details from you. Can you reply when you have a moment?`

      await smartSendWhatsApp({
        phone: op.phone,
        freeformBody: question,
        operativeId: target.operative_id,
        firstName: op.first_name ?? 'there',
        orgName,
      })
    } else if (data.onboarding_phase === 'form_pending' && data.form_link) {
      await smartSendWhatsApp({
        phone: op.phone,
        freeformBody: `Hi ${op.first_name ?? 'there'}, just a reminder — we still need a few details and documents from you. Please use this link: ${data.form_link}`,
        operativeId: target.operative_id,
        firstName: op.first_name ?? 'there',
        orgName,
      })
    }
  },

  async onTimeout(ctx: WorkflowContext, target: WorkflowTargetWithOperative): Promise<void> {
    const supabase = ctx.supabase as any // eslint-disable-line @typescript-eslint/no-explicit-any
    const op = target.operative

    // Clear active workflow
    await supabase
      .from('message_threads')
      .update({ active_workflow_id: null })
      .eq('operative_id', target.operative_id)
      .eq('organization_id', ctx.orgId)

    // Create notification for staff
    const { createNotification } = await import('@/lib/notifications/create')
    await createNotification(supabase, {
      type: 'compliance_block',
      title: `Onboarding stalled: ${op.first_name} ${op.last_name}`,
      body: `No response after multiple follow-ups. Review and contact manually.`,
      severity: 'warning',
      operative_id: target.operative_id,
      push: true,
    })

    await supabase.from('workflow_events').insert({
      workflow_run_id: target.workflow_run_id,
      target_id: target.id,
      event_type: 'timed_out',
      details: { messages_sent: target.messages_sent },
    })
  },
}
