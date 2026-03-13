import { SupabaseClient } from '@supabase/supabase-js'
import { InlineKeyboard, MAIN_MENU, sendTelegram, clearInlineKeyboard } from './send'
import { createNotification } from '@/lib/notifications/create'

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!

// Show buttons directly for small lists; ask for search when larger
const SEARCH_THRESHOLD = 6

// ── Types ─────────────────────────────────────────────────────────────────────

interface StaffUser {
  id: string
  first_name: string
  last_name: string
  role: string
}

interface BotReply {
  text: string
  keyboard?: InlineKeyboard
}

type OperativeRow = {
  id: string
  first_name: string
  last_name: string
  reference_number: string | null
  trade_category: { name: string } | null
}

// ── Main entry points ─────────────────────────────────────────────────────────

export async function handleTelegramSiteManager(
  supabase: SupabaseClient,
  chatId: number,
  messageText: string,
  fromName: string,
): Promise<BotReply | null> {
  const tgPhone = `tg:${chatId}`

  const { data: thread, error: threadError } = await supabase
    .from('message_threads')
    .upsert(
      { organization_id: ORG_ID, phone_number: tgPhone },
      { onConflict: 'phone_number,organization_id', ignoreDuplicates: false }
    )
    .select('id, intake_state, intake_data')
    .single()

  if (threadError || !thread) {
    console.error('[telegram] thread upsert error', threadError)
    return { text: 'Something went wrong. Please try again.' }
  }

  const intakeState: string | null = thread.intake_state ?? null
  const intakeData: Record<string, unknown> = (thread.intake_data as Record<string, unknown>) ?? {}

  const { data: staffUser } = await supabase
    .from('users')
    .select('id, first_name, last_name, role')
    .eq('organization_id', ORG_ID)
    .eq('telegram_chat_id', chatId)
    .maybeSingle()

  if (!staffUser) {
    return handleVerification(supabase, thread.id, intakeState, messageText, chatId, fromName)
  }

  return handleCommand(supabase, staffUser, thread.id, intakeState, intakeData, messageText, chatId)
}

export async function handleTelegramCallback(
  supabase: SupabaseClient,
  chatId: number,
  callbackData: string,
  messageId: number,
): Promise<BotReply | null> {
  const tgPhone = `tg:${chatId}`

  const { data: thread } = await supabase
    .from('message_threads')
    .select('id, intake_state, intake_data')
    .eq('organization_id', ORG_ID)
    .eq('phone_number', tgPhone)
    .maybeSingle()

  if (!thread) return { text: 'Session expired. Send any message to restart.' }

  const intakeData: Record<string, unknown> = (thread.intake_data as Record<string, unknown>) ?? {}

  const { data: staffUser } = await supabase
    .from('users')
    .select('id, first_name, last_name, role')
    .eq('organization_id', ORG_ID)
    .eq('telegram_chat_id', chatId)
    .maybeSingle()

  if (!staffUser) return { text: 'Please verify your account first.' }

  await clearInlineKeyboard(chatId, messageId)

  return handleCallbackAction(supabase, staffUser, thread.id, intakeData, callbackData, chatId)
}

// ── Verification ──────────────────────────────────────────────────────────────

async function handleVerification(
  supabase: SupabaseClient,
  threadId: string,
  intakeState: string | null,
  messageText: string,
  chatId: number,
  fromName: string,
): Promise<BotReply> {
  if (intakeState !== 'sm_verify') {
    await setState(supabase, threadId, 'sm_verify', {})
    return { text: `Welcome to Pangaea Rex! 👋\n\nTo verify your identity, reply with the email address registered on your account.` }
  }

  const email = messageText.trim().toLowerCase()
  const { data: user } = await supabase
    .from('users')
    .select('id, first_name, last_name, role, telegram_chat_id')
    .eq('organization_id', ORG_ID)
    .ilike('email', email)
    .maybeSingle()

  if (!user) return { text: `No account found with that email. Please try again or contact your admin.` }

  const allowedRoles = ['admin', 'staff', 'site_manager', 'auditor', 'director', 'labour_manager', 'project_manager']
  if (!allowedRoles.includes(user.role)) {
    return { text: `Your account doesn't have site manager access. Contact your admin.` }
  }

  if (user.telegram_chat_id && user.telegram_chat_id !== chatId) {
    return { text: `This account is already linked to another Telegram account. Contact your admin.` }
  }

  await supabase.from('users').update({ telegram_chat_id: chatId }).eq('id', user.id)
  // Link thread to staff user for conversation logging
  await supabase
    .from('message_threads')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ staff_user_id: user.id } as any)
    .eq('id', threadId)
  await clearState(supabase, threadId)

  return { text: `Verified! Welcome, ${user.first_name}. 👷\n\nUse the menu buttons below to get started.` }
}

// ── Text command handler ───────────────────────────────────────────────────────

const CANCEL_WORDS = ['cancel', 'stop', 'quit', 'abort', 'back', 'exit', 'restart', '❌ cancel']
const RESET_WORDS = ['/reset', '/clear', '🔄 reset']

