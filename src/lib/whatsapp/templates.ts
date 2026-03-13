import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

const FROM = process.env.TWILIO_WHATSAPP_NUMBER! // 'whatsapp:+447414157366'

// Default (English) template SIDs
export const WHATSAPP_TEMPLATES = {
  // Approved
  DOC_VERIFIED:         'HX0e9a46d61bd40a6bdd786fbc58a551aa',
  DOC_REJECTED:         'HX66ad4bb368782948155678c0861ae81c',
  WELCOME_VERIFIED:     'HXf24bcc230eb986bafaad05d2abed1b05',
  JOB_OFFER:            'HX27452fce2af3b45f570f943b7a012495',
  DOC_CHASE:            'HX96e82100e8241fc7b10b1163269d6f35',
  DOC_REMINDER:         'HX02ee37ca3485bf75c482042dd9e38fbc',
  DATA_REQUEST:         'HXaded45da36979766c438e85427df969b',
  USER_INVITE:          'HX877e076c4ff88f0938c7eb9efbb91337',
  DOC_EXPIRING:         'HXdd0da06258d6aacda535dc002603f94a',
  // Pending WhatsApp business approval (user-initiated approved)
  PROFILE_COMPLETION:   'HX21c57d7160f8b8ab37202934767f3213',
  RE_ENGAGE:            'HXe2b377f411cb49571f643f607a11da70',
  // Follow-up re-engage — casual tone for chasing non-responders
  RE_ENGAGE_FOLLOW_UP:  'HX5eb9b5022db0b60b46d23928cd5b163a',
  JOB_OFFER_REMINDER:   'HX82f56a16cf85fc92acb53c0adfe312b2',
  STAFF_ALERT:          'HXae65312c1d8d9446fef29043f42d483b',
} as const

/**
 * Language-specific template SIDs.
 * When sending to a non-English operative, look up the template SID here.
 * Falls back to default (English) if language variant doesn't exist.
 *
 * To add a new language variant:
 * 1. Create the template in Twilio (lowercase name, e.g. "re_engage_pl")
 * 2. Get it approved by Meta
 * 3. Add the SID below
 */
const TEMPLATE_LANG_VARIANTS: Partial<Record<keyof typeof WHATSAPP_TEMPLATES, Record<string, string>>> = {
  // RE_ENGAGE: "Hi {{1}}, we have an update from Pangaea. Are you available?"
  RE_ENGAGE: {
    // pl: 'HX...', // TODO: Create re_engage_pl in Twilio
    // ro: 'HX...', // TODO: Create re_engage_ro in Twilio
  },
  // RE_ENGAGE_FOLLOW_UP: "hey {{1}}, are you there? — the company"
  RE_ENGAGE_FOLLOW_UP: {
    // pl: 'HX...', // TODO: Create re_engage_follow_up_pl in Twilio
    // ro: 'HX...', // TODO: Create re_engage_follow_up_ro in Twilio
  },
  // DOC_VERIFIED: Document has been verified notification
  DOC_VERIFIED: {
    // pl: 'HX...', // TODO: Create doc_verified_pl in Twilio
    // ro: 'HX...', // TODO: Create doc_verified_ro in Twilio
  },
  // DOC_REJECTED: Document was rejected, please re-upload
  DOC_REJECTED: {
    // pl: 'HX...', // TODO: Create doc_rejected_pl in Twilio
    // ro: 'HX...', // TODO: Create doc_rejected_ro in Twilio
  },
  // WELCOME_VERIFIED: Welcome, all documents verified
  WELCOME_VERIFIED: {
    // pl: 'HX...', // TODO: Create welcome_verified_pl in Twilio
    // ro: 'HX...', // TODO: Create welcome_verified_ro in Twilio
  },
}

/**
 * Get the correct template SID for an operative's language.
 * Falls back to the default (English) SID if no variant exists.
 */
export function getTemplateSid(
  templateKey: keyof typeof WHATSAPP_TEMPLATES,
  language?: string | null,
): string {
  // Default to English
  if (!language || language === 'en') {
    return WHATSAPP_TEMPLATES[templateKey]
  }

  // Check for language variant
  const variants = TEMPLATE_LANG_VARIANTS[templateKey]
  if (variants && variants[language]) {
    return variants[language]
  }

  // Fall back to English
  return WHATSAPP_TEMPLATES[templateKey]
}

/**
 * Send a WhatsApp HSM template via Twilio Content API.
 * Use this for proactive outbound messages outside the 24-hour session window.
 * `to` should be a raw E.164 number (e.g. '+447700900000').
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateSid: string,
  variables: Record<string, string>
): Promise<string> {
  const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`
  const message = await client.messages.create({
    from: FROM,
    to: toFormatted,
    contentSid: templateSid,
    contentVariables: JSON.stringify(variables),
  })
  return message.sid
}
