/**
 * Smart Onboarding — Gap Analysis
 *
 * Inspects an operative's current data and returns a prioritised list
 * of what's missing, grouped by collection channel (conversational vs form).
 *
 * RTW is always the first gate — if rejected, onboarding stops.
 */

export interface OnboardingGap {
  key: string
  label: string
  dbColumn: string | string[]
  priority: number
  channel: 'conversational' | 'form' | 'document'
  gate?: boolean // if true, rejection = stop onboarding
}

export interface GapAnalysisResult {
  conversational: OnboardingGap[]
  formBased: OnboardingGap[]
  documents: OnboardingGap[]
  complete: string[]
  nextConversationalQuestion: OnboardingGap | null
  totalGaps: number
  isFullyComplete: boolean
}

interface OperativeRecord {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  date_of_birth: string | null
  nationality: string | null
  ni_number: string | null
  bank_sort_code: string | null
  bank_account_number: string | null
  address_line1: string | null
  next_of_kin_name: string | null
  next_of_kin_phone: string | null
  cscs_card_type: string | null
  trade_category_id: string | null
  experience_years: number | null
  rtw_verified: boolean | null
  rtw_type: string | null
  has_verified_rtw: boolean | null
  has_verified_photo_id: boolean | null
  gender: string | null
  utr_number: string | null
  [key: string]: unknown
}

interface DocumentRecord {
  document_type: string
  status: string
}

const CONVERSATIONAL_GAPS: Omit<OnboardingGap, 'priority'>[] = [
  {
    key: 'rtw',
    label: 'Right to work in the UK',
    dbColumn: ['rtw_verified', 'has_verified_rtw', 'rtw_type'],
    channel: 'conversational',
    gate: true,
  },
  {
    key: 'age',
    label: 'Age verification (18+)',
    dbColumn: 'date_of_birth',
    channel: 'conversational',
  },
  {
    key: 'cscs',
    label: 'CSCS card type',
    dbColumn: 'cscs_card_type',
    channel: 'conversational',
  },
  {
    key: 'trade',
    label: 'Main trade / skill',
    dbColumn: 'trade_category_id',
    channel: 'conversational',
  },
  {
    key: 'experience',
    label: 'Years of experience',
    dbColumn: 'experience_years',
    channel: 'conversational',
  },
  {
    key: 'name',
    label: 'Full name confirmation',
    dbColumn: ['first_name', 'last_name'],
    channel: 'conversational',
  },
  {
    key: 'email',
    label: 'Email address',
    dbColumn: 'email',
    channel: 'conversational',
  },
]

const FORM_GAPS: Omit<OnboardingGap, 'priority'>[] = [
  {
    key: 'ni_number',
    label: 'National Insurance number',
    dbColumn: 'ni_number',
    channel: 'form',
  },
  {
    key: 'bank_details',
    label: 'Bank details',
    dbColumn: ['bank_sort_code', 'bank_account_number'],
    channel: 'form',
  },
  {
    key: 'address',
    label: 'Home address',
    dbColumn: 'address_line1',
    channel: 'form',
  },
  {
    key: 'date_of_birth_full',
    label: 'Full date of birth',
    dbColumn: 'date_of_birth',
    channel: 'form',
  },
  {
    key: 'nok',
    label: 'Next of kin',
    dbColumn: ['next_of_kin_name', 'next_of_kin_phone'],
    channel: 'form',
  },
]

const DOCUMENT_GAPS: Omit<OnboardingGap, 'priority'>[] = [
  {
    key: 'photo_id',
    label: 'Photo ID (passport or driving licence)',
    dbColumn: 'has_verified_photo_id',
    channel: 'document',
  },
  {
    key: 'right_to_work',
    label: 'Right to Work document',
    dbColumn: 'has_verified_rtw',
    channel: 'document',
  },
]

function isPresent(op: OperativeRecord, col: string | string[]): boolean {
  const cols = Array.isArray(col) ? col : [col]
  return cols.some((c) => {
    const val = op[c]
    if (val === null || val === undefined || val === '') return false
    if (typeof val === 'boolean') return val
    return true
  })
}