async function handleCommand(
  supabase: SupabaseClient,
  user: StaffUser,
  threadId: string,
  intakeState: string | null,
  intakeData: Record<string, unknown>,
  messageText: string,
  chatId: number,
): Promise<BotReply> {
  const body = messageText.trim().toLowerCase()

  // Reset (clears session + history label)
  if (RESET_WORDS.some(w => body === w)) {
    await clearState(supabase, threadId)
    return { text: `🔄 Session reset. Use the menu buttons below.` }
  }

  // Cancel mid-flow
  if (intakeState?.startsWith('sm_') && intakeState !== 'sm_verify' && CANCEL_WORDS.some(w => body === w)) {
    await clearState(supabase, threadId)
    return { text: `Cancelled. Use the menu buttons below.` }
  }

  const { siteIds, isAdmin } = await getUserSites(supabase, user.id)

  // ── ARRIVE: search input ───────────────────────────────────────────────────
  if (intakeState === 'sm_arrive_search') {
    const ops = await searchOperatives(supabase, messageText, siteIds, isAdmin)
    if (ops.length === 0) return { text: `No matches found. Try a different name or ref number.` }
    return {
      text: `Select operative:`,
      keyboard: buildOperativeKeyboard(ops, 'arrive_sel'),
    }
  }

  // ── ARRIVE: custom date input ──────────────────────────────────────────────
  if (intakeState === 'sm_arrive_custom_date') {
    const opId = intakeData.sm_op_id as string
    const opName = intakeData.sm_op_name as string
    const parsed = parseDDMM(messageText)
    if (!parsed) return { text: `Couldn't parse that date. Try DD/MM (e.g. 03/03) or DD/MM/YYYY.` }
    await markArrived(supabase, opId, siteIds, isAdmin, parsed)
    await createNotification(supabase, {
      type: 'arrive',
      title: `Arrived: ${opName}`,
      body: `Marked on site ${formatDateGB(parsed)} by ${user.first_name} ${user.last_name}`,
      severity: 'info',
      operative_id: opId,
      link_url: `/operatives/${opId}`,
      push: false,
    })
    await clearState(supabase, threadId)
    return { text: `✅ ${opName} marked as arrived on site.\nDate: ${formatDateGB(parsed)}` }
  }

  // ── NCR: description input → ask when it happened ────────────────────────
  if (intakeState === 'sm_ncr_description') {
    const todayGB = formatDateGB(todayISO())
    await setState(supabase, threadId, 'sm_idle', { sm_ncr_description: messageText })
    return {
      text: `Got it. When did this happen?`,
      keyboard: {
        inline_keyboard: [
          [{ text: `✅ Right now (${todayGB})`, callback_data: 'ncr_now' }],
          [{ text: `🕐 Earlier today (enter time)`, callback_data: 'ncr_today_time' }],
          [{ text: `📅 Different date`, callback_data: 'ncr_diff_date' }],
          [{ text: '❌ Cancel', callback_data: 'cancel' }],
        ],
      },
    }
  }

  // ── NCR: time input (for "earlier today") ────────────────────────────────
  if (intakeState === 'sm_ncr_time') {
    const time = parseHHMM(messageText)
    if (!time) return { text: `Couldn't parse that time. Try HH:MM (e.g. 08:30 or 14:00).` }
    await setState(supabase, threadId, 'sm_idle', { ...intakeData, sm_ncr_date: todayISO(), sm_ncr_time: time })
    return {
      text: `Time noted: ${time}. What type of incident?`,
      keyboard: NCR_TYPE_KEYBOARD,
    }
  }

  // ── NCR: custom date input ───────────────────────────────────────────────
  if (intakeState === 'sm_ncr_custom_date') {
    // Accept: "03/03", "03/03/2026", "03/03 at 14:30", "03/03/2026 14:30"
    const { date, time } = parseDateTimeInput(messageText)
    if (!date) return { text: `Couldn't parse that. Try DD/MM (e.g. 03/03) or DD/MM HH:MM (e.g. 03/03 14:30).` }
    await setState(supabase, threadId, 'sm_idle', { ...intakeData, sm_ncr_date: date, sm_ncr_time: time ?? null })
    return {
      text: `Date noted: ${formatDateGB(date)}${time ? ` at ${time}` : ''}. What type of incident?`,
      keyboard: NCR_TYPE_KEYBOARD,
    }
  }

  // ── NCR: search input ──────────────────────────────────────────────────────
  if (intakeState === 'sm_ncr_search') {
    const ops = await searchOperatives(supabase, messageText, siteIds, isAdmin)
    if (ops.length === 0) return { text: `No matches found. Try a different name or ref number.` }
    return {
      text: `Select operative:`,
      keyboard: buildOperativeKeyboard(ops, 'ncr_op'),
    }
  }

  // ── RAP: search input ──────────────────────────────────────────────────────
  if (intakeState === 'sm_rap_search') {
    const ops = await searchOperatives(supabase, messageText, siteIds, isAdmin)
    if (ops.length === 0) return { text: `No matches found. Try a different name or ref number.` }
    return {
      text: `Select operative:`,
      keyboard: buildOperativeKeyboard(ops, 'rap_sel'),
    }
  }

  // ── RAP: score inputs (text fallback) ─────────────────────────────────────
  if (intakeState === 'sm_rap_attitude') {
    const score = parseScore(messageText)
    if (!score) return { text: `Please enter a number between 1 and 5.` }
    await setState(supabase, threadId, 'sm_rap_reliability', { ...intakeData, sm_attitude: score })
    return {
      text: `Got it (A: ${score}). *Reliability* (1–5):`,
      keyboard: buildScoreKeyboard('rap_r', intakeData.sm_op_id as string, score),
    }
  }

  if (intakeState === 'sm_rap_reliability') {
    const score = parseScore(messageText)
    if (!score) return { text: `Please enter a number between 1 and 5.` }
    await setState(supabase, threadId, 'sm_rap_performance', { ...intakeData, sm_reliability: score })
    return {
      text: `Got it (R: ${score}). *Performance* (1–5):`,
      keyboard: buildScoreKeyboard('rap_p', intakeData.sm_op_id as string, score, intakeData.sm_attitude as number),
    }
  }

  if (intakeState === 'sm_rap_performance') {
    const score = parseScore(messageText)
    if (!score) return { text: `Please enter a number between 1 and 5.` }
    await setState(supabase, threadId, 'sm_rap_safety', { ...intakeData, sm_performance: score })
    return { text: `Got it (P: ${score}). *Safety / H&S* (1–5):\n1 = Serious concerns  3 = Compliant  5 = Exemplary` }
  }

  if (intakeState === 'sm_rap_safety') {
    const score = parseScore(messageText)
    if (!score) return { text: `Please enter a number between 1 and 5.` }
    return submitRap(supabase, threadId, intakeData, score, user, chatId)
  }

  // ── LABOUR REQUEST: headcount text input ──────────────────────────────────
  if (intakeState === 'sm_labour_headcount') {
    const count = parseInt(messageText.trim(), 10)
    if (isNaN(count) || count < 1 || count > 50) return { text: `Please enter a number between 1 and 50.` }
    await setState(supabase, threadId, 'sm_labour_start', { ...intakeData, sm_lr_headcount: count })
    return {
      text: `Need ${count} × *${intakeData.sm_lr_trade_name as string}*.\n\nWhen do you need them? (DD/MM or DD/MM/YYYY)`,
      keyboard: {
        inline_keyboard: [
          [{ text: '✅ Tomorrow', callback_data: 'labour_tomorrow' }],
          [{ text: '✅ Next Monday', callback_data: 'labour_next_monday' }],
          [{ text: '❌ Cancel', callback_data: 'cancel' }],
        ],
      },
    }
  }

  // ── LABOUR REQUEST: start date text input ─────────────────────────────────
  if (intakeState === 'sm_labour_start') {
    const parsed = parseDDMM(messageText)
    if (!parsed) return { text: `Couldn't parse that date. Try DD/MM (e.g. 10/03) or DD/MM/YYYY.` }
    return submitLabourRequest(supabase, threadId, intakeData, parsed, user)
  }

  // ── FINISH: search input ──────────────────────────────────────────────────
  if (intakeState === 'sm_finish_search') {
    const ops = await searchActiveOperatives(supabase, messageText, siteIds, isAdmin)
    if (ops.length === 0) return { text: `No matches found. Try a different name or ref number.` }
    return {
      text: `Select operative:`,
      keyboard: buildOperativeKeyboard(ops, 'finish_sel'),
    }
  }

  // ── FINISH: custom date input ─────────────────────────────────────────────
  if (intakeState === 'sm_finish_custom_date') {
    const opId = intakeData.sm_op_id as string
    const opName = intakeData.sm_op_name as string
    const parsed = parseDDMM(messageText)
    if (!parsed) return { text: `Couldn't parse that date. Try DD/MM (e.g. 03/03) or DD/MM/YYYY.` }
    return finishOperative(supabase, threadId, opId, opName, siteIds, isAdmin, parsed, user)
  }

  // ── Idle / menu ────────────────────────────────────────────────────────────
  if (!intakeState || intakeState === 'sm_idle') {
    if (body === '📍 mark arrived' || body === 'arrived' || body.includes('on site')) {
      return startArriveFlow(supabase, threadId, siteIds, isAdmin)
    }

    if (body === '⚠️ log ncr' || body.includes('ncr') || body.includes('incident')) {
      await setState(supabase, threadId, 'sm_ncr_description', {})
      return { text: `Describe the incident:\n\n_(Reply *cancel* to abort)_` }
    }

    if (body === '⭐ rate operative' || body.includes('rap') || body.includes('rate') || body.includes('review')) {
      return startRapFlow(supabase, threadId, siteIds, isAdmin)
    }

    if (body === '🏗️ request labour' || body.includes('request labour') || body.includes('more labour') || body.includes('labour request')) {
      return startLabourRequestFlow(supabase, threadId, siteIds, isAdmin)
    }

    if (body === '🔚 finish operative' || body.includes('finish operative') || body.includes('finishing')) {
      return startFinishFlow(supabase, threadId, siteIds, isAdmin)
    }

    if (body === '❓ help' || body === 'help' || body === 'menu') {
      return {
        text: `Hi ${user.first_name}! 👷\n\nUse the menu buttons:\n📍 *Mark Arrived* — log worker on site\n⚠️ *Log NCR* — report an incident\n⭐ *Rate Operative* — submit A/R/P scores\n🏗️ *Request Labour* — ask for more operatives\n🔚 *Finish Operative* — mark last day on site`,
      }
    }

    return { text: `Hi ${user.first_name}! Use the menu buttons below.` }
  }

  await clearState(supabase, threadId)
  return { text: `Use the menu buttons below.` }
}

