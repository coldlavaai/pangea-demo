/**
 * Operative CSV importer — pure TypeScript, no external dependencies.
 *
 * Handles:
 * - Quoted CSV fields (commas inside values, escaped quotes)
 * - Column header mapping (spreadsheet headers → DB field names)
 * - Phone normalisation to E.164 (+44...)
 * - Date normalisation to ISO 8601 (YYYY-MM-DD), including Excel date serials
 * - CSCS card type normalisation
 * - Grade enum normalisation
 * - Trade category fuzzy matching
 * - Duplicate detection (by phone, then NI number)
 * - Per-row validation with errors and warnings
 */

export interface TradeCategory {
  id: string
  name: string
}

export interface TradeMatch {
  raw: string
  matchedId: string | null
  matchedName: string | null
}

export interface CscsCard {
  cardType: string       // normalised colour value
  scheme: string | null  // cscs | cpcs | gqa | npors | eusr | other
}

export interface ParsedRow {
  rowIndex: number
  data: Record<string, string | number | null>
  tradeName: string         // raw primary trade string (kept for display)
  trades: TradeMatch[]      // all trades split from the trade field
  cscsCards: CscsCard[]     // all CSCS cards parsed from the CSCS colour field
  agencyName: string | null // raw agency name for agency lookup/create
  completenessScore: number | null // Pangaea's internal data completeness score
  warnings: string[]
  errors: string[]
  isDuplicate: boolean
}

export interface ParseResult {
  rows: ParsedRow[]
  unmappedHeaders: string[]
  total: number
  valid: number      // no errors, no warnings
  withWarnings: number
  withErrors: number
  duplicates: number
}

// ─── Column header → DB field mapping ───────────────────────────────────────
// null = skip this column
const HEADER_MAP: Record<string, string | null> = {
  'ni': 'ni_number',
  'ni number': 'ni_number',
  'national insurance': 'ni_number',
  'surname': 'last_name',
  'last name': 'last_name',
  'lastname': 'last_name',
  'first name(s)': 'first_name',
  'first name': 'first_name',
  'firstname': 'first_name',
  'forename': 'first_name',
  'contact tel no': 'phone',
  'contact tel': 'phone',
  'phone': 'phone',
  'mobile': 'phone',
  'telephone': 'phone',
  'tel no': 'phone',
  'e-mail': 'email',
  'email': 'email',
  'email address': 'email',
  'last worked': 'last_worked_date',
  'grade': 'grade',
  'rate': 'charge_rate', // col 8 = charge rate (what the company bills the site)
  'daily rate': 'day_rate',
  'day rate': 'day_rate',
  'date of birth': 'date_of_birth',
  'dob': 'date_of_birth',
  'date of birth:': 'date_of_birth',
  'flat no. (if there is one)': 'address_line2',
  'flat no': 'address_line2',
  'flat': 'address_line2',
  'house no. & street name': 'address_line1',
  'house no & street name': 'address_line1',
  'house no. and street name': 'address_line1',
  'address': 'address_line1',
  'address line 1': 'address_line1',
  'address line 2': 'address_line2',
  'borough/locality': 'county',
  'borough': 'county',
  'locality': 'county',
  'town': 'city',
  'city': 'city',
  'postcode': 'postcode',
  'post code': 'postcode',
  'emergency contact name': 'next_of_kin_name',
  'emergency contact phone no.': 'next_of_kin_phone',
  'emergency contact phone': 'next_of_kin_phone',
  'emergency phone': 'next_of_kin_phone',
  'next of kin': 'next_of_kin_name',
  'next of kin phone': 'next_of_kin_phone',
  'bank sort code': 'bank_sort_code',
  'sort code': 'bank_sort_code',
  'bank acc no': 'bank_account_number',
  'bank account no': 'bank_account_number',
  'bank account number': 'bank_account_number',
  'account number': 'bank_account_number',
  'utr tax reference no': 'utr_number',
  'utr': 'utr_number',
  'utr number': 'utr_number',
  'tax reference': 'utr_number',
  'title on cscs card': 'cscs_card_title',
  'colour of cscs card': 'cscs_card_type',
  'cscs colour': 'cscs_card_type',
  'cscs card colour': 'cscs_card_type',
  'cscs color': 'cscs_card_type',
  'cscs card no': 'cscs_card_number',
  'cscs number': 'cscs_card_number',
  'cscs card number': 'cscs_card_number',
  'cscs expiry date': 'cscs_expiry',
  'cscs expiry': 'cscs_expiry',
  'cscs expires': 'cscs_expiry',
  'description on back of cscs card': 'cscs_card_description',
  'cscs description': 'cscs_card_description',
  'type of work to be undertaken': 'trade',
  'type of work': 'trade',
  'trade': 'trade',
  'occupation': 'trade',
  'skill': 'trade',
  'hourly rate:': 'hourly_rate',
  'hourly rate': 'hourly_rate',
  'agency name': 'agency_name',
  'agency': 'agency_name',
  'start date': 'start_date',
  'notes': 'notes',
  'note': 'notes',
  'comments': 'notes',
  // Instruction headers and empty columns — skip
  'to be filled in by site manager daily rate:': 'day_rate',
  '': null,
}

