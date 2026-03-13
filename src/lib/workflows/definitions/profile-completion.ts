import type { WorkflowDefinition, WorkflowContext, WorkflowTargetWithOperative } from '../types'
import { generateUploadLink } from '../upload-link'
import { initiateEngagement } from '../engagement'
import { smartSendWhatsApp } from '@/lib/whatsapp/smart-send'
import { sendWhatsApp, sendTranslatedWhatsApp } from '@/lib/whatsapp/send'

const DATA_FIELD_LABELS: Record<string, string> = {
  email: 'email address',
  phone: 'phone number',
  address: 'address',
  bank_details: 'bank account details',
  ni_number: 'National Insurance number',
  utr: 'UTR number',
  nok_name: "next of kin's name",
  nok_phone: "next of kin's phone number",
  date_of_birth: 'date of birth',
}

/**
 * Build the profile completion message content.
 */
function buildProfileMessage(
  firstName: string,
  dataFields: string[],
  documentTypes: string[],
  link: string,
): string {
  const parts: string[] = []
  if (dataFields.length) {
    const labels = dataFields.map(f => DATA_FIELD_LABELS[f] ?? f)
    parts.push(labels.length === 1 ? labels[0] : 'a few details')
  }
  if (documentTypes.length) {
    parts.push(documentTypes.length === 1 ? 'a document' : 'some documents')
  }
  const what = parts.join(' and ')
  return `Hi ${firstName}, we need ${what} from you to keep your record up to date. Please use this link: ${link} — Pangaea`
}