// ── Flow starters ─────────────────────────────────────────────────────────────

async function startArriveFlow(
  supabase: SupabaseClient,
  threadId: string,
  siteIds: string[],
  isAdmin: boolean,
): Promise<BotReply> {
  const ops = await getOperativesForSite(supabase, siteIds, isAdmin)
  if (ops.length === 0) return { text: `No operatives found on your active allocations.` }

  if (ops.length > SEARCH_THRESHOLD) {
    await setState(supabase, threadId, 'sm_arrive_search', {})
    return { text: `Who arrived on site?\n\nType their name or reference number (e.g. "Smith" or "CL-0010"):` }
  }

  await setState(supabase, threadId, 'sm_idle', {})
  return {
    text: `Who arrived on site?`,
    keyboard: buildOperativeKeyboard(ops, 'arrive_sel'),
  }
}

async function startRapFlow(
  supabase: SupabaseClient,
  threadId: string,
  siteIds: string[],
  isAdmin: boolean,
): Promise<BotReply> {
  const ops = await getOperativesForSite(supabase, siteIds, isAdmin)
  if (ops.length === 0) return { text: `No operatives found on your active allocations.` }

  if (ops.length > SEARCH_THRESHOLD) {
    await setState(supabase, threadId, 'sm_rap_search', {})
    return { text: `Who would you like to rate?\n\nType their name or reference number:` }
  }

  return {
    text: `Who would you like to rate?`,
    keyboard: buildOperativeKeyboard(ops, 'rap_sel'),
  }
}

async function startLabourRequestFlow(
  supabase: SupabaseClient,
  threadId: string,
  siteIds: string[],
  isAdmin: boolean,
): Promise<BotReply> {
  // For site managers: use their assigned site; for admins: they'd need to pick (use first for now)
  const siteId = siteIds[0] ?? null
  if (!siteId && !isAdmin) return { text: `You have no sites assigned. Contact your admin.` }

  const { data: trades } = await supabase
    .from('trade_categories')
    .select('id, name, typical_day_rate')
    .eq('organization_id', ORG_ID)
    .eq('is_active', true)
    .order('name')

  if (!trades || trades.length === 0) return { text: `No trade categories found. Contact your admin.` }

  await setState(supabase, threadId, 'sm_idle', { sm_lr_site_id: siteId })

  const buttons = trades.map(t => [{ text: t.name, callback_data: `labour_trade:${t.id}` }])
  buttons.push([{ text: '❌ Cancel', callback_data: 'cancel' }])

  return {
    text: `🏗️ *Request Labour*\n\nWhat trade do you need?`,
    keyboard: { inline_keyboard: buttons },
  }
}