// ─── CSCS card type normalisation ────────────────────────────────────────────
const CSCS_COLOUR_MAP: Record<string, string> = {
  'green': 'green',
  'green card': 'green',
  'labourer': 'green',
  'blue': 'blue',
  'blue card': 'blue',
  'skilled worker': 'blue',
  'skilled': 'blue',
  'gold': 'gold',
  'gold card': 'gold',
  'advanced craft': 'gold',
  'advanced': 'gold',
  'black': 'black',
  'black card': 'black',
  'manager/professional': 'black',
  'red': 'red',
  'red card': 'red',
  'trainee': 'red',
  'white': 'white',
  'white card': 'white',
  'academically qualified': 'white',
}

// ─── Grade normalisation ─────────────────────────────────────────────────────
const GRADE_MAP: Record<string, string | null> = {
  'skilled': 'skilled',
  'skilled worker': 'skilled',
  'highly skilled': 'highly_skilled',
  'highly_skilled': 'highly_skilled',
  'exceptional': 'exceptional_skill',
  'exceptional skill': 'exceptional_skill',
  'exceptional_skill': 'exceptional_skill',
  'specialist': 'specialist_skill',
  'specialist skill': 'specialist_skill',
  'specialist_skill': 'specialist_skill',
  'engineer': 'engineer',
  'site engineer': 'engineer',
  'senior manager': 'senior_manager',
  'senior_manager': 'senior_manager',
  'contracts manager': 'contracts_manager',
  'contracts_manager': 'contracts_manager',
  'project manager': 'project_manager',
  'project_manager': 'project_manager',
  'skilled landscaper': 'skilled_landscaper',
  'skilled_landscaper': 'skilled_landscaper',
  'groundworker': 'groundworker',
  'ground worker': 'groundworker',
  'gw': 'groundworker',
  'site supervisor': 'site_supervisor',
  'site_supervisor': 'site_supervisor',
  'supervisor': 'site_supervisor',
  'plant operator': 'plant_operator',
  'plant_operator': 'plant_operator',
  'operative': 'operative',
  'site manager': 'site_manager',
  'site_manager': 'site_manager',
  'manager': 'site_manager',         // historical term (confirmed by client 2026-03-07)
  'section manager': 'site_manager',
  'mobile crew': 'mobile_crew',
  'mobile_crew': 'mobile_crew',
  'agency labour': 'agency_labour',
  'agency_labour': 'agency_labour',
  'agency labor': 'agency_labour',
  'document controller': 'document_controller',
  'document_controller': 'document_controller',
  'semi skilled': 'semi_skilled',
  'semi-skilled': 'semi_skilled',
  'semi_skilled': 'semi_skilled',
  'semiskilled': 'semi_skilled',
  'semiskiled': 'semi_skilled',
  'semi skilled work': 'semi_skilled',
  'static crew': null,               // historical, no longer used (confirmed by client 2026-03-07)
}

// ─── CSCS scheme keywords ─────────────────────────────────────────────────────
const SCHEME_KEYWORDS = ['cpcs', 'gqa', 'npors', 'eusr', 'cscs']

/**
 * Parse a raw CSCS colour field into one or more card records.
 * Handles: single colours, compound "white/green", scheme suffixes "green gqa",
 * and junk values like "0.00", "pending", "not yet".
 */