function hasDocument(docs: DocumentRecord[], type: string): boolean {
  return docs.some((d) => d.document_type === type && d.status !== 'rejected')
}

export function analyseGaps(
  operative: OperativeRecord,
  documents: DocumentRecord[]
): GapAnalysisResult {
  const complete: string[] = []
  const conversational: OnboardingGap[] = []
  const formBased: OnboardingGap[] = []
  const docGaps: OnboardingGap[] = []

  // Check conversational gaps
  let priority = 1
  for (const gap of CONVERSATIONAL_GAPS) {
    // Special case: RTW — check multiple indicators
    if (gap.key === 'rtw') {
      const hasRtw =
        operative.rtw_verified ||
        operative.has_verified_rtw ||
        operative.rtw_type != null ||
        hasDocument(documents, 'right_to_work')
      if (hasRtw) {
        complete.push('Right to work')
      } else {
        conversational.push({ ...gap, priority: priority++ })
      }
      continue
    }

    // Special case: age — if we have DOB and they're 18+, skip
    if (gap.key === 'age') {
      if (operative.date_of_birth) {
        const age = Math.floor(
          (Date.now() - new Date(operative.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
        )
        if (age >= 18) {
          complete.push('Age verified')
          continue
        }
      }
      conversational.push({ ...gap, priority: priority++ })
      continue
    }

    // Special case: name — skip if both first and last name are real values
    if (gap.key === 'name') {
      if (
        operative.first_name &&
        operative.last_name &&
        operative.first_name !== 'Unknown' &&
        operative.last_name !== 'Unknown'
      ) {
        complete.push('Full name')
        continue
      }
      conversational.push({ ...gap, priority: priority++ })
      continue
    }

    // Standard check
    if (isPresent(operative, gap.dbColumn)) {
      complete.push(gap.label)
    } else {
      conversational.push({ ...gap, priority: priority++ })
    }
  }

  // Check form-based gaps
  for (const gap of FORM_GAPS) {
    // Skip date_of_birth_full if we already collected DOB via conversation
    if (gap.key === 'date_of_birth_full' && operative.date_of_birth) {
      complete.push('Date of birth')
      continue
    }

    if (isPresent(operative, gap.dbColumn)) {
      complete.push(gap.label)
    } else {
      formBased.push({ ...gap, priority: priority++ })
    }
  }

  // Check document gaps
  for (const gap of DOCUMENT_GAPS) {
    if (hasDocument(documents, gap.key)) {
      complete.push(gap.label)
    } else {
      docGaps.push({ ...gap, priority: priority++ })
    }
  }

  const totalGaps = conversational.length + formBased.length + docGaps.length

  return {
    conversational,
    formBased,
    documents: docGaps,
    complete,
    nextConversationalQuestion: conversational[0] ?? null,
    totalGaps,
    isFullyComplete: totalGaps === 0,
  }
}

/** Map gap keys to the WhatsApp question Amber should ask */
export function getQuestionForGap(gap: OnboardingGap, firstName: string): string {
  const name = firstName || 'there'
  switch (gap.key) {
    case 'rtw':
      return `Hi ${name}, do you have the right to work in the UK? For example, are you a British or Irish citizen, or do you have a visa or share code?`
    case 'age':
      return `Thanks ${name}. Can you confirm you're 18 or over?`
    case 'cscs':
      return `Do you have a CSCS card? If so, what colour is it? (green, blue, gold, black, red, or white)`
    case 'trade':
      return `What's your main trade or skill? For example: bricklayer, groundworker, scaffolder, labourer, etc.`
    case 'experience':
      return `How many years of experience do you have in that trade?`
    case 'name':
      return `Can you confirm your full name for our records?`
    case 'email':
      return `What's your email address? We'll use it to send you any documents or links.`
    default:
      return `We need your ${gap.label}. Can you provide that?`
  }
}