async function startFinishFlow(
  supabase: SupabaseClient,
  threadId: string,
  siteIds: string[],
  isAdmin: boolean,
): Promise<BotReply> {
  const ops = await getActiveOperativesForSite(supabase, siteIds, isAdmin)
  if (ops.length === 0) return { text: `No active operatives found on your site.` }

  if (ops.length > SEARCH_THRESHOLD) {
    await setState(supabase, threadId, 'sm_finish_search', {})
    return { text: `🔚 *Finish Operative*\n\nWho is finishing?\n\nType their name or reference number:` }
  }

  await setState(supabase, threadId, 'sm_idle', {})
  return {
    text: `🔚 *Finish Operative*\n\nWho is finishing?`,
    keyboard: buildOperativeKeyboard(ops, 'finish_sel'),
  }
}

// ── Callback action handler ───────────────────────────────────────────────────

async function handleCallbackAction(
  supabase: SupabaseClient,
  user: StaffUser,
  threadId: string,
  intakeData: Record<string, unknown>,
  callbackData: string,
  chatId: number,
): Promise<BotReply> {
  const { siteIds, isAdmin } = await getUserSites(supabase, user.id)
  const parts = callbackData.split(':')
  const action = parts[0]

  // ── CANCEL ─────────────────────────────────────────────────────────────────
  if (action === 'cancel') {
    await clearState(supabase, threadId)
    return { text: `Cancelled. Use the menu buttons below.` }
  }

  // ── ARRIVE: operative selected → show date confirmation ───────────────────
  if (action === 'arrive_sel') {
    const opId = parts[1]
    const op = await getOperativeById(supabase, opId)
    if (!op) return { text: `Operative not found.` }

    const opName = `${op.first_name} ${op.last_name}`
    const todayGB = formatDateGB(todayISO())

    await setState(supabase, threadId, 'sm_arrive_confirm', {
      sm_op_id: opId,
      sm_op_name: opName,
    })

    return {
      text: `Confirming arrival for *${opName}*.\n\nDate of arrival?`,
      keyboard: {
        inline_keyboard: [
          [{ text: `✅ Today (${todayGB})`, callback_data: `arrive_now:${opId}` }],
          [{ text: `📅 Different date`, callback_data: `arrive_date:${opId}` }],
          [{ text: `❌ Cancel`, callback_data: 'cancel' }],
        ],
      },
    }
  }

  // ── ARRIVE: confirm today ──────────────────────────────────────────────────
  if (action === 'arrive_now') {
    const opId = parts[1]
    const op = await getOperativeById(supabase, opId)
    if (!op) return { text: `Operative not found.` }

    const opName = `${op.first_name} ${op.last_name}`
    await markArrived(supabase, opId, siteIds, isAdmin, todayISO())
    await createNotification(supabase, {
      type: 'arrive',
      title: `Arrived: ${opName}`,
      body: `Marked on site ${formatDateGB(todayISO())} by ${user.first_name} ${user.last_name}`,
      severity: 'info',
      operative_id: opId,
      link_url: `/operatives/${opId}`,
      push: false,
    })
    await clearState(supabase, threadId)
    return { text: `✅ *${opName}* marked as arrived on site.\nDate: ${formatDateGB(todayISO())}` }
  }

  // ── ARRIVE: request custom date ────────────────────────────────────────────
  if (action === 'arrive_date') {
    const opId = parts[1]
    const op = await getOperativeById(supabase, opId)
    if (!op) return { text: `Operative not found.` }

    await setState(supabase, threadId, 'sm_arrive_custom_date', {
      sm_op_id: opId,
      sm_op_name: `${op.first_name} ${op.last_name}`,
    })

    return { text: `Type the arrival date (DD/MM or DD/MM/YYYY):` }
  }

  // ── NCR DATE: right now ────────────────────────────────────────────────────
  if (action === 'ncr_now') {
    const now = new Date()
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    await setState(supabase, threadId, 'sm_idle', { ...intakeData, sm_ncr_date: todayISO(), sm_ncr_time: time })
    return {
      text: `Noted (${formatDateGB(todayISO())} at ${time}). What type of incident?`,
      keyboard: NCR_TYPE_KEYBOARD,
    }
  }

  // ── NCR DATE: earlier today → ask for time ─────────────────────────────
  if (action === 'ncr_today_time') {
    await setState(supabase, threadId, 'sm_ncr_time', { ...intakeData, sm_ncr_date: todayISO() })
    return { text: `What time did it happen? (e.g. 08:30 or 14:00)` }
  }

  // ── NCR DATE: different date → ask for date ────────────────────────────
  if (action === 'ncr_diff_date') {
    await setState(supabase, threadId, 'sm_ncr_custom_date', intakeData)
    return { text: `Enter the date (DD/MM or DD/MM/YYYY), optionally with time (e.g. 03/03 14:30):` }
  }

  // ── NCR TYPE SELECTED ─────────────────────────────────────────────────────
  if (action === 'ncr_type') {
    const type = parts[1]
    await setState(supabase, threadId, 'sm_idle', { ...intakeData, sm_ncr_type: type })
    return {
      text: `Type: *${NCR_TYPE_LABELS[type] ?? type}*. Severity?`,
      keyboard: NCR_SEVERITY_KEYBOARD,
    }
  }

  // ── NCR SEVERITY SELECTED ─────────────────────────────────────────────────
  if (action === 'ncr_sev') {
    const severity = parts[1]
    const updatedData = { ...intakeData, sm_ncr_severity: severity }
    await setState(supabase, threadId, 'sm_idle', updatedData)
    const ops = await getOperativesForSite(supabase, siteIds, isAdmin)
    if (ops.length === 0) {
      await clearState(supabase, threadId)
      return { text: `No operatives found on your active allocations.` }
    }
    if (ops.length > SEARCH_THRESHOLD) {
      await setState(supabase, threadId, 'sm_ncr_search', updatedData)
      return { text: `Severity: *${severity}*. Type the operative's name or ref:` }
    }
    return {
      text: `Severity: *${severity}*. Who is involved?`,
      keyboard: buildOperativeKeyboard(ops, 'ncr_op'),
    }
  }

  // ── NCR OPERATIVE SELECTED ─────────────────────────────────────────────────
  if (action === 'ncr_op') {
    const opId = parts[1]
    const description = (intakeData.sm_ncr_description as string) ?? ''
    const op = await getOperativeById(supabase, opId)
    if (!op) return { text: `Operative not found.` }

    const { data: alloc } = await supabase
      .from('allocations')
      .select('id, site_id')
      .eq('operative_id', opId)
      .eq('organization_id', ORG_ID)
      .in('status', ['confirmed', 'active'])
      .limit(1)
      .maybeSingle()

    const incidentType = (intakeData.sm_ncr_type as string) ?? 'other'
    const severity = (intakeData.sm_ncr_severity as string) ?? 'minor'
    const incidentDate = (intakeData.sm_ncr_date as string) ?? todayISO()
    const incidentTime = (intakeData.sm_ncr_time as string) ?? null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: insertedNcr } = await (supabase.from('non_conformance_incidents') as any).insert({
      organization_id: ORG_ID,
      operative_id: opId,
      allocation_id: alloc?.id ?? null,
      site_id: alloc?.site_id ?? siteIds[0] ?? null,
      incident_date: incidentDate,
      incident_time: incidentTime,
      description,
      incident_type: incidentType,
      severity,
      reported_via: 'telegram',
      reporter_name: `${user.first_name} ${user.last_name}`,
      reported_by: user.id,
    }).select('id').single()

    const ncrSeverity = severity === 'critical' ? 'critical' : severity === 'major' ? 'warning' : 'info'
    await createNotification(supabase, {
      type: 'ncr',
      title: `NCR: ${op.first_name} ${op.last_name} — ${NCR_TYPE_LABELS[incidentType] ?? incidentType} (${severity})`,
      body: description.length > 150 ? description.slice(0, 150) + '…' : description,
      severity: ncrSeverity as 'info' | 'warning' | 'critical',
      operative_id: opId,
      ncr_id: (insertedNcr as { id: string } | null)?.id ?? null,
      link_url: (insertedNcr as { id: string } | null)?.id ? `/ncrs/${(insertedNcr as { id: string }).id}` : `/operatives/${opId}`,
      push: true,
    })

    await clearState(supabase, threadId)
    const dateStr = `${formatDateGB(incidentDate)}${incidentTime ? ` at ${incidentTime}` : ''}`
    return {
      text: `✅ NCR logged for *${op.first_name} ${op.last_name}*.\n\nType: ${NCR_TYPE_LABELS[incidentType] ?? incidentType} · Severity: ${severity}\nDate: ${dateStr}\n_"${description}"_\n\nReview in the dashboard.`,
    }
  }

  // ── RAP OPERATIVE SELECTED ─────────────────────────────────────────────────
  if (action === 'rap_sel') {
    const opId = parts[1]
    const op = await getOperativeById(supabase, opId)
    if (!op) return { text: `Operative not found.` }

    await setState(supabase, threadId, 'sm_rap_attitude', {
      sm_op_id: opId,
      sm_op_name: `${op.first_name} ${op.last_name}`,
      sm_tg_chat: chatId,
    })

    return {
      text: `Rating *${op.first_name} ${op.last_name}*.\n\n*Attitude* (1–5):\n1 = Poor · 3 = OK · 5 = Excellent`,
      keyboard: buildScoreKeyboard('rap_a', opId),
    }
  }

  // ── RAP ATTITUDE ──────────────────────────────────────────────────────────
  if (action === 'rap_a') {
    const opId = parts[1]
    const score = parseInt(parts[2], 10)
    await setState(supabase, threadId, 'sm_rap_reliability', { ...intakeData, sm_op_id: opId, sm_attitude: score })
    return {
      text: `Got it (A: ${score}). *Reliability* (1–5):\n1 = Often absent · 3 = Reliable · 5 = Always there`,
      keyboard: buildScoreKeyboard('rap_r', opId, score),
    }
  }

  // ── RAP RELIABILITY ───────────────────────────────────────────────────────
  if (action === 'rap_r') {
    const opId = parts[1]
    const attitude = parseInt(parts[2], 10)
    const score = parseInt(parts[3], 10)
    await setState(supabase, threadId, 'sm_rap_performance', { ...intakeData, sm_op_id: opId, sm_attitude: attitude, sm_reliability: score })
    return {
      text: `Got it (R: ${score}). *Performance* (1–5):\n1 = Poor quality · 3 = Meets standard · 5 = Exceptional`,
      keyboard: buildScoreKeyboard('rap_p', opId, attitude, score),
    }
  }

  // ── RAP PERFORMANCE → ask Safety ─────────────────────────────────────────
  if (action === 'rap_p') {
    const opId = parts[1]
    const attitude = parseInt(parts[2], 10)
    const reliability = parseInt(parts[3], 10)
    const score = parseInt(parts[4], 10)
    await setState(supabase, threadId, 'sm_rap_safety', {
      ...intakeData,
      sm_op_id: opId,
      sm_attitude: attitude,
      sm_reliability: reliability,
      sm_performance: score,
    })
    return {
      text: `Got it (P: ${score}). *Safety / H&S* (1–5):\n1 = Serious concerns · 3 = Compliant · 5 = Exemplary`,
    }
  }

  // ── LABOUR: trade selected ────────────────────────────────────────────────
  if (action === 'labour_trade') {
    const tradeId = parts[1]
    const { data: trade } = await supabase
      .from('trade_categories')
      .select('name, typical_day_rate')
      .eq('id', tradeId)
      .maybeSingle()

    await setState(supabase, threadId, 'sm_labour_headcount', {
      ...intakeData,
      sm_lr_trade_id: tradeId,
      sm_lr_trade_name: trade?.name ?? 'Unknown',
      sm_lr_day_rate: trade?.typical_day_rate ?? null,
    })

    return {
      text: `Trade: *${trade?.name ?? 'Unknown'}*\n\nHow many operatives do you need?`,
      keyboard: {
        inline_keyboard: [
          [
            { text: '1', callback_data: 'labour_hc:1' },
            { text: '2', callback_data: 'labour_hc:2' },
            { text: '3', callback_data: 'labour_hc:3' },
            { text: '4', callback_data: 'labour_hc:4' },
            { text: '5', callback_data: 'labour_hc:5' },
          ],
          [{ text: '❌ Cancel', callback_data: 'cancel' }],
        ],
      },
    }
  }

  // ── LABOUR: headcount selected ────────────────────────────────────────────
  if (action === 'labour_hc') {
    const count = parseInt(parts[1], 10)
    await setState(supabase, threadId, 'sm_labour_start', { ...intakeData, sm_lr_headcount: count })
    return {
      text: `Need ${count} × *${intakeData.sm_lr_trade_name as string}*.\n\nWhen do you need them?`,
      keyboard: {
        inline_keyboard: [
          [{ text: '✅ Tomorrow', callback_data: 'labour_tomorrow' }],
          [{ text: '✅ Next Monday', callback_data: 'labour_next_monday' }],
          [{ text: '❌ Cancel', callback_data: 'cancel' }],
        ],
      },
    }
  }

  // ── LABOUR: quick date shortcuts ──────────────────────────────────────────
  if (action === 'labour_tomorrow') {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return submitLabourRequest(supabase, threadId, intakeData, d.toISOString().split('T')[0], user)
  }

  if (action === 'labour_next_monday') {
    const d = new Date()
    const daysUntilMonday = d.getDay() === 0 ? 1 : (8 - d.getDay())
    d.setDate(d.getDate() + daysUntilMonday)
    return submitLabourRequest(supabase, threadId, intakeData, d.toISOString().split('T')[0], user)
  }

  // ── FINISH: operative selected ────────────────────────────────────────────
  if (action === 'finish_sel') {
    const opId = parts[1]
    const op = await getOperativeById(supabase, opId)
    if (!op) return { text: `Operative not found.` }

    const opName = `${op.first_name} ${op.last_name}`
    const todayGB = formatDateGB(todayISO())

    await setState(supabase, threadId, 'sm_finish_confirm', {
      sm_op_id: opId,
      sm_op_name: opName,
    })

    return {
      text: `Finishing *${opName}*.\n\nWhat is their last day on site?`,
      keyboard: {
        inline_keyboard: [
          [{ text: `✅ Today (${todayGB})`, callback_data: `finish_now:${opId}` }],
          [{ text: `📅 Different date`, callback_data: `finish_date:${opId}` }],
          [{ text: `❌ Cancel`, callback_data: 'cancel' }],
        ],
      },
    }
  }

  // ── FINISH: confirm today ─────────────────────────────────────────────────
  if (action === 'finish_now') {
    const opId = parts[1]
    const op = await getOperativeById(supabase, opId)
    if (!op) return { text: `Operative not found.` }
    return finishOperative(supabase, threadId, opId, `${op.first_name} ${op.last_name}`, siteIds, isAdmin, todayISO(), user)
  }

  // ── FINISH: enter custom date ─────────────────────────────────────────────
  if (action === 'finish_date') {
    const opId = parts[1]
    const op = await getOperativeById(supabase, opId)
    if (!op) return { text: `Operative not found.` }
    await setState(supabase, threadId, 'sm_finish_custom_date', {
      sm_op_id: opId,
      sm_op_name: `${op.first_name} ${op.last_name}`,
    })
    return { text: `Type the finish date (DD/MM or DD/MM/YYYY):` }
  }

  return { text: `Unknown action. Use the menu buttons below.` }
}