function parseCscsField(raw: string): CscsCard[] {
  if (!raw || raw === '0.00') return []

  const lower = raw.toLowerCase().trim()

  // Extract scheme if present
  let scheme: string | null = null
  for (const kw of SCHEME_KEYWORDS) {
    if (lower.includes(kw)) {
      scheme = kw
      break
    }
  }

  // Extract all colour tokens — split on /, -, space, 'and'
  const tokens = lower
    .replace(/\band\b/g, '/')
    .split(/[\/\-\s]+/)
    .map(t => t.trim())
    .filter(t => t.length > 0)

  const cards: CscsCard[] = []
  for (const token of tokens) {
    const colour = CSCS_COLOUR_MAP[token] ?? null
    if (colour && !cards.find(c => c.cardType === colour)) {
      cards.push({ cardType: colour, scheme: cards.length === 0 ? scheme : null })
    }
  }

  // If we found nothing valid but the raw value looks like a real string, return empty
  return cards
}

// ─── Sensitive field labels (for UI display) ─────────────────────────────────
export const SENSITIVE_FIELDS = new Set([
  'ni_number',
  'date_of_birth',
  'bank_sort_code',
  'bank_account_number',
  'utr_number',
])

// ─── CSV parser ──────────────────────────────────────────────────────────────
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  // Normalise line endings
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  for (const line of lines) {
    if (!line.trim()) continue

    const fields: string[] = []
    let inQuote = false
    let current = ''

    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"' && !inQuote) {
        inQuote = true
      } else if (ch === '"' && inQuote) {
        // Escaped quote inside quoted field
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuote = false
        }
      } else if (ch === ',' && !inQuote) {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    fields.push(current.trim())
    rows.push(fields)
  }

  return rows
}

// ─── Phone normalisation ─────────────────────────────────────────────────────
function normalisePhone(raw: string): string | null {
  if (!raw) return null
  // Strip spaces, dashes, dots, parens
  let clean = raw.replace(/[\s\-\.\(\)]/g, '')
  // Remove any leading/trailing non-numeric except +
  clean = clean.replace(/[^\d+]/g, '')

  if (clean.startsWith('07') || clean.startsWith('08')) {
    clean = '+44' + clean.slice(1)
  } else if (clean.startsWith('447')) {
    clean = '+' + clean
  } else if (clean.startsWith('0044')) {
    clean = '+44' + clean.slice(4)
  } else if (!clean.startsWith('+')) {
    // No country code — assume UK
    if (clean.startsWith('7') && clean.length === 10) {
      clean = '+44' + clean
    }
  }

  // Valid UK mobile/landline: +44 followed by 9 or 10 digits
  if (/^\+44\d{9,10}$/.test(clean)) return clean
  // International (non-UK) — accept as-is if looks valid
  if (/^\+\d{7,15}$/.test(clean)) return clean

  return null
}

// ─── Junk value detection ─────────────────────────────────────────────────────
// Values that look like data but mean "empty" in Excel exports
const JUNK_VALUES = new Set([
  '0', '0.0', '0.00', '-', '--', 'n/a', 'na', 'none', 'nil', 'null',
  'pending', 'not yet', 'unknown', 'tbc', 'tba', '#n/a', '#value!', '#ref!',
])

function isJunk(raw: string): boolean {
  return JUNK_VALUES.has(raw.toLowerCase().trim())
}

// ─── Date normalisation ──────────────────────────────────────────────────────
function normaliseDate(raw: string): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (isJunk(trimmed)) return null

  // Already ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    // Reject dates before 1900 (Excel epoch artefacts)
    if (trimmed < '1900-01-01') return null
    return trimmed
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy4 = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/)
  if (dmy4) {
    const iso = `${dmy4[3]}-${dmy4[2].padStart(2, '0')}-${dmy4[1].padStart(2, '0')}`
    if (iso < '1900-01-01') return null
    return iso
  }

  // DD/MM/YY
  const dmy2 = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/)
  if (dmy2) {
    const yr = parseInt(dmy2[3]) > 30 ? `19${dmy2[3]}` : `20${dmy2[3]}`
    return `${yr}-${dmy2[2].padStart(2, '0')}-${dmy2[1].padStart(2, '0')}`
  }

  // Excel date serial (integer; widen range to 1–99999 to catch low serials)
  const serial = Number(trimmed)
  if (!isNaN(serial) && serial > 0 && serial < 99999 && Number.isInteger(serial)) {
    // Excel epoch: 25569 = 1970-01-01 offset from Excel's 1900-01-01 (with leap year bug)
    const ms = (serial - 25569) * 86400 * 1000
    const iso = new Date(ms).toISOString().slice(0, 10)
    // Reject if before 1900 (serial 0 = 1899-12-30, serial 1 = 1900-01-01)
    if (iso < '1900-01-01') return null
    return iso
  }

  return null
}

