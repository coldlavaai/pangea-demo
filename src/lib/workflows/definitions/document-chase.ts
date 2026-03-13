import type { WorkflowDefinition, WorkflowContext, WorkflowTargetWithOperative } from '../types'
import { generateUploadLink } from '../upload-link'
import { initiateEngagement } from '../engagement'
import { smartSendWhatsApp } from '@/lib/whatsapp/smart-send'
import { sendWhatsApp, sendTranslatedWhatsApp } from '@/lib/whatsapp/send'

const DOC_TYPE_LABELS: Record<string, string> = {
  right_to_work: 'Right to Work document',
  passport: 'passport',
  cscs_card: 'CSCS card',
  photo_id: 'photo ID (passport or driving licence)',
  cpcs_ticket: 'CPCS ticket',
  npors_ticket: 'NPORS ticket',
  first_aid: 'First Aid certificate',
  other: 'document',
}

/**
 * Send the document chase content to an engaged operative.
 * Used by both onTrigger (within 24h) and onEngaged (after RE_ENGAGE reply).
 */
async function sendChaseContent(
  phone: string,
  firstName: string,
  docLabel: string,
  uploadLink: string,
  language?: string | null,
): Promise<void> {
  await sendTranslatedWhatsApp(
    phone,
    `Hi ${firstName}, we need your ${docLabel} on file. Please upload it here: ${uploadLink} — Pangaea`,
    language,
  )
}

