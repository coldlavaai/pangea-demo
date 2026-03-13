# CLAUDE.md — Pangaea Demo

## Project
Pangaea Demo — workforce management platform (demo/white-label clone).
Oliver Tatler (Cold Lava). Direct comms. Build fast, no waffle.

**Repo:** `pangaea-demo`
**Live:** https://pangaea-demo.vercel.app
**Stack:** Next.js 15.5.12 · Supabase (Frankfurt, `xmmigscmuohcjwkmqvwi`) · Vercel · shadcn/ui · Tailwind
**Org ID:** `00000000-0000-0000-0000-000000000001`

---

## Start of Every Session — READ THESE FIRST

1. `/docs/PROJECT_STATE.md` — current build status, what's working, what's broken
2. `/docs/TODO.md` — current task queue with priorities
3. Latest file in `/docs/context-checkpoints/` — last session's state

**After completing any significant task:**
- Append to `/docs/CHANGELOG.md`
- Update `/docs/PROJECT_STATE.md` if feature status changes
- Tick off `/docs/TODO.md`

---

## Workflow Commands

| Command | Action |
|---|---|
| `checkpoint` | Create `/docs/context-checkpoints/YYYY-MM-DD-HHMM.md` |
| `status` | Read and summarise PROJECT_STATE.md + latest checkpoint |
| `todos` | Read and summarise TODO.md |
| `bugs` | Read and summarise BUGS.md |

---

## Context Management — CRITICAL

- **Never re-read a file already in context** unless it's been modified.
- **Use targeted line ranges** for files over 200 lines.
- **Filter all command output** — `| head -50`, `| tail -20`, `| grep "pattern"`. Never dump raw logs.
- **Plan before executing** multi-file changes — state what's changing and where.
- **Suppress install noise** — `npm install 2>&1 | tail -20`
- If context is getting heavy: summarise state, warn Oliver, recommend fresh session.

---

## Architecture — Locked Decisions (Do Not Revisit)

- **Next.js 15.5.12** — `params`/`searchParams` must be `await`-ed (they're Promises)
- **Server Components by default** — `'use client'` only where needed
- **`createServiceClient()`** in `@/lib/supabase/server` — always add `.eq('organization_id', orgId)` (bypasses RLS)
- **`allocation_status` enum** — `pending | confirmed | active | completed | terminated | no_show` — no 'cancelled', no 'expired'
- **`operative_status` enum** — `prospect | qualifying | pending_docs | verified | available | working | unavailable | blocked`
- **`cscs_card_type` enum** — `green | blue | gold | black | red | white | null` — no 'none'
- **Offer model** — simultaneous broadcast (top 3, 30-min window), first YES wins via `accept_allocation_offer()` PG function
- **RAP: A = Attitude** (not Attendance)
- **Allocation creation** — via `POST /api/allocations` only, runs `canAllocate()` check first
- **FK join syntax** — `operatives!allocations_operative_id_fkey` (explicit FK name required)
- **Git email for Vercel deploy** — must be `otatler@gmail.com`
- **Supabase migrations** — via SQL editor only, no `supabase db execute`
- **Amber intake** — state context in system prompt, NOT injected as fake messages
- **`intake_data`** lives on `message_threads`, NOT on `operatives`
- **`cscs_card_type`** on `operatives` is the source of truth for CSCS (set by Amber during intake)

---

## Code Conventions

- TypeScript everywhere. No `any` without a comment explaining why.
- Named exports preferred over default exports.
- API routes in `app/api/` using Route Handlers, consistent response shape: `{ success, data?, error? }`
- Zod schemas: `z.enum([...] as const)`, `z.boolean()` not `z.boolean().default()` with zodResolver
- `PageHeader` props: `title`, `description`, `action?: React.ReactNode`
- `StatsCard` props: `title` not `label`
- `EmptyState` props: `action?: React.ReactNode`

---

## Key File Locations

| Purpose | Path |
|---|---|
| Amber intake | `src/lib/whatsapp/amber-handler.ts` |
| WhatsApp router | `src/lib/whatsapp/handler.ts` |
| Twilio webhook | `src/app/api/webhooks/twilio/route.ts` |
| Document upload page | `src/app/apply/[token]/page.tsx` |
| Upload form (client) | `src/app/apply/[token]/upload-form.tsx` |
| Upload API | `src/app/api/apply/[token]/upload/route.ts` |
| WhatsApp send util | `src/lib/whatsapp/send.ts` |
| Supabase server client | `src/lib/supabase/server.ts` |
| Session history | `docs/sessions/` |
| Project state | `docs/PROJECT_STATE.md` |
| Build session plan | `docs/SESSION_PLAN.md` |

---

## What to Never Do

- Do not re-read a file already in context this session
- Do not cat / unfiltered reads on files over 200 lines
- Do not read `node_modules/`, `.next/`, `package-lock.json`
- Do not run verbose/debug commands by default
- Do not dump full logs without grep/head/tail
- Do not read `.env` files repeatedly
- Do not rewrite entire files when a targeted edit will do
- Do not leave `console.log` debugging in production code
- Do not hardcode API keys or org IDs (use env vars)
- Do not do direct DB inserts for allocations (use `POST /api/allocations`)