// ─── Trade aliases ────────────────────────────────────────────────────────────
// Maps colloquial/misspelled CSV values → canonical trade_categories name
const TRADE_ALIASES: Record<string, string> = {
  // Carpenter
  'chippy':                        'Carpenter',
  'chippie':                       'Carpenter',
  'skilled chippy':                'Carpenter',
  'chippy work':                   'Carpenter',
  'carpinter':                     'Carpenter',
  'carpentry':                     'Carpenter',
  'carpentry works':               'Carpenter',
  'carpentry work':                'Carpenter',
  'carpentery':                    'Carpenter',
  'higly skilled carpinter':       'Carpenter',
  'carpenter/ skilled':            'Carpenter',
  'carpenter/paver':               'Carpenter',
  'carpinter/paver':               'Carpenter',
  'experienced chippy and paver':  'Carpenter',
  // Shuttering Carpenter
  'formworking':                   'Shuttering Carpenter',
  'formwork':                      'Shuttering Carpenter',
  'form work':                     'Shuttering Carpenter',
  'shuttering':                    'Shuttering Carpenter',
  'shuttering and general skilled works': 'Shuttering Carpenter',
  'shuttering carpentry':          'Shuttering Carpenter',
  // Groundworker
  'gw':                            'Groundworker',
  'groundworks':                   'Groundworker',
  'groundwork':                    'Groundworker',
  'ground work':                   'Groundworker',
  'ground worker':                 'Groundworker',
  'grownd works':                  'Groundworker',
  'grandworker':                   'Groundworker',
  'grounworker':                   'Groundworker',
  'groung work':                   'Groundworker',
  'groundworking':                 'Groundworker',
  'groung worker':                 'Groundworker',
  'ground works':                  'Groundworker',
  'diggering':                     'Groundworker',
  'groundwork labouring':          'Groundworker',
  'groundworks labourer':          'Groundworker',
  'groundworker labourer':         'Groundworker',
  'groungwork':                    'Groundworker',
  // Paver
  'paving':                        'Paver',
  'paiver':                        'Paver',
  'pavier':                        'Paver',
  'paviour':                       'Paver',
  'skilled paver':                 'Paver',
  'hard landscaping':              'Paver',
  'paving and ground works':       'Paver',
  'paving, groundworks':           'Paver',
  'paving, groundworks, kerb laying': 'Paver',
  'paving, copings and general skilled works': 'Paver',
  'paving and cutting':            'Paver',
  'paver - skilled':               'Paver',
  'paver / skilled':               'Paver',
  'paver/skilled':                 'Paver',
  'skilled - paver':               'Paver',
  // Block Paver
  'block paver':                   'Block Paver',
  'block / slab paver':            'Block Paver',
  'paver/block layer':             'Block Paver',
  'block work , paving , general groundworker': 'Block Paver',
  // 360 Excavator Operator
  '360 driver':                    '360 Excavator Operator',
  '360 operator':                  '360 Excavator Operator',
  '360 operative':                 '360 Excavator Operator',
  '360 digger driver':             '360 Excavator Operator',
  '360/dumper':                    '360 Excavator Operator',
  '360 machine operator/groundworker': '360 Excavator Operator',
  '360 operator / sssts':          '360 Excavator Operator',
  '360 deiver/ dumper':            '360 Excavator Operator',
  'digger driver':                 '360 Excavator Operator',
  'excavator driver':              '360 Excavator Operator',
  'excavator operator':            '360 Excavator Operator',
  'operating excavator':           '360 Excavator Operator',
  'operating machine/excavator':   '360 Excavator Operator',
  'operate digger':                '360 Excavator Operator',
  'digger drive/tipping dumper/roller': '360 Excavator Operator',
  'digger driver/groundwrker':     '360 Excavator Operator',
  // Dumper Driver
  'dumper driver':                 'Dumper Driver',
  'dumper drive':                  'Dumper Driver',
  // Forklift Driver
  'forklift':                      'Forklift Driver',
  'forklift drive':                'Forklift Driver',
  'forklift operator':             'Forklift Driver',
  'forklift driver / telehandler': 'Forklift Driver',
  'forklift and dumper driver':    'Forklift Driver',
  'forcklift driver dumpeer driver': 'Forklift Driver',
  'dumper driving forklift driving': 'Forklift Driver',
  // Telehandler
  'telehandler operator':          'Telehandler',
  'telehandler driver':            'Telehandler',
  'cpcs telehandler operator':     'Telehandler',
  'telehandler and excavator driver': 'Telehandler',
  'telehandler/excavator driver':  'Telehandler',
  'driving telehandler':           'Telehandler',
  // Plant Operator
  'plant driver':                  'Plant Operator',
  'plant':                         'Plant Operator',
  'plant operatives':              'Plant Operator',
  'competent operator':            'Plant Operator',
  // Machine Operator
  'machine driver':                'Machine Operator',
  'machine op':                    'Machine Operator',
  'machine work':                  'Machine Operator',
  // Labourer
  'labour':                        'Labourer',
  'labouring':                     'Labourer',
  'laborer':                       'Labourer',
  'labouer':                       'Labourer',
  'labouter':                      'Labourer',
  'lbourer':                       'Labourer',
  'lobouer':                       'Labourer',
  'lanour':                        'Labourer',
  'labourer level1':               'Labourer',
  'labourer level 1':              'Labourer',
  'labourer level 1 award':        'Labourer',
  // General Labourer
  'general labouring':             'General Labourer',
  'general labvourer':             'General Labourer',
  'general labeler':               'General Labourer',
  'general site labourer':         'General Labourer',
  'landscape labourer':            'General Labourer',
  'skilled labourer':              'General Labourer',
  'skilled worker':                'General Labourer',
  'skilled work':                  'General Labourer',
  'skilled works':                 'General Labourer',
  'skilled':                       'General Labourer',
  'skiled':                        'General Labourer',
  'skilled operative':             'General Labourer',
  'general skill':                 'General Labourer',
  // Landscaper
  'landscaper':                    'Landscaper',
  'landscaping':                   'Landscaper',
  'landscapes':                    'Landscaper',
  'landscaper/paver':              'Landscaper',
  'paver/landscaper':              'Landscaper',
  'groundworks and landscaping':   'Landscaper',
  // Planting Operative
  'planting':                      'Planting Operative',
  'planting and maintenance':      'Planting Operative',
  'mobile garden maintenance':     'Planting Operative',
  // Green Roof Operative
  'green roofing':                 'Green Roof Operative',
  'green roof works':              'Green Roof Operative',
  // Steel Fixer
  'steel fixing':                  'Steel Fixer',
  'steelfixing':                   'Steel Fixer',
  // Stone Mason
  'stone fixer':                   'Stone Mason',
  'stone fixing':                  'Stone Mason',
  'fixer':                         'Stone Mason',
  'ground worker-stone fixer':     'Stone Mason',
  // Traffic Marshal
  'traffic marshall':              'Traffic Marshal',
  'traffic marshell':              'Traffic Marshal',
  'traffice marshal':              'Traffic Marshal',
  'cpcs traffic marshall':         'Traffic Marshal',
  'traffic banksman':              'Traffic Marshal',
  'traffic banskman':              'Traffic Marshal',
  'banksman - traffic marshall':   'Traffic Marshal',
  'traffic marshall , labourer':   'Traffic Marshal',
  'traffic marshall/banksman':     'Traffic Marshal',
  'trafice marshal/ labourer':     'Traffic Marshal',
  'labour and traffic marshal':    'Traffic Marshal',
  'labourer/traffice marshal':     'Traffic Marshal',
  'traffic marshal and labourer':  'Traffic Marshal',
  'traffic marshall/slinger/dumper driver': 'Traffic Marshal',
  'ground worker/traffic marshal': 'Traffic Marshal',
  'traffic marshal/groundworker':  'Traffic Marshal',
  'banksman/trafic marshal':       'Traffic Marshal',
  'labourer / traffic marshall':   'Traffic Marshal',
  'groundworker / cpcs a73 traffic banksman': 'Traffic Marshal',
  'traffic marshall, banksman and labouring': 'Traffic Marshal',
  'traffic marshal npors/groundworker': 'Traffic Marshal',
  // Banksman
  'banksman':                      'Banksman',
  'banksman,laborer':              'Banksman',
  'gateman/banksman':              'Banksman',
  'ground works / banksman':       'Banksman',
  'slinger/banksman':              'Banksman',
  'forklift operator, banksman, groundworks': 'Banksman',
  // Slinger Signaller
  'slinger':                       'Slinger Signaller',
  'slinging':                      'Slinger Signaller',
  'crane slinger':                 'Slinger Signaller',
  'slinger / signaller':           'Slinger Signaller',
  'slinger/signaller':             'Slinger Signaller',
  'slinger/signaller all tipes':   'Slinger Signaller',
  'slinger / signaller all tyoes': 'Slinger Signaller',
  'groundworker / slinger signaller': 'Slinger Signaller',
  'sling hevy materials':          'Slinger Signaller',
  'traffic marshals and slinger':  'Slinger Signaller',
  'lifting of work materials':     'Slinger Signaller',
  // Cladder
  'cladding':                      'Cladder',
  'cladder/paver':                 'Cladder',
  'paver/cladder':                 'Cladder',
  'paving & cladding':             'Cladder',
  'paving and cladding - highly skilled': 'Cladder',
  'cladding and paving supervisor': 'Cladder',
  // Bricklayer
  'bricklaying':                   'Bricklayer',
  'brick layer':                   'Bricklayer',
  'brickwork':                     'Bricklayer',
  'paver/bricklayer':              'Bricklayer',
  'bricklayer/paver':              'Bricklayer',
  'brick layer, paver':            'Bricklayer',
  // Site Manager
  'site management':               'Site Manager',
  'manager - supervisor':          'Site Manager',
  'supervisor /site manager (smsts)': 'Site Manager',
  'manager':                       'Site Manager',
  'construction management':       'Site Manager',
  // Site Engineer
  'setting out engineer':          'Site Engineer',
  'civil engineer':                'Site Engineer',
  'site engineering':              'Site Engineer',
  // Supervisor
  'supervizor':                    'Supervisor',
  'suervisor':                     'Supervisor',
  'site superviser':               'Supervisor',
  'working supervisor':            'Supervisor',
  'sssts supervisour':             'Supervisor',
  'street work supervisor':        'Supervisor',
  'supervising/groundworks':       'Supervisor',
  // Project Manager
  'contract manager':              'Project Manager',
  'contracts manager':             'Project Manager',
  'project / contract managament': 'Project Manager',
  'engineering/project management': 'Project Manager',
  'project management':            'Project Manager',
  'site engineer / project manager': 'Project Manager',
  // Semi-Skilled Labour
  'semi skilled':                  'Semi-Skilled Labour',
  'semiskilled':                   'Semi-Skilled Labour',
  'semi-skilled':                  'Semi-Skilled Labour',
  'semi skill':                    'Semi-Skilled Labour',
  'semi skild':                    'Semi-Skilled Labour',
  'semiskiled':                    'Semi-Skilled Labour',
  'semi skilled work':             'Semi-Skilled Labour',
  'semi skill worker':             'Semi-Skilled Labour',
  'ground worker/semi skilled':    'Semi-Skilled Labour',
  'groundworker/semiskilled':      'Semi-Skilled Labour',
  'laborer/semiskilled':           'Semi-Skilled Labour',
  // Roller Operator
  'roller':                        'Roller Operator',
  // Decking
  'decking':                       'Decking Installer',
  'decking fitter/groundworker':   'Decking Installer',
  'decking/paving':                'Decking Installer',
  'decking install/paving':        'Decking Installer',
  // Handyman
  'handyman':                      'Handyman',
  'handiman':                      'Handyman',
  'carpenter / handy man':         'Handyman',
  // Van Driver
  'van driver':                    'Van Driver',
  // Maintenance
  'maintenance':                   'Maintenance Operative',
  'maintance':                     'Maintenance Operative',
  'lanscape maintance':            'Maintenance Operative',
  // Admin
  'admin':                         'Admin',
  'office admin & h&s':            'Admin',
  // Multi-Skilled
  'multi skilled':                 'Multi-Skilled',
  'multi skilled +paver':          'Multi-Skilled',
}

