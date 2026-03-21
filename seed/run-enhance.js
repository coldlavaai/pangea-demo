#!/usr/bin/env node
const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

const DB_URL = 'postgresql://postgres.xmmigscmuohcjwkmqvwi:Pangea22!2025!@aws-1-eu-west-2.pooler.supabase.com:5432/postgres'

async function main() {
  const pg = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
  await pg.connect()
  console.log('✓ Connected\n')

  const sql = fs.readFileSync(path.join(__dirname, 'enhance-demo.sql'), 'utf8')

  console.log('Running enhancement SQL...')
  try {
    await pg.query(sql)
  } catch(e) {
    console.error('Error:', e.message)
    if (e.detail) console.error('Detail:', e.detail)
    if (e.position) console.error('Position:', e.position)
    // Show snippet of SQL around the position
    if (e.position) {
      const pos = parseInt(e.position)
      console.error('SQL context:', sql.substring(Math.max(0, pos-200), pos+200))
    }
    throw e
  }
  await pg.end()

  console.log('\n✅ ENHANCEMENT COMPLETE')
}

main().catch(err => {
  console.error('\n❌ FAILED:', err.message)
  if (err.detail) console.error('Detail:', err.detail)
  if (err.hint) console.error('Hint:', err.hint)
  process.exit(1)
})
