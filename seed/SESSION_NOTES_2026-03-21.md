# Demo Seed Session Notes — 2026-03-21

## STATUS: SEED COMPLETE ✅ — 2026-03-21

## Final counts (verified):
- Operatives: 1,200
- Sites: 28
- Allocations: 1,450
- Timesheets: 2,431
- Documents: 5,034
- Message threads: 890
- Notifications: 150
- NCRs: 120

## Login: demo@demo.com / demo123 at https://pangaea-demo.vercel.app

## What was built

Two files created:
1. `/Users/oliver/pangaea-demo/seed/create-demo.js` — Node.js runner
2. `/Users/oliver/pangaea-demo/seed/demo-seed.sql` — 1,405 lines of SQL, 16 phases

## Goal
Create Pillar 43 Construction demo account at pangaea-demo.vercel.app
- Login: demo@demo.com / demo123
- 1,200 operatives, reference prefix P43-XXXX
- Every page populated for marketing screenshots

## Credentials
- DB direct: `postgresql://postgres:Pangea22!2025!@db.xmmigscmuohcjwkmqvwi.supabase.co:5432/postgres`
- Org ID: `00000000-0000-0000-0000-000000000002`
- Demo users: demo@demo.com/demo123, sarah.okonkwo@pillar43.co.uk/Pillar43!2026, james.whitfield@pillar43.co.uk/Pillar43!2026

## Fixed UUIDs (used throughout SQL for FK references)
- Org: `00000000-0000-0000-0000-000000000002`
- Trades: `11111111-0000-0000-0000-000000000001` through `...012`
- Sites: `22222222-0000-0000-0000-000000000001` through `...028`
- Agencies: `33333333-0000-0000-0000-000000000001` through `...005`

## 16 SQL Phases
1. UPDATE public.users for 3 staff + INSERT 12 trades
2. INSERT 28 sites (22 active, 4 completed, 2 upcoming)
3. INSERT 56 site managers (2 per site), phones +447801001001-056
4. INSERT 5 agencies
5. INSERT 1,200 operatives (DO block loop), phones +447400001002-002201
6. INSERT documents (RTW, photo_id, cscs_card, first_aid, asbestos per tier)
7. INSERT operative_cscs_cards + operative_trades
8. INSERT labour_requests + allocations
9. INSERT performance_reviews (bell curve scoring)
10. INSERT timesheets + timesheet_entries (400 completed allocs, RETURNING id INTO v_ts)
11. INSERT NCRs
12. INSERT message_threads + messages (900 threads)
13. INSERT work_history (800 operatives)
14. INSERT pay_rates (700 operatives)
15. INSERT notifications (150 records, correct schema: no user_id, uses `read` BOOLEAN, has `severity`)
16. INSERT workflow_runs (25) + workflow_targets (5 per run)

## Known issues FIXED in SQL
- Timesheet IDs: uses `RETURNING id INTO v_ts` (UUID column, not serial — can't use currval)
- Notifications: no user_id column, uses `read` not `is_read`, has `severity`, has `operative_id`
- Auth users: direct INSERT into auth.users using `crypt($2, gen_salt('bf'))` — bypasses Supabase Admin API

## Last error before context ran out
`connect EHOSTUNREACH` on IPv6 — FIXED by adding `family: 4` to pg Client options

## To run next session
```bash
cd /Users/oliver/pangaea-demo
node seed/create-demo.js
```

If SQL errors occur, check:
1. Enum values (operative_status, allocation_status, cscs_card_type, etc.)
2. Column names differ from Aztec (e.g. `data_completeness_score` is plain INTEGER not GENERATED)
3. ON CONFLICT targets must match actual unique constraints

## If seed runs clean
Log in as demo@demo.com at https://pangaea-demo.vercel.app
Check: Operatives list, Sites, Allocations, Timesheets, Compliance, RAP, NCRs, Messages, Notifications, Workflows

## npm dep
`pg` package installed as devDependency — already done
