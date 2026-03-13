/**
 * Operative module E2E tests — covers S4, S5, S6.
 *
 * Uses the authenticated session from auth.setup.ts.
 * Creates a test operative, runs all assertions, then deletes it.
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!

let testOperativeId: string | null = null

// ── Seed / cleanup ─────────────────────────────────────────────────────────────

test.beforeAll(async () => {
  const { data, error } = await supabase
    .from('operatives')
    .insert({
      organization_id: ORG_ID,
      first_name: 'Test',
      last_name: 'Playwright',
      phone: '+447700000001',
      email: 'playwright@test.pangaea',
      status: 'available',
      labour_type: 'blue_collar',
    })
    .select('id')
    .single()

  if (error) throw new Error(`Seed failed: ${error.message}`)
  testOperativeId = data.id
})

test.afterAll(async () => {
  if (testOperativeId) {
    await supabase.from('operatives').delete().eq('id', testOperativeId)
  }
})

// ── S4: Operatives list ────────────────────────────────────────────────────────

test('S4 — operatives list page loads', async ({ page }) => {
  await page.goto('/operatives')
  await expect(page).toHaveTitle(/Pangaea/)
  await expect(page.getByRole('heading', { name: 'Operatives' })).toBeVisible()
})

test('S4 — stats cards are visible', async ({ page }) => {
  await page.goto('/operatives')
  await expect(page.getByText('Total Operatives')).toBeVisible()
  await expect(page.getByText('Available')).toBeVisible()
  await expect(page.getByText('Working')).toBeVisible()
  await expect(page.getByText('Blocked')).toBeVisible()
})

test('S4 — search filter narrows results', async ({ page }) => {
  await page.goto('/operatives')
  const search = page.getByPlaceholder('Search name, phone, ref…')
  await search.fill('Playwright')
  // Wait for debounce + navigation
  await page.waitForURL(/q=Playwright/, { timeout: 3000 })
  await expect(page.getByText('Test Playwright')).toBeVisible()
})

test('S4 — clear filter resets search', async ({ page }) => {
  await page.goto('/operatives?q=Playwright')
  await page.getByRole('button', { name: /clear/i }).click()
  await page.waitForURL('/operatives', { timeout: 3000 })
})

// ── S5: Operative profile ──────────────────────────────────────────────────────

test('S5 — profile page loads from list', async ({ page }) => {
  await page.goto('/operatives?q=Playwright')
  await page.getByText('Test Playwright').first().click()
  await page.waitForURL(/\/operatives\/[a-z0-9-]+$/)
  await expect(page.getByRole('heading', { name: 'Test Playwright' })).toBeVisible()
})

test('S5 — all 6 tabs are present', async ({ page }) => {
  await page.goto(`/operatives/${testOperativeId}`)
  for (const tab of ['Overview', 'Documents', 'Allocations', 'RAP', 'NCRs', 'Comms']) {
    await expect(page.getByRole('link', { name: tab })).toBeVisible()
  }
})

test('S5 — Overview tab shows contact info', async ({ page }) => {
  await page.goto(`/operatives/${testOperativeId}`)
  await expect(page.getByText('Contact')).toBeVisible()
  await expect(page.getByText('+447700000001')).toBeVisible()
})

test('S5 — Documents tab loads empty state', async ({ page }) => {
  await page.goto(`/operatives/${testOperativeId}?tab=documents`)
  await expect(page.getByText('No documents yet')).toBeVisible()
  await expect(page.getByRole('link', { name: /upload document/i })).toBeVisible()
})

test('S5 — Allocations tab loads empty state', async ({ page }) => {
  await page.goto(`/operatives/${testOperativeId}?tab=allocations`)
  await expect(page.getByText('No allocations yet')).toBeVisible()
})

test('S5 — RAP tab shows score card', async ({ page }) => {
  await page.goto(`/operatives/${testOperativeId}?tab=rap`)
  await expect(page.getByText('Current RAP Score')).toBeVisible()
})

test('S5 — NCRs tab loads empty state', async ({ page }) => {
  await page.goto(`/operatives/${testOperativeId}?tab=ncrs`)
  await expect(page.getByText('No NCRs')).toBeVisible()
})

test('S5 — Comms tab loads empty state', async ({ page }) => {
  await page.goto(`/operatives/${testOperativeId}?tab=comms`)
  await expect(page.getByText('No WhatsApp thread')).toBeVisible()
})

test('S5 — Edit button links to edit page', async ({ page }) => {
  await page.goto(`/operatives/${testOperativeId}`)
  await page.getByRole('link', { name: 'Edit' }).click()
  await page.waitForURL(`/operatives/${testOperativeId}/edit`)
  await expect(page.getByText(/edit —/i)).toBeVisible()
})

// ── S6: Create + Edit forms ────────────────────────────────────────────────────

test('S6 — new operative page loads', async ({ page }) => {
  await page.goto('/operatives/new')
  await expect(page.getByRole('heading', { name: 'Add Operative' })).toBeVisible()
})

test('S6 — create form validates required fields', async ({ page }) => {
  await page.goto('/operatives/new')
  await page.getByRole('button', { name: 'Create Operative' }).click()
  // RHF validation fires — required fields show errors
  await expect(page.getByText('Required').first()).toBeVisible()
})

test('S6 — create form submits and redirects to profile', async ({ page }) => {
  await page.goto('/operatives/new')

  await page.getByLabel('First Name').fill('E2E')
  await page.getByLabel('Last Name').fill('CreateTest')
  await page.getByLabel('Phone').fill('+447700000099')

  await page.getByRole('button', { name: 'Create Operative' }).click()
  await page.waitForURL(/\/operatives\/[a-z0-9-]+$/, { timeout: 10000 })

  const createdId = page.url().split('/').pop()!
  await expect(page.getByRole('heading', { name: 'E2E CreateTest' })).toBeVisible()

  // Clean up the created operative
  await supabase.from('operatives').delete().eq('id', createdId)
})

test('S6 — edit form pre-fills existing data', async ({ page }) => {
  await page.goto(`/operatives/${testOperativeId}/edit`)
  await expect(page.getByLabel('First Name')).toHaveValue('Test')
  await expect(page.getByLabel('Last Name')).toHaveValue('Playwright')
  await expect(page.getByLabel('Phone')).toHaveValue('+447700000001')
})

test('S6 — edit form saves changes', async ({ page }) => {
  await page.goto(`/operatives/${testOperativeId}/edit`)
  await page.getByLabel('First Name').fill('TestEdited')
  await page.getByRole('button', { name: 'Save Changes' }).click()
  await page.waitForURL(`/operatives/${testOperativeId}`, { timeout: 10000 })
  await expect(page.getByRole('heading', { name: 'TestEdited Playwright' })).toBeVisible()
})
