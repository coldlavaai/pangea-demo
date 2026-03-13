/**
 * Pangaea — Pay Rate Lookup
 *
 * Uses Pangaea's actual grade/quartile rate card from:
 * docs/client/Grade_Pay_Rates.csv
 *
 * Rates are HOURLY. Day rate = hourly × 8.
 * Grade is inferred from CSCS colour on intake.
 * Quartile is inferred from experience years.
 * Staff confirms/adjusts after meeting the operative.
 */

// Pangaea's hourly pay rates by grade and quartile
// Each quartile has [min, max] in £/hr
// Source: Company-worker-database-New.xlsm "Grades Margin By Quartile" sheet
const PANGAEA_RATES: Record<string, { q1: [number, number]; q2: [number, number]; q3: [number, number]; q4: [number, number] }> = {
  skilled:           { q1: [14.00, 14.75], q2: [14.76, 15.50], q3: [15.51, 16.25], q4: [16.26, 17.00] },
  highly_skilled:    { q1: [17.01, 18.01], q2: [18.02, 19.01], q3: [19.02, 20.00], q4: [20.01, 21.00] },
  exceptional_skill: { q1: [21.01, 22.01], q2: [22.02, 23.01], q3: [23.02, 24.00], q4: [24.01, 25.00] },
  specialist_skill:  { q1: [25.01, 26.01], q2: [26.02, 27.01], q3: [27.02, 28.00], q4: [28.01, 29.00] },
  engineer:          { q1: [25.00, 28.75], q2: [28.76, 32.50], q3: [32.51, 36.25], q4: [36.26, 40.00] },
  manager:           { q1: [25.00, 28.75], q2: [28.76, 32.50], q3: [32.51, 36.25], q4: [36.26, 40.00] },
  senior_manager:    { q1: [25.00, 28.75], q2: [28.76, 32.50], q3: [32.51, 36.25], q4: [36.26, 40.00] }, // same as manager (source had #ERROR)
  contracts_manager: { q1: [27.78, 30.84], q2: [30.85, 33.89], q3: [33.90, 36.95], q4: [36.96, 40.00] },
  project_manager:   { q1: [27.78, 30.84], q2: [30.85, 33.89], q3: [33.90, 36.95], q4: [36.96, 40.00] },
}

// Confirmed flat rates for operational grades (not quartile-based)
// pay = what operative receives, charge = what the company bills the site
// Source: workers spreadsheet col 8 (charge) + Q1 answers from client (2026-03-07)
// NOTE: pay rates for most operational grades vary per individual — only confirmed flat rates stored here
export const OPERATIONAL_RATES: Record<string, { charge: number; pay: number | null }> = {
  groundworker:        { charge: 21.95, pay: null  }, // pay varies per individual
  skilled_landscaper:  { charge: 26.59, pay: null  }, // pay varies per individual
  plant_operator:      { charge: 26.59, pay: null  }, // same charge as skilled landscaper (confirmed by client)
  site_supervisor:     { charge: 37.40, pay: null  }, // pay varies per individual
  site_manager:        { charge: 41.52, pay: null  }, // pay varies per individual
  operative:           { charge: 20.00, pay: null  }, // pay varies per individual
  mobile_crew:         { charge: 20.00, pay: null  }, // pay varies per individual
  agency_labour:       { charge: 31.74, pay: 28.75 }, // confirmed by client 2026-03-07
  document_controller: { charge: 21.95, pay: 13.57 }, // confirmed by client 2026-03-07
  semi_skilled:        { charge: 0,     pay: null  }, // grade confirmed, rates TBC
  manager:             { charge: 41.52, pay: null  }, // historical = site_manager
}

// CSCS colour → default grade mapping
const CSCS_TO_GRADE: Record<string, string> = {
  green: 'skilled',
  red:   'skilled',
  blue:  'highly_skilled',
  gold:  'exceptional_skill',
  black: 'manager',
  white: 'engineer',
}

// Experience years → quartile mapping
export type Quartile = 'q1' | 'q2' | 'q3' | 'q4'

function experienceToQuartile(years: number): Quartile {
  if (years <= 1) return 'q1'
  if (years <= 3) return 'q2'
  if (years <= 6) return 'q3'
  return 'q4'
}

