#!/usr/bin/env node
/**
 * Pangaea Demo — Screenshot Runner
 * Logs in as demo@demo.com and captures every page at 1440×900
 *
 * Usage:
 *   npx playwright install chromium   (first time only)
 *   node seed/take-screenshots.js
 *
 * Output: seed/screenshots/*.png
 */

const { chromium } = require('playwright')
const fs   = require('fs')
const path = require('path')

const BASE   = 'https://pangaea-demo.vercel.app'
const EMAIL  = 'demo@demo.com'
const PASS   = 'demo123'
const OUT    = path.join(__dirname, 'screenshots')

// Real IDs from seeded data
const OP1    = 'e189dacf-34c2-4e42-a9c5-0ffbde0d5b96'
const OP2    = 'b1e5ee30-46dc-4493-8896-93e666af63c3'
const SITE1  = '22222222-0000-0000-0000-000000000001'
const SITE2  = '22222222-0000-0000-0000-000000000002'
const ALLOC1 = '5f528bcf-1987-4a5d-81ee-433ce32e85d2'
const TS1    = '479d6d01-bc94-4450-9a72-9865141764d8'
const NCR1   = 'adaecc8d-a9cd-446f-a210-0d3a1af66137'
const REQ1   = 'ba88f022-694a-4cc0-81ac-6d5e6616eca4'
const COMM1  = '12d479c5-6880-430b-8128-be1559cfcd3f'

// Pages: [filename, path, selector to wait for]
const PAGES = [
  // Auth
  ['00-login',                '/login',                             'form'],

  // Dashboard
  ['01-dashboard',            '/dashboard',                         'main'],
  ['02-activity',             '/activity',                          'main'],

  // Operatives
  ['03-operatives-list',      '/operatives',                        'main'],
  ['04-operative-detail',     `/operatives/${OP1}`,                 'main'],
  ['05-operative-edit',       `/operatives/${OP1}/edit`,            'main'],
  ['06-operative-2',          `/operatives/${OP2}`,                 'main'],
  ['07-operatives-import',    '/operatives/import',                 'main'],

  // Sites
  ['08-sites-list',           '/sites',                             'main'],
  ['09-site-detail',          `/sites/${SITE1}`,                    'main'],
  ['10-site-detail-2',        `/sites/${SITE2}`,                    'main'],

  // Labour requests
  ['11-requests-list',        '/requests',                          'main'],
  ['12-request-detail',       `/requests/${REQ1}`,                  'main'],

  // Allocations
  ['13-allocations-list',     '/allocations',                       'main'],
  ['14-allocation-detail',    `/allocations/${ALLOC1}`,             'main'],

  // Timesheets
  ['15-timesheets-list',      '/timesheets',                        'main'],
  ['16-timesheet-detail',     `/timesheets/${TS1}`,                 'main'],

  // Documents / Compliance
  ['17-documents',            '/documents',                         'main'],

  // NCRs
  ['18-ncrs-list',            '/ncrs',                              'main'],
  ['19-ncr-detail',           `/ncrs/${NCR1}`,                      'main'],

  // Comms (WhatsApp)
  ['20-comms-list',           '/comms',                             'main'],
  ['21-comms-thread',         `/comms/${COMM1}`,                    'main'],

  // Reports
  ['22-reports',              '/reports',                           'main'],

  // Shifts
  ['23-shifts',               '/shifts',                            'main'],

  // Rex assistant
  ['24-assistant',            '/assistant',                         'main'],

  // Audit log
  ['25-audit-log',            '/audit-log',                         'main'],

  // Settings
  ['26-settings',             '/settings',                          'main'],
]

async function run() {
  fs.mkdirSync(OUT, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const ctx     = await browser.newContext({
    viewport:          { width: 1440, height: 900 },
    deviceScaleFactor: 2,  // retina — crisp on mac displays
  })
  const page = await ctx.newPage()

  // ── Log in ────────────────────────────────────────────────────────
  console.log('Logging in...')
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.fill('#email', EMAIL)
  await page.fill('#password', PASS)
  await page.click('button[type="submit"]')
  // Next.js client routing — wait for a dashboard element rather than URL change
  await page.waitForSelector('nav, aside, [data-sidebar], .sidebar', { timeout: 25000 })
  console.log('  ✓ Logged in\n')

  // ── Screenshot each page ─────────────────────────────────────────
  let ok = 0, fail = 0
  for (const [name, route, waitFor] of PAGES) {
    const url  = `${BASE}${route}`
    const file = path.join(OUT, `${name}.png`)
    process.stdout.write(`  ${name} ... `)
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
      if (waitFor) {
        await page.waitForSelector(waitFor, { timeout: 8000 }).catch(() => {})
      }
      // Let JS render and images settle
      await page.waitForTimeout(1500)
      await page.screenshot({ path: file, fullPage: false })
      console.log('✓')
      ok++
    } catch (err) {
      console.log(`✗  ${err.message.split('\n')[0]}`)
      fail++
    }
  }

  await browser.close()

  console.log(`\n${'━'.repeat(40)}`)
  console.log(`✅ Done — ${ok} captured, ${fail} failed`)
  console.log(`📁 ${OUT}`)
  console.log('━'.repeat(40))
}

run().catch(err => {
  console.error('\n❌ FATAL:', err.message)
  process.exit(1)
})
