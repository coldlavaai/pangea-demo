import Anthropic from '@anthropic-ai/sdk'
import type { WorkflowDefinition, WorkflowContext, WorkflowTargetWithOperative } from '../types'
import { initiateEngagement } from '../engagement'
import { smartSendWhatsApp } from '@/lib/whatsapp/smart-send'
import { sendWhatsApp, sendTranslatedWhatsApp } from '@/lib/whatsapp/send'
import { generateUploadLink } from '../upload-link'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const FIELD_LABELS: Record<string, string> = {
  email: 'email address',
  phone: 'phone number',
  address: 'home address',
  bank_details: 'bank account details',
  ni_number: 'National Insurance number',
  utr: 'UTR number',
  nok_name: "next of kin's name",
  nok_phone: "next of kin's phone number",
}

async function parseFieldFromMessage(field: string, message: string): Promise<string | null> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 128,
      messages: [{
        role: 'user',
        content: `Extract the ${field} from this message. Reply with ONLY the extracted value, nothing else. If you can't find a valid ${field}, reply with "null".\n\nMessage: "${message}"\n\nExtracted ${field}:`,
      }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : 'null'
    if (text.toLowerCase() === 'null' || !text) return null
    return text
  } catch {
    return null
  }
}

/**
 * Build the freeform data collection message.
 */
function buildDataMessage(firstName: string, fieldSummary: string, link: string, isMultiField: boolean): string {
  if (isMultiField) {
    return `Hi ${firstName}, we need a few details to complete your record. Please fill in this quick form: ${link} — Pangaea`
  }
  return `Hi ${firstName}, we're updating your records. Please provide your ${fieldSummary} here: ${link} — Pangaea`
}