// ── Submit RAP ────────────────────────────────────────────────────────────────

async function submitRap(
  supabase: SupabaseClient,
  threadId: string,
  intakeData: Record<string, unknown>,
  safetyScore: number,
  user: StaffUser,
  chatId: number,
): Promise<BotReply> {
  const opId = intakeData.sm_op_id as string
  const opName = intakeData.sm_op_name as string
  const attitude = intakeData.sm_attitude as number
  const reliability = intakeData.sm_reliability as number
  const performance = intakeData.sm_performance as number
  const avg = Math.round(((reliability + attitude + performance + safetyScore) / 4) * 10) / 10

  const { data: alloc } = await supabase
    .from('allocations')
    .select('id')
    .eq('operative_id', opId)
    .eq('organization_id', ORG_ID)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Let DB triggers calculate rap_average, traffic_light, and update operative aggregate
  const { error: insertErr } = await supabase.from('performance_reviews').insert({
    organization_id: ORG_ID,
    operative_id: opId,
    allocation_id: alloc?.id ?? null,
    reliability_score: reliability,
    attitude_score: attitude,
    performance_score: performance,
    safety_score: safetyScore,
    submitted_via: 'telegram',
    site_manager_name: `${user.first_name} ${user.last_name}`,
    site_manager_phone: `tg:${chatId}`,
  })

  if (insertErr) {
    console.error('[telegram-sm] RAP insert error:', insertErr.message)
    await clearState(supabase, threadId)
    return { text: `Sorry, there was a problem saving the rating. Please try again.` }
  }

  await createNotification(supabase, {
    type: 'rap',
    title: `RAP: ${opName} — ${avg}/5`,
    body: `R:${reliability} A:${attitude} P:${performance} S:${safetyScore} · by ${user.first_name} ${user.last_name}`,
    severity: 'info',
    operative_id: opId,
    link_url: `/operatives/${opId}`,
    push: false,
  })

  await clearState(supabase, threadId)
  return {
    text: `✅ RAP submitted for *${opName}*.\n\nR: ${reliability} · A: ${attitude} · P: ${performance} · S: ${safetyScore}\nAverage: ${avg}/5`,
  }
}