export const documentChaseWorkflow: WorkflowDefinition = {
  type: 'document_chase',
  label: 'Document Chase',
  description: 'Chase operatives to upload a required document via the self-service portal',
  requiredParams: ['document_type', 'operative_ids'],

  async onTrigger(ctx: WorkflowContext) {
    const { run, orgId } = ctx
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = ctx.supabase as any
    const documentType = run.config.document_type as string
    const docLabel = DOC_TYPE_LABELS[documentType] ?? 'document'

    const { data: targets } = await supabase
      .from('workflow_targets')
      .select('id, operative_id, data, operative:operatives!workflow_targets_operative_id_fkey(first_name, last_name, phone, email, cscs_card_type, preferred_language)')
      .eq('workflow_run_id', run.id)
      .eq('status', 'pending')

    let contacted = 0
    const nextFollowUp = new Date(Date.now() + run.follow_up_hours * 60 * 60 * 1000).toISOString()

    for (const target of targets ?? []) {
      const op = target.operative
      if (!op?.phone) continue

      try {
        const link = await generateUploadLink(ctx.supabase, target.operative_id, { documentType, language: op.preferred_language })

        // Check engagement state
        const engagementState = await initiateEngagement(supabase, op.phone, op.first_name, op.preferred_language)

        if (engagementState === 'engaged') {
          await sendChaseContent(op.phone, op.first_name, docLabel, link, op.preferred_language)
        }

        await supabase.from('workflow_targets').update({
          status: 'contacted',
          engagement_state: engagementState,
          messages_sent: 1,
          last_contacted_at: new Date().toISOString(),
          next_follow_up_at: nextFollowUp,
          data: { ...(target.data ?? {}), upload_link: link, document_type: documentType },
          updated_at: new Date().toISOString(),
        }).eq('id', target.id)

        await supabase.from('message_threads')
          .update({ active_workflow_id: run.id })
          .eq('phone_number', op.phone)
          .eq('organization_id', orgId)

        contacted++
      } catch (e) {
        console.error('[document-chase] failed to contact operative', target.operative_id, e)
      }
    }

    await supabase.from('workflow_runs').update({
      targets_contacted: contacted,
      updated_at: new Date().toISOString(),
    }).eq('id', run.id)
  },

  async onEngaged(_ctx: WorkflowContext, target: WorkflowTargetWithOperative) {
    const uploadLink = target.data.upload_link as string | null
    const documentType = target.data.document_type as string | null
    const docLabel = documentType ? (DOC_TYPE_LABELS[documentType] ?? 'document') : 'document'
    const { phone, first_name } = target.operative

    if (!phone || !uploadLink) return null

    if (target.messages_sent > 1) {
      // This is a re-engagement after a follow-up — send reminder
      await sendTranslatedWhatsApp(
        phone,
        `Hi ${first_name}, just a reminder — we still need your ${docLabel}. Upload here: ${uploadLink} — Pangaea`,
        target.operative.preferred_language,
      )
    } else {
      // First engagement — send full content
      await sendChaseContent(phone, first_name, docLabel, uploadLink, target.operative.preferred_language)
    }

    return null
  },

  async onInbound(_ctx: WorkflowContext, target: WorkflowTargetWithOperative) {
    const uploadLink = target.data.upload_link as string | null
    const name = target.operative.first_name
    if (uploadLink) {
      return `Thanks ${name}! Please use the upload link to submit your document: ${uploadLink}`
    }
    return `Thanks ${name}! Please use the upload link we sent you to submit your document.`
  },

  async onUpload(ctx: WorkflowContext, target: WorkflowTargetWithOperative, documentId: string) {
    const { run, orgId } = ctx
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = ctx.supabase as any

    await supabase.from('workflow_targets').update({
      status: 'completed',
      outcome: 'document_uploaded',
      next_follow_up_at: null,
      updated_at: new Date().toISOString(),
    }).eq('id', target.id)

    if (target.operative.phone) {
      await supabase.from('message_threads')
        .update({ active_workflow_id: null })
        .eq('phone_number', target.operative.phone)
        .eq('organization_id', orgId)
    }

    const { error: rcErr } = await supabase.from('workflow_runs').update({
      targets_completed: run.targets_completed + 1,
      updated_at: new Date().toISOString(),
    }).eq('id', run.id)
    if (rcErr) console.error('[document-chase] run counter update error:', rcErr.message)

    await supabase.from('workflow_events').insert({
      workflow_run_id: run.id,
      target_id: target.id,
      event_type: 'completed',
      data: { outcome: 'document_uploaded', document_id: documentId },
    })
  },

  async onFollowUp(ctx: WorkflowContext, target: WorkflowTargetWithOperative) {
    const { run } = ctx
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = ctx.supabase as any
    const documentType = run.config.document_type as string
    const docLabel = DOC_TYPE_LABELS[documentType] ?? 'document'
    const uploadLink = target.data.upload_link as string | null
    const { phone, first_name } = target.operative

    if (!phone || !uploadLink) return

    await smartSendWhatsApp({
      phone,
      freeformBody: `Hi ${first_name}, just a reminder — we still need your ${docLabel}. Upload here: ${uploadLink} — Pangaea`,
      operativeId: target.operative_id,
      firstName: first_name,
    })

    await supabase.from('workflow_events').insert({
      workflow_run_id: run.id,
      target_id: target.id,
      event_type: 'message_sent',
      data: { type: 'follow_up', follow_up_number: target.messages_sent + 1 },
    })
  },

  async onTimeout(ctx: WorkflowContext, target: WorkflowTargetWithOperative) {
    const { run, orgId } = ctx
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = ctx.supabase as any
    const documentType = run.config.document_type as string
    const docLabel = DOC_TYPE_LABELS[documentType] ?? 'document'
    const { phone, first_name, last_name } = target.operative
    const fullName = `${first_name} ${last_name}`

    if (phone) {
      await sendTranslatedWhatsApp(
        phone,
        `Hi ${first_name}, we've tried to reach you about your ${docLabel}. Please contact the Labour Manager directly to sort this out.`,
        target.operative.preferred_language,
      )
    }

    const staffNumber = process.env.STAFF_WHATSAPP_NUMBER
    if (staffNumber) {
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://pangaea-demo.vercel.app').trim()
      await sendWhatsApp(
        staffNumber,
        `⚠️ *Document Chase — No Response*\n\n${fullName} hasn't uploaded their ${docLabel} after ${target.messages_sent} reminders.\n\n${appUrl}/operatives/${target.operative_id}`
      )
    }

    if (phone) {
      await supabase.from('message_threads')
        .update({ active_workflow_id: null })
        .eq('phone_number', phone)
        .eq('organization_id', orgId)
    }
  },
}