export interface EstimatedRate {
  hourlyRate: number   // £/hr — midpoint of quartile range
  dayRate: number      // hourlyRate × 8, rounded to nearest £2
  grade: string        // operative_grade enum value
  quartile: Quartile   // q1–q4
  rationale: string    // human-readable explanation for staff
}

/**
 * Estimate an operative's day rate based on intake data.
 *
 * @param cscsColour - CSCS card colour from Amber (null if no card)
 * @param experienceYears - Years of experience from Amber
 * @returns EstimatedRate — rate, grade, quartile, and explanation
 */
export function estimateDayRate(
  cscsColour: string | null | undefined,
  experienceYears: number
): EstimatedRate {
  // 1. Determine grade from CSCS colour
  const colour = cscsColour?.toLowerCase().trim() || 'green'
  const grade = CSCS_TO_GRADE[colour] ?? 'skilled'

  // 2. Determine quartile from experience
  const quartile = experienceToQuartile(experienceYears)

  // 3. Look up rate
  const gradeRates = PANGAEA_RATES[grade] ?? PANGAEA_RATES.skilled
  const [min, max] = gradeRates[quartile]

  // Use midpoint of the quartile range
  const hourlyRate = Math.round(((min + max) / 2) * 100) / 100
  const rawDayRate = hourlyRate * 8
  const dayRate = Math.round(rawDayRate / 2) * 2 // Round to nearest £2

  const quartileLabel = { q1: 'Q1 (Entry)', q2: 'Q2 (Developing)', q3: 'Q3 (Experienced)', q4: 'Q4 (Senior)' }[quartile]

  const rationale = [
    `Grade: ${grade} (from ${colour} CSCS)`,
    `Quartile: ${quartileLabel} (${experienceYears} yrs experience)`,
    `Hourly: £${hourlyRate.toFixed(2)}/hr (midpoint of £${min.toFixed(2)}–£${max.toFixed(2)})`,
    `Day rate: £${dayRate}/day (×8 hrs)`,
    `⚠️ Estimated — confirm with staff`,
  ].join(' · ')

  return { hourlyRate, dayRate, grade, quartile, rationale }
}

/**
 * Get the full rate range for a grade (for display in the UI).
 */
export function getGradeRateRange(grade: string): { minHourly: number; maxHourly: number; minDay: number; maxDay: number } | null {
  const rates = PANGAEA_RATES[grade]
  if (!rates) return null
  return {
    minHourly: rates.q1[0],
    maxHourly: rates.q4[1],
    minDay: Math.round(rates.q1[0] * 8),
    maxDay: Math.round(rates.q4[1] * 8),
  }
}

/**
 * Get the midpoint day rate for a specific grade + quartile (for the Adjust Rate modal).
 */
export function getMidpointDayRate(grade: string, quartile: string): number | null {
  const rates = PANGAEA_RATES[grade]
  if (!rates || !['q1', 'q2', 'q3', 'q4'].includes(quartile)) return null
  const [min, max] = rates[quartile as Quartile]
  const hourlyRate = Math.round(((min + max) / 2) * 100) / 100
  return Math.round(hourlyRate * 8 / 2) * 2
}

export const GRADE_LABELS: Record<string, string> = {
  // Skill bands
  skilled:             'Skilled',
  highly_skilled:      'Highly Skilled',
  exceptional_skill:   'Exceptional Skill',
  specialist_skill:    'Specialist Skill',
  engineer:            'Engineer',
  manager:             'Manager',
  senior_manager:      'Senior Manager',
  contracts_manager:   'Contracts Manager',
  project_manager:     'Project Manager',
  // Operational grades
  groundworker:        'Groundworker',
  skilled_landscaper:  'Skilled Landscaper',
  plant_operator:      'Plant Operator',
  site_supervisor:     'Site Supervisor',
  site_manager:        'Site Manager',
  operative:           'Operative',
  mobile_crew:         'Mobile Crew',
  agency_labour:       'Agency Labour',
  document_controller: 'Document Controller',
  semi_skilled:        'Semi-Skilled',
}

export const QUARTILE_LABELS: Record<string, string> = {
  q1: 'Q1 — Entry (0–1 yr)',
  q2: 'Q2 — Developing (2–3 yr)',
  q3: 'Q3 — Experienced (4–6 yr)',
  q4: 'Q4 — Senior (7+ yr)',
}