// ── Submit Labour Request ──────────────────────────────────────────────────────

async function submitLabourRequest(
  supabase: SupabaseClient,
  threadId: string,
  intakeData: Record<string, unknown>,
  startDate: string,
  user: StaffUser,
): Promise<BotReply> {
  const siteId = intakeData.sm_lr_site_id as string
  const tradeId = intakeData.sm_lr_trade_id as string
  const tradeName = intakeData.sm_lr_trade_name as string
  const headcount = intakeData.sm_lr_headcount as number
  const dayRate = intakeData.sm_lr_day_rate as number | null

  const { data: inserted } = await supabase
    .from('labour_requests')
    .insert({
      organization_id: ORG_ID,
      site_id: siteId,
      trade_category_id: tradeId,
      headcount_required: headcount,
      headcount_filled: 0,
      start_date: startDate,
      day_rate: dayRate,
      status: 'pending',
      requested_by: user.id,
      notes: `Requested via Telegram by ${user.first_name} ${user.last_name}`,
    })
    .select('id')
    .single()

  await createNotification(supabase, {
    type: 'labour_request',
    title: `Labour Request: ${headcount} × ${tradeName}`,
    body: `Start: ${formatDateGB(startDate)} · Requested by ${user.first_name} ${user.last_name}`,
    severity: 'warning',
    labour_request_id: (inserted as { id: string } | null)?.id ?? null,
    link_url: (inserted as { id: string } | null)?.id ? `/requests/${(inserted as { id: string }).id}` : '/requests',
    push: true,
  })

  await clearState(supabase, threadId)
  return {
    text: `✅ Labour request submitted!\n\n${headcount} × *${tradeName}*\nStart: ${formatDateGB(startDate)}${dayRate ? `\nDay rate: £${dayRate}` : ''}\n\nThe office has been notified.`,
  }
}

