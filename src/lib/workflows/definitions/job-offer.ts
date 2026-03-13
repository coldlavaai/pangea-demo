import type { WorkflowDefinition, WorkflowContext, WorkflowTargetWithOperative } from '../types'
import { initiateEngagement } from '../engagement'
import { sendWhatsApp, sendTranslatedWhatsApp } from '@/lib/whatsapp/send'
import { smartSendWhatsApp } from '@/lib/whatsapp/smart-send'
import { detectOfferIntent } from '@/lib/whatsapp/offer-handler'

// 30-minute offer window — starts when operative ENGAGES, not when RE_ENGAGE is sent
const OFFER_WINDOW_MINS = 30

/**
 * Send the actual offer content to an operative who is engaged (24h window open).
 * Used by both onTrigger (within 24h) and onEngaged (after RE_ENGAGE reply).
 */
async function sendOfferContent(
  ctx: WorkflowContext,
  target: WorkflowTargetWithOperative,
  allocationId: string,
  siteName: string,
  dayRate: number,
  startDate: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = ctx.supabase as any
  const { phone, first_name } = target.operative
  if (!phone) return

  const offerExpiresAt = new Date(Date.now() + OFFER_WINDOW_MINS * 60 * 1000).toISOString()
  const startDateFormatted = new Date(startDate).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  })

  // Set the 30-min window NOW — when the operative is actually engaged
  await supabase.from('allocations').update({
    offer_sent_at: new Date().toISOString(),
    offer_expires_at: offerExpiresAt,
  }).eq('id', allocationId)

  await sendTranslatedWhatsApp(
    phone,
    `Hi ${first_name}, we have work available:\n\n` +
    `📍 *${siteName}*\n` +
    `📅 Starting ${startDateFormatted}\n` +
    `💷 £${dayRate}/day\n\n` +
    `Reply *ACCEPT* to confirm or *DECLINE* to pass.\n` +
    `⏱️ You have ${OFFER_WINDOW_MINS} minutes to respond — after that the offer may go to other operatives.\n\n` +
    `— Pangaea`,
    target.operative.preferred_language,
  )

  // Update follow-up to match the offer window
  await supabase.from('workflow_targets').update({
    next_follow_up_at: offerExpiresAt,
    updated_at: new Date().toISOString(),
  }).eq('id', target.id)
}