// ─── Trade fuzzy matching ────────────────────────────────────────────────────
function matchTrade(raw: string, categories: TradeCategory[]): TradeCategory | null {
  if (!raw) return null
  const lower = raw.toLowerCase().trim()

  // 1. Alias map — covers colloquial/misspelled CSV values
  const aliasName = TRADE_ALIASES[lower]
  if (aliasName) {
    const aliasMatch = categories.find(c => c.name.toLowerCase() === aliasName.toLowerCase())
    if (aliasMatch) return aliasMatch
  }

  // 2. Exact match
  const exact = categories.find(c => c.name.toLowerCase() === lower)
  if (exact) return exact

  // 3. Category name starts with input (e.g. "groundwork" matches "Groundworker")
  const startsWith = categories.find(c => c.name.toLowerCase().startsWith(lower))
  if (startsWith) return startsWith

  // 4. Input contains the category name
  const contained = categories.find(c => lower.includes(c.name.toLowerCase()))
  if (contained) return contained

  return null
}

// ─── Main parse function ─────────────────────────────────────────────────────
// ─── Split multi-trade raw string into individual trade names ─────────────────
function splitTradeString(raw: string): string[] {
  if (!raw || raw === '0.00') return []
  // Split on / & and (word boundary)
  const parts = raw
    .split(/[\/&]|\band\b/i)
    .map(p => p.trim())
    .filter(p => p.length > 0 && p !== '0.00')
  return parts
}