export const dataCollectionWorkflow: WorkflowDefinition = {
  type: 'data_collection',
  label: 'Data Collection',
  description: 'Collect missing fields from operatives via a web form link or WhatsApp reply',
  requiredParams: ['operative_ids'],

  async onTrigger(ctx: WorkflowContext) {
    const { run, orgId } = ctx
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = ctx.supabase as any

    // Support both single field (data_field) and multiple fields (data_fields array or comma string)
    const rawFields = run.config.data_fields ?? run.config.data_field
    const dataFields: string[] = Array.isArray(rawFields)
      ? rawFields
      : typeof rawFields === 'string'
        ? rawFields.split(',').map((f: string) => f.trim()).filter(Boolean)
        : []

    if (!dataFields.length) {
      console.error('[data-collection] no data_fields configured on run', run.id)
      return
    }

    const fieldLabels = dataFields.map(f => FIELD_LABELS[f] ?? f)
    const fieldSummary = fieldLabels.length === 1
      ? fieldLabels[0]
      : fieldLabels.slice(0, -1).join(', ') + ' and ' + fieldLabels[fieldLabels.length - 1]

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
        const link = await generateUploadLink(ctx.supabase, target.operative_id, { dataFields, language: op.preferred_language })

        // Check engagement state
        const engagementState = await initiateEngagement(supabase, op.phone, op.first_name, op.preferred_language)

        if (engagementState === 'engaged') {
          const body = buildDataMessage(op.first_name, fieldSummary, link, dataFields.length > 1)
          await sendTranslatedWhatsApp(op.phone, body, op.preferred_language)
        }

        await supabase.from('workflow_targets').update({
          status: 'contacted',
          engagement_state: engagementState,
          messages_sent: 1,
          last_contacted_at: new Date().toISOString(),
          next_follow_up_at: nextFollowUp,
          data: { ...(target.data ?? {}), form_link: link, data_fields: dataFields, field_summary: fieldSummary },
          updated_at: new Date().toISOString(),
        }).eq('id', target.id)

        await supabase.from('message_threads')
          .update({ active_workflow_id: run.id })
          .eq('phone_number', op.phone)
          .eq('organization_id', orgId)

        contacted++
      } catch (e) {
        console.error('[data-collection] failed to contact operative', target.operative_id, e)
      }
    }

    await supabase.from('workflow_runs').update({
      targets_contacted: contacted,
      updated_at: new Date().toISOString(),
    }).eq('id', run.id)
  },

  async onEngaged(_ctx: WorkflowContext, target: WorkflowTargetWithOperative) {
    const formLink = target.data.form_link as string | null
    const fieldSummary = target.data.field_summary as string | null
    const dataFields = (target.data.data_fields as string[]) ?? []
    const { phone, first_name } = target.operative

    if (!phone || !formLink) return null

    if (target.messages_sent > 1) {
      // Re-engagement after follow-up — send reminder
      await sendTranslatedWhatsApp(
        phone,
        `Hi ${first_name}, just a reminder — could you fill in this quick form? ${formLink} — Pangaea`,
        target.operative.preferred_language,
      )
    } else {
      // First engagement — send full content
      const body = buildDataMessage(first_name, fieldSummary ?? 'some details', formLink, dataFields.length > 1)
      await sendTranslatedWhatsApp(phone, body, target.operative.preferred_language)
    }

    return null
  },

  async onInbound(ctx: WorkflowContext, target: WorkflowTargetWithOperative, message: string) {
    const { run, orgId } = ctx
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = ctx.supabase as any
    const dataField = run.config.data_field as string
    const fieldLabel = FIELD_LABELS[dataField] ?? dataField
    const { first_name, phone } = target.operative

    const extracted = await parseFieldFromMessage(dataField, message)

    if (extracted) {
      await ctx.supabase.from('operatives').update({ [dataField]: extracted }).eq('id', target.operative_id)

      await supabase.from('workflow_targets').update({
        status: 'completed',
        outcome: 'data_collected',
        next_follow_up_at: null,
        data: { ...target.data, extracted_value: extracted },
        updated_at: new Date().toISOString(),
      }).eq('id', target.id)

      if (phone) {
        await supabase.from('message_threads')
          .update({ active_workflow_id: null })
          .eq('phone_number', phone)
          .eq('organization_id', orgId)
      }

      const { error: rcErr } = await supabase.from('workflow_runs').update({
        targets_completed: run.targets_completed + 1,
        updated_at: new Date().toISOString(),
      }).eq('id', run.id)
      if (rcErr) console.error('[data-collection] run counter update error:', rcErr.message)

      await supabase.from('workflow_events').insert({
        workflow_run_id: run.id,
        target_id: target.id,
        event_type: 'completed',
        data: { outcome: 'data_collected', field: dataField, value: extracted },
      })

      return `Thanks ${first_name}! We've updated your ${fieldLabel}. If anything looks wrong, just let us know.`
    }

    return `Thanks ${first_name}! Could you send just your ${fieldLabel} please? For example, just the ${fieldLabel} on its own.`
  },

  async onUpload() {
    // Not applicable for data collection
  },

  async onFollowUp(ctx: WorkflowContext, target: WorkflowTargetWithOperative) {
    const { run } = ctx
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = ctx.supabase as any
    const dataField = run.config.data_field as string
    const fieldLabel = FIELD_LABELS[dataField] ?? dataField
    const { phone, first_name } = target.operative

    if (!phone) return

    await smartSendWhatsApp({
      phone,
      freeformBody: `Hi ${first_name}, just a reminder — could you reply with your ${fieldLabel}? — Pangaea`,
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
    const dataField = run.config.data_field as string
    const fieldLabel = FIELD_LABELS[dataField] ?? dataField
    const { phone, first_name, last_name } = target.operative
    const fullName = `${first_name} ${last_name}`

    const staffNumber = process.env.STAFF_WHATSAPP_NUMBER
    if (staffNumber) {
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://pangaea-demo.vercel.app').trim()
      await sendWhatsApp(
        staffNumber,
        `⚠️ *Data Collection — No Response*\n\n${fullName} hasn't provided their ${fieldLabel} after ${target.messages_sent} reminders.\n\n${appUrl}/operatives/${target.operative_id}`
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
