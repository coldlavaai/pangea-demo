/**
 * Smart Onboarding — Claude Extraction Layer
 *
 * Uses Claude to extract structured data from operative WhatsApp replies
 * during the onboarding conversation. Reuses the circuit breaker pattern
 * from the Amber intake handler.
 */

import Anthropic from '@anthropic-ai/sdk'

// Circuit breaker state (shared across all onboarding extractions)
let circuitFailures = 0
let circuitOpenUntil = 0
const MAX_FAILURES = 3
const COOLDOWN_MS = 60_000

interface ExtractionResult {
  extracted: Record<string, string | number | boolean | null>
  reply: string
  rtwRejected?: boolean
}

interface ExtractionParams {
  currentQuestion: string // e.g. 'rtw', 'age', 'cscs', 'trade', 'experience', 'name', 'email'
  currentQuestionLabel: string
  remainingGaps: string[] // labels of other gaps still needed
  collectedSoFar: Record<string, unknown>
  operativeFirstName: string
  messageBody: string
  orgName: string
}

const SYSTEM_PROMPT = `You are extracting data from a WhatsApp message sent by a construction worker during onboarding for {{ORG_NAME}}.

You are Amber, a friendly and professional onboarding assistant. Be warm, brief, and encouraging. Keep replies under 80 words.

EXTRACTION RULES:
- For RTW (right to work): "British", "Irish", "UK citizen", "EU settled status", "yes" = rtw_confirmed: true. "No", "not allowed", "no visa" = rtw_rejected: true.
- For age: any number >= 18 = age_confirmed: true. If they give their actual age or DOB, extract that too.
- For CSCS: extract the colour if mentioned (green/blue/gold/black/red/white). "No card", "don't have one" = cscs_colour: "none".
- For trade: extract the trade name as closely as possible to standard construction trades.
- For experience: extract a number. "just started" = 0, "couple of years" = 2, "15+" = 15, "about 5" = 5.
- For name: extract first_name and last_name separately.
- For email: extract the email address. Must contain @ and a dot.

IMPORTANT:
- If they answer MULTIPLE questions at once, extract ALL data mentioned.
- If unsure about a value, don't extract it — ask a clarifying follow-up instead.
- Always respond conversationally as Amber — acknowledge what they said, then move to the next thing.

Return ONLY valid JSON (no markdown, no backticks):
{
  "extracted": { "field_name": "value" },
  "reply": "Your conversational reply",
  "rtw_rejected": false
}

Valid field names: rtw_confirmed, age_confirmed, date_of_birth, cscs_colour, trade, experience_years, first_name, last_name, email`

export async function extractOnboardingData(params: ExtractionParams): Promise<ExtractionResult> {
  const now = Date.now()

  // Circuit breaker check
  if (circuitFailures >= MAX_FAILURES && now < circuitOpenUntil) {
    console.log('[smart-onboarding] Circuit breaker OPEN — using fallback')
    return {
      extracted: {},
      reply: `Thanks for that! Let me process your response. I'll follow up shortly.`,
    }
  }

  // Half-open: allow one attempt through
  if (circuitFailures >= MAX_FAILURES && now >= circuitOpenUntil) {
    circuitFailures = 0
    console.log('[smart-onboarding] Circuit breaker half-open — retrying Claude')
  }

  const prompt = SYSTEM_PROMPT.replace('{{ORG_NAME}}', params.orgName)

  const userMessage = `CURRENT QUESTION: ${params.currentQuestionLabel}
OTHER DATA STILL NEEDED: ${params.remainingGaps.join(', ') || 'None'}
DATA COLLECTED SO FAR: ${JSON.stringify(params.collectedSoFar)}
OPERATIVE'S NAME: ${params.operativeFirstName}

OPERATIVE'S MESSAGE:
"${params.messageBody}"`

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const response = await Promise.race([
      client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        system: prompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Claude timeout')), 10_000)
      ),
    ])

    // Reset circuit breaker on success
    circuitFailures = 0

    const text =
      response.content[0].type === 'text' ? response.content[0].text : ''

    // Parse JSON — handle potential markdown wrapping
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleaned) as ExtractionResult

    return {
      extracted: parsed.extracted ?? {},
      reply: parsed.reply ?? "Thanks! Let me note that down.",
      rtwRejected: parsed.rtwRejected ?? parsed.extracted?.rtw_rejected === true,
    }
  } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    circuitFailures++
    circuitOpenUntil = Date.now() + COOLDOWN_MS
    const errMsg = err?.message ?? err?.error?.message ?? String(err)
    console.error('[smart-onboarding] Claude extraction failed:', errMsg)
    console.error('[smart-onboarding] Full error:', JSON.stringify(err, null, 2)?.slice(0, 500))

    return {
      extracted: {},
      reply: `Thanks for that! I'm just processing your response — I'll follow up shortly.`,
    }
  }
}