// ── Finish Operative ───────────────────────────────────────────────────────────

async function finishOperative(
  supabase: SupabaseClient,
  threadId: string,
  opId: string,
  opName: string,
  siteIds: string[],
  isAdmin: boolean,
  date: string,
  user: StaffUser,
): Promise<BotReply> {
  const update = supabase
    .from('allocations')
    .update({ status: 'completed', actual_end_date: date } as never)
    .eq('operative_id', opId)
    .eq('organization_id', ORG_ID)
    .eq('status', 'active')

  if (!isAdmin && siteIds.length > 0) {
    await update.in('site_id', siteIds)
  } else {
    await update
  }

  await createNotification(supabase, {
    type: 'finish',
    title: `Finished: ${opName}`,
    body: `Last day: ${formatDateGB(date)} · Reported by ${user.first_name} ${user.last_name}`,
    severity: 'warning',
    operative_id: opId,
    link_url: `/operatives/${opId}`,
    push: true,
  })

  await clearState(supabase, threadId)
  return {
    text: `✅ *${opName}* marked as finished.\nLast day: ${formatDateGB(date)}`,
  }
}

// ── Arrive helper ─────────────────────────────────────────────────────────────

async function markArrived(
  supabase: SupabaseClient,
  opId: string,
  siteIds: string[],
  isAdmin: boolean,
  date: string,
): Promise<void> {
  const update = supabase
    .from('allocations')
    .update({ status: 'active', actual_start: date })
    .eq('operative_id', opId)
    .eq('organization_id', ORG_ID)
    .in('status', ['confirmed', 'pending'])

  if (!isAdmin && siteIds.length > 0) {
    await update.in('site_id', siteIds)
  } else {
    await update
  }
}

// ── NCR constants ─────────────────────────────────────────────────────────────

const NCR_TYPE_LABELS: Record<string, string> = {
  no_show:          'No Show',
  walk_off:         'Walk Off',
  late_arrival:     'Late Arrival',
  safety_breach:    'Safety Breach',
  drugs_alcohol:    'Drugs / Alcohol',
  conduct_issue:    'Conduct Issue',
  poor_attitude:    'Poor Attitude',
  poor_workmanship: 'Poor Workmanship',
  other:            'Other',
}

const NCR_TYPE_KEYBOARD: InlineKeyboard = {
  inline_keyboard: [
    [{ text: 'No Show', callback_data: 'ncr_type:no_show' }, { text: 'Walk Off', callback_data: 'ncr_type:walk_off' }],
    [{ text: 'Late Arrival', callback_data: 'ncr_type:late_arrival' }, { text: 'Safety Breach', callback_data: 'ncr_type:safety_breach' }],
    [{ text: 'Drugs / Alcohol', callback_data: 'ncr_type:drugs_alcohol' }, { text: 'Conduct Issue', callback_data: 'ncr_type:conduct_issue' }],
    [{ text: 'Poor Attitude', callback_data: 'ncr_type:poor_attitude' }, { text: 'Poor Workmanship', callback_data: 'ncr_type:poor_workmanship' }],
    [{ text: 'Other', callback_data: 'ncr_type:other' }],
    [{ text: '❌ Cancel', callback_data: 'cancel' }],
  ],
}

const NCR_SEVERITY_KEYBOARD: InlineKeyboard = {
  inline_keyboard: [
    [
      { text: '⚪ Minor', callback_data: 'ncr_sev:minor' },
      { text: '🟠 Major', callback_data: 'ncr_sev:major' },
      { text: '🔴 Critical', callback_data: 'ncr_sev:critical' },
    ],
    [{ text: '❌ Cancel', callback_data: 'cancel' }],
  ],
}

// ── Keyboard builders ─────────────────────────────────────────────────────────

function opLabel(op: OperativeRow): string {
  const ref = op.reference_number ? `${op.reference_number} · ` : ''
  const trade = op.trade_category?.name ? ` · ${op.trade_category.name}` : ''
  return `${ref}${op.first_name} ${op.last_name}${trade}`
}

function buildOperativeKeyboard(ops: OperativeRow[], action: string): InlineKeyboard {
  const buttons = ops.map(op => [{ text: opLabel(op), callback_data: `${action}:${op.id}` }])
  buttons.push([{ text: '❌ Cancel', callback_data: 'cancel' }])
  return { inline_keyboard: buttons }
}