export function parseOperativesCSV(
  csvText: string,
  tradeCategories: TradeCategory[],
  existingPhones: Set<string>,
  existingNIs: Set<string>,
): ParseResult {
  const allRows = parseCSV(csvText)

  if (allRows.length < 2) {
    return { rows: [], unmappedHeaders: [], total: 0, valid: 0, withWarnings: 0, withErrors: 0, duplicates: 0 }
  }

  const rawHeaders = allRows[0]
  const headerKeys = rawHeaders.map(h => h.toLowerCase().trim())

  // Detect completeness score column — last column with empty header containing digits 0-10
  const lastColIdx = rawHeaders.length - 1
  const secondLastColIdx = rawHeaders.length - 2
  // The completeness score is in the very last unnamed column (index varies — detect by content)
  // We check both unnamed columns and pick the one with values 0-10
  const potentialScoreCols = [lastColIdx, secondLastColIdx].filter(
    i => rawHeaders[i]?.trim() === ''
  )

  // Build column index → field name mapping
  const columnMap: Array<string | null> = headerKeys.map(h => {
    if (h in HEADER_MAP) return HEADER_MAP[h]
    return undefined as unknown as null // unmapped
  })

  const unmappedHeaders: string[] = rawHeaders.filter((_, i) => columnMap[i] === undefined)

  const parsedRows: ParsedRow[] = []

  for (let ri = 1; ri < allRows.length; ri++) {
    const row = allRows[ri]
    // Skip entirely blank rows
    if (row.every(v => !v.trim())) continue

    const warnings: string[] = []
    const errors: string[] = []
    const data: Record<string, string | number | null> = {}
    let tradeName = ''
    let trades: TradeMatch[] = []
    let cscsCards: CscsCard[] = []
    let agencyName: string | null = null
    let completenessScore: number | null = null
    let isDuplicate = false

    // ── Detect completeness score from unnamed trailing column ────────────────
    for (const colIdx of potentialScoreCols) {
      const val = (row[colIdx] ?? '').trim()
      const num = parseInt(val, 10)
      if (!isNaN(num) && num >= 0 && num <= 10) {
        completenessScore = num
        break
      }
    }

    for (let ci = 0; ci < rawHeaders.length; ci++) {
      const field = columnMap[ci]
      if (field === null || field === undefined) continue

      const raw = (row[ci] ?? '').trim()

      if (field === 'trade') {
        tradeName = raw
        // Split into individual trades
        const parts = splitTradeString(raw)
        if (parts.length === 0) {
          trades = []
        } else {
          trades = parts.map(part => {
            const matched = matchTrade(part, tradeCategories)
            return {
              raw: part,
              matchedId: matched?.id ?? null,
              matchedName: matched?.name ?? null,
            }
          })
          // Set primary trade_category_id to first matched trade
          const primaryMatch = trades.find(t => t.matchedId !== null)
          data['trade_category_id'] = primaryMatch?.matchedId ?? null

          // Warn for unrecognised trades
          const unmatched = trades.filter(t => t.matchedId === null).map(t => t.raw)
          if (unmatched.length > 0) {
            warnings.push(`Trade${unmatched.length > 1 ? 's' : ''} not recognised: "${unmatched.join('", "')}" — imported without trade category`)
          }
        }
        continue
      }

      if (field === 'phone') {
        const normalised = normalisePhone(raw)
        if (raw && !normalised) {
          warnings.push(`Phone "${raw}" could not be normalised to a valid format`)
        }
        data[field] = normalised
        continue
      }

      if (['date_of_birth', 'cscs_expiry', 'start_date', 'last_worked_date'].includes(field)) {
        const iso = raw ? normaliseDate(raw) : null
        if (raw && !iso) {
          warnings.push(`Date "${raw}" could not be parsed (${field}) — expected DD/MM/YYYY`)
        }
        data[field] = iso
        continue
      }

      if (field === 'cscs_card_type') {
        // Parse compound values (white/green, green gqa, etc.)
        cscsCards = parseCscsField(raw)
        if (raw && raw !== '0.00' && cscsCards.length === 0) {
          warnings.push(`CSCS colour "${raw}" not recognised — expected: Green, Blue, Gold, Black, Red, or White`)
        }
        // Primary card colour goes into the existing field
        data[field] = cscsCards.length > 0 ? cscsCards[0].cardType : null
        continue
      }

      if (field === 'grade') {
        const grade = raw ? (GRADE_MAP[raw.toLowerCase().trim()] ?? null) : null
        if (raw && !grade) {
          warnings.push(`Grade "${raw}" not recognised`)
        }
        data[field] = grade
        continue
      }

      if (field === 'day_rate' || field === 'hourly_rate') {
        const num = parseFloat(raw.replace(/[£,\s]/g, ''))
        data[field] = (isNaN(num) || num === 0) ? null : num
        continue
      }

      if (field === 'agency_name') {
        agencyName = (raw && !isJunk(raw)) ? raw : null
        data[field] = agencyName
        continue
      }

      // All other text fields: strip junk values ("0.00", "-", "N/A", etc.)
      data[field] = (raw && !isJunk(raw)) ? raw : null
    }

    // Store completeness score in data
    if (completenessScore !== null) {
      data['data_completeness_score'] = completenessScore
    }

    // ── Validation ────────────────────────────────────────────────────────────
    if (!data['first_name']) errors.push('First name is required')
    if (!data['last_name']) errors.push('Last name is required')
    if (!data['phone'] && !data['ni_number']) {
      errors.push('Either a phone number or NI number is required')
    }
    // Contact quality warnings (not blocking — will import, but can't contact)
    if (!data['phone'] && !data['email']) {
      warnings.push('No contact details — no phone number or email address. Cannot contact this operative.')
    } else if (!data['phone']) {
      warnings.push('No phone number — email only contact')
    }

    // ── Duplicate detection ───────────────────────────────────────────────────
    const phone = data['phone'] as string | null
    const ni = data['ni_number'] as string | null

    if (phone && existingPhones.has(phone)) {
      isDuplicate = true
      warnings.push(`Phone ${phone} already exists in the system — this row will be skipped`)
    } else if (ni && existingNIs.has(ni)) {
      isDuplicate = true
      warnings.push(`NI number ${ni} already exists in the system — this row will be skipped`)
    }

    parsedRows.push({
      rowIndex: ri + 1,
      data,
      tradeName,
      trades,
      cscsCards,
      agencyName,
      completenessScore,
      warnings,
      errors,
      isDuplicate,
    })
  }

  return {
    rows: parsedRows,
    unmappedHeaders,
    total: parsedRows.length,
    valid: parsedRows.filter(r => r.errors.length === 0 && r.warnings.length === 0 && !r.isDuplicate).length,
    withWarnings: parsedRows.filter(r => r.errors.length === 0 && r.warnings.length > 0 && !r.isDuplicate).length,
    withErrors: parsedRows.filter(r => r.errors.length > 0).length,
    duplicates: parsedRows.filter(r => r.isDuplicate).length,
  }
}