export const jobOfferWorkflow: WorkflowDefinition = {
  type: 'job_offer',
  label: 'Job Offer',
  description: 'Send job offers to operatives, track ACCEPT/DECLINE responses, and auto-confirm allocations',
  requiredParams: ['operative_ids', 'site_id', 'day_rate', 'start_date'],

  async onTrigger(ctx: WorkflowContext) {
    const { run, orgId } = ctx
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = ctx.supabase as any
    const siteId = run.config.site_id as string
    const dayRate = run.config.day_rate as number
    const startDate = run.config.start_date as string

    const { data: site } = await ctx.supabase
      .from('sites')
      .select('name')
      .eq('id', siteId)
      .single()
    const siteName = (site as { name?: string } | null)?.name ?? 'the site'

    const { data: targets } = await supabase
      .from('workflow_targets')
      .select('id, operative_id, data, operative:operatives!workflow_targets_operative_id_fkey(first_name, last_name, phone, email, cscs_card_type, preferred_language)')
      .eq('workflow_run_id', run.id)
      .eq('status', 'pending')

    let contacted = 0

    for (const target of targets ?? []) {
      const op = target.operative
      if (!op?.phone) continue

      try {
        // Create allocation with pending status — no offer_expires_at yet
        const { data: allocation } = await ctx.supabase
          .from('allocations')
          .insert({
            organization_id: orgId,
            operative_id: target.operative_id,
            site_id: siteId,
            status: 'pending',
            agreed_day_rate: dayRate,
            actual_start: startDate,
          })
          .select('id')
          .single()

        if (!allocation) continue

        // Check engagement state — are they within 24h window?
        const engagementState = await initiateEngagement(supabase, op.phone, op.first_name, op.preferred_language)

        if (engagementState === 'engaged') {
          // Within 24h — send offer content directly
          await sendOfferContent(
            ctx,
            { ...target, engagement_state: 'engaged' } as WorkflowTargetWithOperative,
            (allocation as { id: string }).id,
            siteName,
            dayRate,
            startDate,
          )
        }

        // Store all data needed for onEngaged
        await supabase.from('workflow_targets').update({
          status: 'contacted',
          engagement_state: engagementState,
          messages_sent: 1,
          last_contacted_at: new Date().toISOString(),
          // If re_engaged, set a generous follow-up (24h) — will be tightened in onEngaged
          next_follow_up_at: engagementState === 're_engaged'
            ? new Date(Date.now() + run.follow_up_hours * 60 * 60 * 1000).toISOString()
            : new Date(Date.now() + OFFER_WINDOW_MINS * 60 * 1000).toISOString(),
          data: {
            ...(target.data ?? {}),
            allocation_id: (allocation as { id: string }).id,
            site_name: siteName,
          },
          updated_at: new Date().toISOString(),
        }).eq('id', target.id)

        await supabase.from('message_threads')
          .update({ active_workflow_id: run.id })
          .eq('phone_number', op.phone)
          .eq('organization_id', orgId)

        contacted++
      } catch (e) {
        console.error('[job-offer] failed to send offer', target.operative_id, e)
      }
    }

    await supabase.from('workflow_runs').update({
      targets_contacted: contacted,
      updated_at: new Date().toISOString(),
    }).eq('id', run.id)
  },

  async onEngaged(ctx: WorkflowContext, target: WorkflowTargetWithOperative) {
    const { run } = ctx
    const allocationId = target.data.allocation_id as string | null
    const siteName = (target.data.site_name as string | null) ?? 'the site'
    const dayRate = run.config.day_rate as number
    const startDate = run.config.start_date as string

    if (!allocationId || !target.operative.phone) return null

    // Operative just replied to RE_ENGAGE — now deliver the actual offer
    await sendOfferContent(ctx, target, allocationId, siteName, dayRate, startDate)

    // No text reply needed — the offer message itself is sent via sendWhatsApp in sendOfferContent
    return null
  },

  async onInbound(ctx: WorkflowContext, target: WorkflowTargetWithOperative, message: string) {
    const { run, orgId } = ctx
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = ctx.supabase as any
    const allocationId = target.data.allocation_id as string | null
    const siteName = (target.data.site_name as string | null) ?? 'the site'
    const dayRate = run.config.day_rate as number
    const startDate = run.config.start_date as string
    const { first_name, last_name, phone } = target.operative
    const fullName = `${first_name} ${last_name}`

    // Detect intent — supports YES/NO and ACCEPT/DECLINE
    const normalised = message.trim().toLowerCase()
    const isAccept = normalised === 'accept' || detectOfferIntent(message) === 'yes'
    const isDecline = normalised === 'decline' || detectOfferIntent(message) === 'no'

    const startDateFormatted = new Date(startDate).toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
    })

    if (isAccept && allocationId) {
      await ctx.supabase.from('allocations').update({ status: 'confirmed' }).eq('id', allocationId)

      await supabase.from('workflow_targets').update({
        status: 'completed',
        outcome: 'offer_accepted',
        next_follow_up_at: null,
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
      if (rcErr) console.error('[job-offer] run counter update error:', rcErr.message)

      await supabase.from('workflow_events').insert({
        workflow_run_id: run.id,
        target_id: target.id,
        event_type: 'completed',
        data: { outcome: 'offer_accepted', operative: fullName },
      })

      return `Brilliant ${first_name}! You're confirmed for ${siteName} starting ${startDateFormatted} at £${dayRate}/day. The Labour Manager will be in touch with more details.`
    }

    if (isDecline && allocationId) {
      await ctx.supabase.from('allocations').update({ status: 'terminated' }).eq('id', allocationId)

      await supabase.from('workflow_targets').update({
        status: 'completed',
        outcome: 'offer_declined',
        next_follow_up_at: null,
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
      if (rcErr) console.error('[job-offer] run counter update error:', rcErr.message)

      await supabase.from('workflow_events').insert({
        workflow_run_id: run.id,
        target_id: target.id,
        event_type: 'completed',
        data: { outcome: 'offer_declined', operative: fullName },
      })

      return `No problem ${first_name}. Thanks for letting us know — we'll keep you in mind for future opportunities.`
    }

    return `Hi ${first_name}, please reply *ACCEPT* to confirm the job offer or *DECLINE* to pass.`
  },

  async onUpload() {
    // Not applicable for job offers
  },

  async onFollowUp(ctx: WorkflowContext, target: WorkflowTargetWithOperative) {
    const { run } = ctx
    const siteName = (target.data.site_name as string | null) ?? 'the site'
    const dayRate = run.config.day_rate as number
    const startDate = run.config.start_date as string
    const { phone, first_name } = target.operative

    if (!phone) return

    const startDateFormatted = new Date(startDate).toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
    })

    // Use smartSendWhatsApp — handles 24h window automatically
    await smartSendWhatsApp({
      phone,
      freeformBody: `Hi ${first_name}, just checking — are you available for ${siteName} starting ${startDateFormatted} at £${dayRate}/day? Reply *ACCEPT* or *DECLINE*. — Pangaea`,
      operativeId: target.operative_id,
      firstName: first_name,
    })
  },

  async onTimeout(ctx: WorkflowContext, target: WorkflowTargetWithOperative) {
    const { run, orgId } = ctx
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = ctx.supabase as any
    const allocationId = target.data.allocation_id as string | null
    const siteName = (target.data.site_name as string | null) ?? 'the site'
    const { phone, first_name, last_name } = target.operative
    const fullName = `${first_name} ${last_name}`

    if (allocationId) {
      await ctx.supabase.from('allocations').update({ status: 'terminated' }).eq('id', allocationId)
    }

    const staffNumber = process.env.STAFF_WHATSAPP_NUMBER
    if (staffNumber) {
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://pangaea-demo.vercel.app').trim()
      await sendWhatsApp(
        staffNumber,
        `⚠️ *Job Offer — No Response*\n\n${fullName} didn't respond to the offer for ${siteName} after ${target.messages_sent} attempts.\n\n${appUrl}/operatives/${target.operative_id}`
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
