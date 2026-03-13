/**
 * Global teardown — deletes the Playwright test user after all tests finish.
 */

import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const TEST_EMAIL = 'playwright-test@pangaea-demo.internal'

export default async function globalTeardown() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data } = await admin.auth.admin.listUsers()
  const user = data?.users.find((u) => u.email === TEST_EMAIL)
  if (user) {
    await admin.auth.admin.deleteUser(user.id)
    console.log('  ✓ Test user deleted')
  }
}
