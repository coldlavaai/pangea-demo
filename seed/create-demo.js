#!/usr/bin/env node
/**
 * Pillar 43 Construction — Demo Seed Runner
 * Creates auth users via direct SQL + runs full demo-seed.sql
 *
 * Usage: node seed/create-demo.js
 *
 * DB: Pangaea Supabase (London, xmmigscmuohcjwkmqvwi)
 * Pooler: aws-1-eu-west-2.pooler.supabase.com (IPv4, session mode)
 */

const { Client } = require('pg')
const fs         = require('fs')
const path       = require('path')

const DB_URL = 'postgresql://postgres.xmmigscmuohcjwkmqvwi:Pangea22!2025!@aws-1-eu-west-2.pooler.supabase.com:5432/postgres'
const ORG_ID = '00000000-0000-0000-0000-000000000002'

const USERS = [
  { email: 'demo@demo.com',                 password: 'demo123',       first: 'Demo',  last: 'Admin',     role: 'director'       },
  { email: 'sarah.okonkwo@pillar43.co.uk',  password: 'Pillar43!2026', first: 'Sarah', last: 'Okonkwo',   role: 'labour_manager' },
  { email: 'james.whitfield@pillar43.co.uk',password: 'Pillar43!2026', first: 'James', last: 'Whitfield', role: 'admin'          },
]

async function main() {
  const pg = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
  await pg.connect()
  console.log('✓ Connected to database\n')

  // ── 1. Create org ────────────────────────────────────────────────
  console.log('Creating Pillar 43 Construction org...')
  await pg.query(`
    INSERT INTO public.organizations (id, name, slug, settings)
    VALUES ($1, 'Pillar 43 Construction', 'pillar43',
      '{"reference_prefix":"P43","assistant_name":"Rex","intake_bot_name":"Amber","company_name":"Pillar 43 Construction"}'::jsonb)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      slug = EXCLUDED.slug,
      settings = EXCLUDED.settings
  `, [ORG_ID])
  console.log('  ✓ Org ready\n')

  // ── 2. Create auth users via direct SQL ──────────────────────────
  const authIds = []
  for (const u of USERS) {
    console.log(`Creating auth user: ${u.email}`)

    // Check if already exists
    const existing = await pg.query(
      `SELECT id FROM auth.users WHERE email = $1`, [u.email]
    )

    let authId
    if (existing.rows.length > 0) {
      authId = existing.rows[0].id
      console.log(`  ✓ Already exists: ${authId}`)
    } else {
      // Insert directly — pgcrypto bcrypt hash, trigger creates public.users
      const result = await pg.query(`
        INSERT INTO auth.users (
          instance_id, id, aud, role, email,
          encrypted_password, email_confirmed_at,
          created_at, updated_at,
          raw_user_meta_data, is_super_admin,
          raw_app_meta_data, confirmation_token
        ) VALUES (
          '00000000-0000-0000-0000-000000000000',
          gen_random_uuid(),
          'authenticated', 'authenticated', $1,
          crypt($2, gen_salt('bf')),
          NOW(), NOW(), NOW(),
          $3::jsonb,
          false,
          '{"provider":"email","providers":["email"]}'::jsonb,
          ''
        ) RETURNING id
      `, [
        u.email,
        u.password,
        JSON.stringify({ first_name: u.first, last_name: u.last, role: u.role, organization_id: ORG_ID })
      ])
      authId = result.rows[0].id
      console.log(`  ✓ Created: ${authId}`)
    }

    // Ensure auth.identities record exists (required for signInWithPassword)
    await pg.query(`
      INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3::jsonb, 'email', NOW(), NOW(), NOW())
      ON CONFLICT DO NOTHING
    `, [authId, u.email, JSON.stringify({ sub: authId, email: u.email })])

    authIds.push(authId)
  }

  const [authId1, authId2, authId3] = authIds
  console.log()

  // ── 3. Run main seed SQL ─────────────────────────────────────────
  let sql = fs.readFileSync(path.join(__dirname, 'demo-seed.sql'), 'utf8')
  sql = sql
    .replace(/\{\{AUTH_USER_ID_1\}\}/g, authId1)
    .replace(/\{\{AUTH_USER_ID_2\}\}/g, authId2)
    .replace(/\{\{AUTH_USER_ID_3\}\}/g, authId3)

  console.log('Running seed SQL (2-4 minutes)...')
  await pg.query(sql)
  await pg.end()

  console.log('\n✅ SEED COMPLETE')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Login:    demo@demo.com')
  console.log('Password: demo123')
  console.log('URL:      https://pangaea-demo.vercel.app')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main().catch(err => {
  console.error('\n❌ FAILED:', err.message)
  if (err.detail) console.error('Detail:', err.detail)
  process.exit(1)
})