function buildScoreKeyboard(
  action: string,
  opId: string,
  prevScore1?: number,
  prevScore2?: number,
): InlineKeyboard {
  const buttons = [
    [1, 2, 3, 4, 5].map(s => {
      const parts = [action, opId]
      if (prevScore1 !== undefined) parts.push(String(prevScore1))
      if (prevScore2 !== undefined) parts.push(String(prevScore2))
      parts.push(String(s))
      return { text: String(s), callback_data: parts.join(':') }
    }),
    [{ text: '❌ Cancel', callback_data: 'cancel' }],
  ]
  return { inline_keyboard: buttons }
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function getUserSites(supabase: SupabaseClient, userId: string) {
  const { data: userSites } = await supabase
    .from('user_sites')
    .select('site_id')
    .eq('user_id', userId)
    .eq('organization_id', ORG_ID)
  const siteIds = (userSites ?? []).map(us => us.site_id as string)
  return { siteIds, isAdmin: siteIds.length === 0 }
}

async function getOperativesForSite(
  supabase: SupabaseClient,
  siteIds: string[],
  isAdmin: boolean,
): Promise<OperativeRow[]> {
  const allocQuery = supabase
    .from('allocations')
    .select('operative_id')
    .eq('organization_id', ORG_ID)
    .in('status', ['pending', 'confirmed', 'active'])

  if (!isAdmin && siteIds.length > 0) {
    allocQuery.in('site_id', siteIds)
  }

  const { data: allocs } = await allocQuery
  if (!allocs || allocs.length === 0) return []

  const ids = [...new Set(allocs.map(a => a.operative_id as string))]
  const { data: ops } = await supabase
    .from('operatives')
    .select('id, first_name, last_name, reference_number, trade_category:trade_categories!operatives_trade_category_id_fkey(name)')
    .eq('organization_id', ORG_ID)
    .in('id', ids)
    .order('last_name')
  return (ops ?? []) as unknown as OperativeRow[]
}

async function getActiveOperativesForSite(
  supabase: SupabaseClient,
  siteIds: string[],
  isAdmin: boolean,
): Promise<OperativeRow[]> {
  const allocQuery = supabase
    .from('allocations')
    .select('operative_id')
    .eq('organization_id', ORG_ID)
    .eq('status', 'active') // Only active — not pending/confirmed

  if (!isAdmin && siteIds.length > 0) {
    allocQuery.in('site_id', siteIds)
  }

  const { data: allocs } = await allocQuery
  if (!allocs || allocs.length === 0) return []

  const ids = [...new Set(allocs.map(a => a.operative_id as string))]
  const { data: ops } = await supabase
    .from('operatives')
    .select('id, first_name, last_name, reference_number, trade_category:trade_categories!operatives_trade_category_id_fkey(name)')
    .eq('organization_id', ORG_ID)
    .in('id', ids)
    .order('last_name')
  return (ops ?? []) as unknown as OperativeRow[]
}

async function searchOperatives(
  supabase: SupabaseClient,
  query: string,
  siteIds: string[],
  isAdmin: boolean,
): Promise<OperativeRow[]> {
  const all = await getOperativesForSite(supabase, siteIds, isAdmin)
  const q = query.trim().toLowerCase()
  return all.filter(op =>
    op.first_name.toLowerCase().includes(q) ||
    op.last_name.toLowerCase().includes(q) ||
    (op.reference_number?.toLowerCase().includes(q) ?? false)
  ).slice(0, 6)
}

async function searchActiveOperatives(
  supabase: SupabaseClient,
  query: string,
  siteIds: string[],
  isAdmin: boolean,
): Promise<OperativeRow[]> {
  const all = await getActiveOperativesForSite(supabase, siteIds, isAdmin)
  const q = query.trim().toLowerCase()
  return all.filter(op =>
    op.first_name.toLowerCase().includes(q) ||
    op.last_name.toLowerCase().includes(q) ||
    (op.reference_number?.toLowerCase().includes(q) ?? false)
  ).slice(0, 6)
}

async function getOperativeById(
  supabase: SupabaseClient,
  opId: string,
): Promise<OperativeRow | null> {
  const { data } = await supabase
    .from('operatives')
    .select('id, first_name, last_name, reference_number, trade_category:trade_categories!operatives_trade_category_id_fkey(name)')
    .eq('id', opId)
    .maybeSingle()
  return data ? data as unknown as OperativeRow : null
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

function formatDateGB(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function parseHHMM(input: string): string | null {
  const clean = input.trim().replace(/[.,]/g, ':')
  const m = clean.match(/^(\d{1,2})[:\.](\d{2})$/)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function parseDateTimeInput(input: string): { date: string | null; time: string | null } {
  // Accepts: "03/03", "03/03/2026", "03/03 14:30", "03/03/2026 14:30", "03/03 at 14:30"
  const clean = input.trim().toLowerCase().replace(' at ', ' ')
  const parts = clean.split(/\s+/)
  const datePart = parts[0]
  const timePart = parts[1] ?? null

  const date = parseDDMM(datePart)
  const time = timePart ? parseHHMM(timePart) : null
  return { date, time }
}

function parseDDMM(input: string): string | null {
  const clean = input.trim().replace(/\s+/g, '')
  // DD/MM/YYYY or DD/MM (assume current year)
  const full = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{4}))?$/)
  if (!full) return null
  const day = full[1].padStart(2, '0')
  const month = full[2].padStart(2, '0')
  const year = full[3] ?? new Date().getFullYear().toString()
  const iso = `${year}-${month}-${day}`
  // Validate
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return iso
}

// ── State helpers ─────────────────────────────────────────────────────────────

async function setState(supabase: SupabaseClient, threadId: string, state: string, data: Record<string, unknown>) {
  await supabase
    .from('message_threads')
    .update({ intake_state: state, intake_data: data })
    .eq('id', threadId)
}

async function clearState(supabase: SupabaseClient, threadId: string) {
  await supabase
    .from('message_threads')
    .update({ intake_state: null, intake_data: null })
    .eq('id', threadId)
}

function parseScore(input: string): number | null {
  const n = parseInt(input.trim(), 10)
  if (isNaN(n) || n < 1 || n > 5) return null
  return n
}
