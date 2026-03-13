/**
 * Global auth setup — runs once before all tests.
 *
 * Because the app uses GitHub OAuth, we can't drive the OAuth flow in
 * Playwright. Instead we use the Supabase Admin API to create a dedicated
 * test user with email + password, log in as that user, save the session,
 * then clean up the test user in globalTeardown.
 */

import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const SESSION_FILE = path.join(process.cwd(), 'e2e/.auth/session.json')
const TEST_EMAIL = 'playwright-test@pangaea-demo.internal'
const TEST_PASSWORD = 'Playwright-Test-2026!'

export default async function globalSetup() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseUrl || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Create test user (idempotent — delete first if exists)
  const { data: existingUsers } = await admin.auth.admin.listUsers()
  const existing = existingUsers?.users.find((u) => u.email === TEST_EMAIL)
  if (existing) {
    await admin.auth.admin.deleteUser(existing.id)
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  })

  if (createErr || !created.user) {
    throw new Error(`Failed to create test user: ${createErr?.message}`)
  }

  // The migration 00007 trigger auto-creates public.users on auth signup,
  // but admin.createUser doesn't fire the trigger. Insert manually.
  await admin.from('users').insert({
    auth_user_id: created.user.id,
    organization_id: process.env.NEXT_PUBLIC_ORG_ID!,
    first_name: 'Playwright',
    last_name: 'Test',
    email: TEST_EMAIL,
    role: 'admin',
  }).select()

  // Generate a magic link for the test user — works regardless of which
  // auth providers are enabled (avoids needing email/password auth enabled)
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: TEST_EMAIL,
    options: { redirectTo: 'http://localhost:3000/auth/callback?next=/dashboard' },
  })

  if (linkErr || !linkData?.properties?.action_link) {
    throw new Error(`Failed to generate magic link: ${linkErr?.message}`)
  }

  const magicLink = linkData.properties.action_link

  const browser = await chromium.launch()
  const page = await browser.newPage()

  // Navigate directly to the magic link — Supabase validates and redirects via /auth/callback
  await page.goto(magicLink)
  await page.waitForURL('**/dashboard', { timeout: 15000 })

  await page.context().storageState({ path: SESSION_FILE })
  await browser.close()

  console.log('  ✓ Test user created and session saved')
}