export const profileCompletionWorkflow: WorkflowDefinition = {
  type: 'profile_completion',
  label: 'Profile Completion',
  description: 'Send a single WhatsApp link to collect missing data fields and/or documents in one go',
  requiredParams: ['operative_ids'],

  async onTrigger(ctx: WorkflowContext) {
    const { run, orgId } = ctx
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = ctx.supabase as any

    const dataFields: string[] = Array.isArray(run.config.data_fields) ? run.config.data_fields as string[] : []
    const documentTypes: string[] = Array.isArray(run.config.document_types) ? run.config.document_types as string[] : []

    const { data: targets } = await supabase
      .from('workflow_targets')
      .select('id, operative_id, data, operative:operatives!workflow_targets_operative_id_fkey(first_name, last_name, phone, email, preferred_language)')
      .eq('workflow_run_id', run.id)
      .eq('status', 'pending')

    let contacted = 0
    const nextFollowUp = new Date(Date.now() + run.follow_up_hours * 60 * 60 * 1000).toISOString()

    for (const target of targets ?? []) {
      const op = target.operative
      if (!op?.phone) continue

      try {
        const link = await generateUploadLink(ctx.supabase, target.operative_id, {
          dataFields: dataFields.length ? dataFields : undefined,
          documentTypes: documentTypes.length ? documentTypes : undefined,
          language: op.preferred_language,
        })

        // Check engagement state
        const engagementState = await initiateEngagement(supabase, op.phone, op.first_name, op.preferred_language)

        if (engagementState === 'engaged') {
          const body = buildProfileMessage(op.first_name, dataFields, documentTypes, link)
          await sendTranslatedWhatsApp(op.phone, body, op.preferred_language)
        }

        await supabase.from('workflow_targets').update({
          status: 'contacted',
          engagement_state: engagementState,
          messages_sent: 1,
          last_contacted_at: new Date().toISOString(),
          next_follow_up_at: nextFollowUp,
          data: {
            ...(target.data ?? {}),
            profile_link: link,
            data_fields: dataFields,
            document_types: documentTypes,
            uploaded_docs: [],
          },
          updated_at: new Date().toISOString(),
        }).eq('id', target.id)

        await supabase.from('message_threads')
          .update({ active_workflow_id: run.id })
          .eq('phone_number', op.phone)
          .eq('organization_id', orgId)

        contacted++
      } catch (e) {
        console.error('[profile-completion] failed to contact', target.operative_id, e instanceof Error ? e.message : e)
      }
    }

    await supabase.from('workflow_runs').update({
      targets_contacted: contacted,
      updated_at: new Date().toISOString(),
    }).eq('id', run.id)
  },

  async onEngaged(_ctx: WorkflowContext, target: WorkflowTargetWithOperative) {
    const link = target.data.profile_link as string | null
    const dataFields = (target.data.data_fields as string[]) ?? []
    const documentTypes = (target.data.document_types as string[]) ?? []
    const { phone, first_name } = target.operative

    if (!phone || !link) return null

    if (target.messages_sent > 1) {
      // Re-engagement after follow-up — send reminder
      await sendTranslatedWhatsApp(
        phone,
        `Hi ${first_name}, just a reminder — we still need a few things from you to keep your record up to date: ${link} — Pangaea`,
        target.operative.preferred_language,
      )
    } else {
      // First engagement — send full content
      const body = buildProfileMessage(first_name, dataFields, documentTypes, link)
      await sendTranslatedWhatsApp(phone, body, target.operative.preferred_language)
    }

    return null
  },

  async onInbound(_ctx: WorkflowContext, target: WorkflowTargetWithOperative) {
    const link = target.data.profile_link as string | null
    const name = target.operative.first_name
    if (link) {
      return `Thanks ${name}! Please use this link to complete your details: ${link}`
    }
    return `Thanks ${name}! Please use the link we sent you to complete your details.`
  },

  async onUpload(ctx: WorkflowContext, target: WorkflowTargetWithOperative, documentId: string) {
    const { run, orgId } = ctx
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = ctx.supabase as any

    const expectedDocs = (target.data.document_types as string[]) ?? []
    const uploadedDocs = (target.data.uploaded_docs as string[]) ?? []

    // Get the uploaded document type from DB
    const { data: doc } = await supabase
      .from('documents')
      .select('document_type')
      .eq('id', documentId)
      .maybeSingle()

    const docType = doc?.document_type as string | null
    const newUploadedDocs = docType ? [...new Set([...uploadedDocs, docType])] : uploadedDocs

    const allDocsUploaded = expectedDocs.length === 0 || expectedDocs.every((d: string) => newUploadedDocs.includes(d))

    await supabase.from('workflow_events').insert({
      workflow_run_id: run.id,
      target_id: target.id,
      event_type: 'document_uploaded',
      data: { document_id: documentId, doc_type: docType },
    })

    if (allDocsUploaded) {
      await supabase.from('workflow_targets').update({
        status: 'completed',
        outcome: 'profile_completed',
        next_follow_up_at: null,
        data: { ...target.data, uploaded_docs: newUploadedDocs },
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
      if (rcErr) console.error('[profile-completion] run counter update error:', rcErr.message)

      await supabase.from('workflow_events').insert({
        workflow_run_id: run.id,
        target_id: target.id,
        event_type: 'completed',
        data: { outcome: 'profile_completed', uploaded_docs: newUploadedDocs },
      })
    } else {
      // More documents still needed — update tracking, keep status as contacted
      await supabase.from('workflow_targets').update({
        data: { ...target.data, uploaded_docs: newUploadedDocs },
        updated_at: new Date().toISOString(),
      }).eq('id', target.id)
    }
  },

  async onFollowUp(ctx: WorkflowContext, target: WorkflowTargetWithOperative) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = ctx.supabase as any
    const link = target.data.profile_link as string | null
    const { phone, first_name } = target.operative

    if (!phone || !link) return

    await smartSendWhatsApp({
      phone,
      freeformBody: `Hi ${first_name}, just a reminder — we still need a few things from you to keep your record up to date: ${link} — Pangaea`,
      operativeId: target.operative_id,
      firstName: first_name,
    })

    await supabase.from('workflow_events').insert({
      workflow_run_id: ctx.run.id,
      target_id: target.id,
      event_type: 'message_sent',
      data: { type: 'follow_up', follow_up_number: target.messages_sent + 1 },
    })
  },

  async onTimeout(ctx: WorkflowContext, target: WorkflowTargetWithOperative) {
    const { run, orgId } = ctx
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = ctx.supabase as any
    const { phone, first_name, last_name } = target.operative
    const fullName = `${first_name} ${last_name}`

    const staffNumber = process.env.STAFF_WHATSAPP_NUMBER
    if (staffNumber) {
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://pangaea-demo.vercel.app').trim()
      await sendWhatsApp(
        staffNumber,
        `⚠️ *Profile Completion — No Response*\n\n${fullName} hasn't completed their profile after ${target.messages_sent} reminders.\n\n${appUrl}/operatives/${target.operative_id}`
      )
    }

    if (phone) {
      await supabase.from('message_threads')
        .update({ active_workflow_id: null })
        .eq('phone_number', phone)
        .eq('organization_id', orgId)

      await sendTranslatedWhatsApp(
        phone,
        `Hi ${first_name}, we've been trying to update your record. Please contact the Labour Manager directly to sort this out.`,
        target.operative.preferred_language,
      )
    }

    await supabase.from('workflow_events').insert({
      workflow_run_id: run.id,
      target_id: target.id,
      event_type: 'timed_out',
      data: { messages_sent: target.messages_sent },
    })
  },
}
