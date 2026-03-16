# AZTEC BOS vs PANGAEA DEMO — Complete System Comparison

**Generated:** 2026-03-13
**Scope:** Every file, every line, every endpoint, every env var, every DB column, every integration, every template

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Project Identity & Origins](#2-project-identity--origins)
3. [Dependencies — Package by Package](#3-dependencies--package-by-package)
4. [Configuration Files](#4-configuration-files)
5. [Environment Variables — Complete Comparison](#5-environment-variables--complete-comparison)
6. [Database Schema — Table by Table](#6-database-schema--table-by-table)
7. [API Routes — Endpoint by Endpoint](#7-api-routes--endpoint-by-endpoint)
8. [Components — File by File](#8-components--file-by-file)
9. [Libraries & Utilities](#9-libraries--utilities)
10. [Middleware](#10-middleware)
11. [AI Assistants — Sophie/Amber & ALF/Rex](#11-ai-assistants--sophieamber--alfrex)
12. [WhatsApp / Twilio — Complete Comparison](#12-whatsapp--twilio--complete-comparison)
13. [Telegram Bots](#13-telegram-bots)
14. [Workflows](#14-workflows)
15. [Supabase — Full Schema Diff](#15-supabase--full-schema-diff)
16. [Vercel — Full Config Diff](#16-vercel--full-config-diff)
17. [Live App Scan Comparison](#17-live-app-scan-comparison)
18. [Security Comparison](#18-security-comparison)
19. [Branding & Styling](#19-branding--styling)
20. [Critical Issues Found](#20-critical-issues-found)

---

## 1. EXECUTIVE SUMMARY

**Pangaea is a clone of Aztec BOS.** The Pangaea repo was created on 2026-03-13 (today). The two codebases are structurally near-identical — same file structure, same components, same API routes, same dependencies, same database schema. The differences are:

| Aspect | Aztec BOS | Pangaea Demo |
|--------|-----------|-------------|
| **Repo** | `Aztec-Landscapes/aztec-bos` (private) | `coldlavaai/pangaea-demo` (public) |
| **Live URL** | aztec-landscapes-bos.vercel.app | pangaea-demo.vercel.app |
| **AI Intake Bot** | **Sophie** | **Amber** |
| **AI Assistant** | **ALF** | **Rex** |
| **Telegram Site Bot** | @AztecSiteBot | @PangaeaSiteBot |
| **Telegram Notify Bot** | @AlfNotificationsBot | @RexNotifyBot |
| **Supabase Project** | `ybfhkcvrzbgzrayjskfp` | `xmmigscmuohcjwkmqvwi` |
| **Twilio Account** | `[REDACTED-AZTEC-SID]` (primary) | `[REDACTED-PANGAEA-SID]` (subaccount of Aztec) |
| **WhatsApp Number** | +447414157366 | +447723325497 |
| **Reference Prefix** | AZT-XXXX | CL-XXXX |
| **Branding** | ALF logo, Geist fonts, "Aztec Construction" | Pangaea mark, forest green + copper, DM Sans/Serif, "Pangea" |
| **Org ID** | `00000000-0000-0000-0000-000000000001` | `00000000-0000-0000-0000-000000000001` (same!) |
| **Client** | Aztec Landscapes | Demo/Cold Lava showcase |
| **Maturity** | Production (20+ deployments, live data) | Fresh clone (created today, demo data) |

### Key Architectural Differences

| Feature | Aztec | Pangaea |
|---------|-------|---------|
| **Intake bot file** | `sophie-handler.ts` | `amber-handler.ts` |
| **Smart onboarding workflow** | Not present | Present (5th workflow) |
| **Induction page** | Present | Present |
| **DB tables** | ~39 + 2 views | ~40 + 2 views |
| **Enums** | 27 | 24 (missing 3) |
| **Migration files** | 16 | 67 |
| **Twilio templates** | 14 (13 approved, 1 unsubmitted) | 14 SIDs in code but only 1 exists on subaccount |
| **Vercel env vars** | 22 | 13 |
| **Storage bucket** | `operative-documents` (public) | `operative-documents` (private) |
| **Fonts** | Geist Sans + Geist Mono | DM Sans + DM Serif Display + JetBrains Mono |
| **Color scheme** | oklch neutral dark | Forest green + copper accent |
| **OpenAI usage** | Advert copy generation | Advert copy + Document Vision AI verification |

---

## 2. PROJECT IDENTITY & ORIGINS

| Property | Aztec BOS | Pangaea Demo |
|----------|-----------|-------------|
| **Local path** | `/Users/oliver/aztec-bos` | `/Users/oliver/pangaea-demo` |
| **GitHub repo** | `Aztec-Landscapes/aztec-bos` | `coldlavaai/pangaea-demo` |
| **Visibility** | Private | Public |
| **Created** | 2026-02-20 | 2026-03-13 |
| **Last push** | 2026-03-12 | 2026-03-13 |
| **Disk size** | ~8MB | ~1.5MB |
| **Languages** | TypeScript 1.8MB, PLpgSQL 50KB | TypeScript (similar) |
| **Default branch** | main | main |
| **Total deployments** | 40+ | 20+ (all today) |
| **CLAUDE.md** | Present (project-specific) | Present (project-specific) |
| **docs/ folder** | BUGS, CHANGELOG, DECISIONS, TODO, PROJECT_STATE, HANDOFF, sessions/ (S01-S23), client/ data | Similar docs structure + 67 migration files |
| **e2e tests** | Playwright (auth setup/teardown, operatives spec) | Playwright (identical structure) |

---

## 3. DEPENDENCIES — PACKAGE BY PACKAGE

### Identical in Both (28 packages)
| Package | Version |
|---------|---------|
| `@anthropic-ai/sdk` | ^0.78.0 |
| `@hookform/resolvers` | ^5.2.2 |
| `@react-pdf/renderer` | ^4.3.2 |
| `@supabase/ssr` | ^0.8.0 |
| `@supabase/supabase-js` | ^2.97.0 |
| `@tanstack/react-query` | ^5.90.21 |
| `@tanstack/react-table` | ^8.21.3 |
| `@tiptap/*` | ^3.20.0 (8 packages) |
| `@vercel/functions` | ^3.4.2 |
| `class-variance-authority` | ^0.7.1 |
| `clsx` | ^2.1.1 |
| `cmdk` | ^1.1.1 |
| `date-fns` | ^4.1.0 |
| `date-fns-tz` | ^3.2.0 |
| `jwt-decode` | ^4.0.0 |
| `lucide-react` | ^0.575.0 |
| `next` | 15.5.12 |
| `openai` | ^6.22.0 |
| `radix-ui` | ^1.4.3 |
| `react` | 19.1.0 |
| `react-dom` | 19.1.0 |
| `react-day-picker` | ^9.13.2 |
| `react-hook-form` | ^7.71.2 |
| `resend` | ^6.9.3 |
| `sonner` | ^2.0.7 |
| `tailwind-merge` | ^3.5.0 |
| `twilio` | ^5.12.2 |
| `zod` | ^4.3.6 |

### Dev Dependencies — Identical
| Package | Version |
|---------|---------|
| `@playwright/test` | ^1.58.2 |
| `@tailwindcss/postcss` | ^4 |
| `dotenv` | ^17.3.1 |
| `eslint` | ^9 |
| `eslint-config-next` | 15.5.12 |
| `shadcn` | ^3.8.5 |
| `tailwindcss` | ^4 |
| `tw-animate-css` | ^1.4.0 |
| `typescript` | ^5 |

### Differences
| Package | Aztec | Pangaea | Notes |
|---------|-------|---------|-------|
| `@eslint/eslintrc` | ^3 | Not present | Flat config compat |

**Verdict: Dependencies are 99% identical.**

---

## 4. CONFIGURATION FILES

| File | Aztec | Pangaea | Difference |
|------|-------|---------|------------|
| `next.config.ts` | Empty | Empty | **Identical** |
| `tsconfig.json` | ES2017, strict, `@/*` alias | ES2017, strict, `@/*` alias | **Identical** |
| `postcss.config.mjs` | `@tailwindcss/postcss` | `@tailwindcss/postcss` | **Identical** |
| `components.json` | new-york, neutral, RSC, lucide | new-york, neutral, RSC, lucide | **Identical** |
| `vercel.json` | 4 function overrides + 5 crons | 4 function overrides + 5 crons | **Identical structure, identical crons** |
| `playwright.config.ts` | Chromium, sequential, auth state | Chromium, sequential, auth state | **Identical** |
| `eslint.config.mjs` | Extends next, ignores database.ts | Extends next, ignores database.ts | **Identical** |

**Verdict: All config files are identical.**

---

## 5. ENVIRONMENT VARIABLES — COMPLETE COMPARISON

### Vercel Production Environment

| Variable | Aztec | Pangaea | Notes |
|----------|-------|---------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `ybfhkcvrzbgzrayjskfp.supabase.co` | `xmmigscmuohcjwkmqvwi.supabase.co` | Different projects |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Set | Set | Different keys |
| `SUPABASE_SERVICE_ROLE_KEY` | Set | Set | Different keys |
| `TWILIO_ACCOUNT_SID` | `[REDACTED-AZTEC-SID]` | `[REDACTED-PANGAEA-SID]` | Primary vs subaccount |
| `TWILIO_AUTH_TOKEN` | `[REDACTED]` | `[REDACTED]` | Different tokens |
| `TWILIO_WHATSAPP_NUMBER` | `whatsapp:+447414157366` | `whatsapp:+447723325497` | Different numbers |
| `ANTHROPIC_API_KEY` | Set | Set | May be same key |
| `OPENAI_API_KEY` | Set | Not set? | Only Aztec confirmed |
| `CRON_SECRET` | Set | `pangaea-cron-secret-2026` | Different secrets |
| `NEXT_PUBLIC_APP_URL` | `aztec-landscapes-bos.vercel.app` | `pangaea-demo.vercel.app` | Different URLs |
| `NEXT_PUBLIC_ORG_ID` | `00000000-...-000000000001` | `00000000-...-000000000001` | **SAME** |
| `GOOGLE_MAPS_API_KEY` | Set | Not set | **Aztec only** |
| `LIAM_WHATSAPP_NUMBER` | `whatsapp:+447742201349` | Not set | **Aztec only** |
| `TELEGRAM_BOT_TOKEN` | Set | Set | Different bots |
| `TELEGRAM_WEBHOOK_SECRET` | `aztec-tg-sm-2026` | `pangaea-tg-sm-2026` | Different secrets |
| `TELEGRAM_NOTIFY_TOKEN` | Set | Not set | **Aztec only** |
| `MICROSOFT_CLIENT_ID` | Set | Not set | **Aztec only** |
| `MICROSOFT_CLIENT_SECRET` | Set | Not set | **Aztec only** |
| `MICROSOFT_TENANT_ID` | Set | Not set | **Aztec only** |
| `AZTEC_STAFF_ALERT_SID` | Set | N/A | **Aztec only** |
| `AZTEC_DOC_EXPIRING_SID` | Set | N/A | **Aztec only** |
| `AZTEC_USER_INVITE_SID` | Set | N/A | **Aztec only** |
| `TWILIO_WEBHOOK_URL` | Not in Vercel | Set | **Pangaea only** |
| `STAFF_WHATSAPP_NUMBER` | Via LIAM_WHATSAPP_NUMBER | **NOT SET** | **WILL CRASH** |
| `RESEND_API_KEY` | Not set | Not set | **Missing in both** |

### Aztec has 22 env vars. Pangaea has 13. Aztec has 9 extra:
1. `GOOGLE_MAPS_API_KEY`
2. `LIAM_WHATSAPP_NUMBER`
3. `TELEGRAM_NOTIFY_TOKEN`
4. `MICROSOFT_CLIENT_ID`
5. `MICROSOFT_CLIENT_SECRET`
6. `MICROSOFT_TENANT_ID`
7. `AZTEC_STAFF_ALERT_SID`
8. `AZTEC_DOC_EXPIRING_SID`
9. `AZTEC_USER_INVITE_SID`

---

## 6. DATABASE SCHEMA — TABLE BY TABLE

### Tables Present in Both (identical structure)

| Table | Columns | Notes |
|-------|---------|-------|
| `organizations` | id, name, slug, settings, created_at | **Identical** |
| `users` | 14 cols | **Identical** |
| `trade_categories` | 9 cols | **Identical** |
| `sites` | 20 cols | **Identical** |
| `site_managers` | 9 cols | **Identical** |
| `operatives` | 70-93 cols | See differences below |
| `documents` | 16 cols | **Identical** |
| `labour_requests` | 19 cols | **Identical** |
| `allocations` | 27 cols | **Identical** |
| `shifts` | 22 cols | **Identical** |
| `timesheets` | 20 cols | **Identical** |
| `timesheet_entries` | 10 cols | **Identical** |
| `performance_reviews` | 17 cols | **Identical** |
| `non_conformance_incidents` | 21 cols | **Identical** |
| `ncr_comments` | 7 cols | **Identical** |
| `message_threads` | 15 cols | **Identical** |
| `messages` | 14 cols | **Identical** |
| `conversation_sessions` | 12 cols | **Identical** |
| `attendance` | 13 cols | **Identical** |
| `alerts` | 14 cols | **Identical** |
| `site_manager_sessions` | 10 cols | **Identical** |
| `advert_templates` | 14 cols | **Identical** |
| `adverts` | 17 cols | **Identical** |
| `audit_log` | 12 cols | **Identical** |
| `cron_runs` | 5 cols | **Identical** |
| `inbound_dedup` | 3 cols | **Identical** |
| `agencies` | 8 cols | **Identical** |
| `assistant_conversations` | 6 cols | **Identical** |
| `assistant_messages` | 6 cols | **Identical** |
| `assistant_settings` | 6 cols | **Identical** |
| `assistant_tasks` | 12 cols | **Identical** |
| `email_integrations` | 10 cols | **Identical** |
| `email_log` | 9 cols | **Identical** |
| `email_templates` | 6 cols | **Identical** |
| `import_logs` | 11 cols | **Identical** |
| `notifications` | 13 cols | **Identical** |
| `operative_cards` | 10 cols | **Identical** |
| `operative_cscs_cards` | 11 cols | **Identical** |
| `operative_pay_rates` | 14 cols | **Identical** |
| `operative_trades` | 8 cols | **Identical** |
| `short_links` | 5 cols | **Identical** |
| `user_sites` | 5 cols | **Identical** |
| `work_history` | 10 cols | **Identical** |
| `workflow_runs` | 20 cols | **Identical** |
| `workflow_targets` | 14 cols | **Identical** |
| `workflow_events` | 6 cols | **Identical** |

### Schema Differences

| Difference | Aztec | Pangaea |
|------------|-------|---------|
| **Reference prefix** | AZT-XXXX (trigger) | CL-XXXX (trigger) |
| **Migration files** | 16 (00001-00016) | 67 (00001-00067) |
| **Storage bucket** | `operative-documents` public=true | `operative-documents` public=false (private) |
| **RLS granularity** | Basic `org_isolation` on most tables | More granular: role-based policies on operatives, allocations, timesheets (admin/staff full, site_manager scoped, auditor read-only) |
| **Realtime** | Not explicitly configured | `notifications` added to `supabase_realtime` publication |

### Enums Comparison

| Enum | Aztec | Pangaea | Difference |
|------|-------|---------|------------|
| All 24 common enums | Present | Present | **Identical values** |
| `advert_platform` | Present | Present | Same |
| `advert_status` | Present | Same | Same |
| `alert_type` | 11 values | 11 values | Same |
| `allocation_status` | 6 values | 6 values | Same |
| `workflow_run_status` | Present | Present | Same |
| `workflow_target_status` | Present | Present | Same |

### Views — Identical
- `operative_last_worked` — same in both
- `operative_rap_summary` — same in both

### Functions — Identical
All 13+ functions identical in both: `accept_allocation_offer`, `custom_access_token_hook`, `get_user_org_id`, `get_my_org_id`, `get_user_role`, `get_my_site_ids`, `increment_thread_unread`, `increment_targets_completed`, triggers for reference generation, RAP calculation, critical NCR handling, etc.

### Triggers — Identical (11 in both)

---

## 7. API ROUTES — ENDPOINT BY ENDPOINT

### Routes Present in Both (identical)

| Category | Endpoints | Count |
|----------|-----------|-------|
| **Auth** | `/auth/callback` | 1 |
| **Webhooks** | `/api/webhooks/twilio`, `/twilio/status`, `/telegram`, `/telegram-notify` | 4 |
| **Cron** | `compliance-check`, `workflow-processor`, `wtd-check`, `v1/offer-expiry`, `v1/reminders`, `v1/compliance` | 6 |
| **Apply** | `/api/apply/[token]`, `submit-data`, `upload`, `upload-cscs` | 4 |
| **Induction** | `/api/induction/[token]/complete` | 1 |
| **Assistant** | `chat`, `confirm`, `conversations`, `conversations/[id]`, `workflow-status/[runId]` | 5 |
| **Documents** | `[docId]`, `re-extract`, `reject`, `verify` | 4 |
| **Operatives** | `[id]`, `confirm-rate`, `parse-cv`, `revise-rate`, `upload-cv`, `import/parse`, `import/confirm` | 7 |
| **Allocations** | `/api/allocations`, `[id]/send-offer` | 2 |
| **Integrations** | `outlook/auth`, `callback`, `disconnect` | 3 |
| **Reports** | `allocations-csv` | 1 |
| **Security** | `export-trap` | 1 |
| **Timesheets** | `[id]/pdf` | 1 |
| **Adverts** | `generate-copy` | 1 |
| **Short links** | `/r/[code]` | 1 |
| **Total** | | **42** |

### Route Differences

| Route | Aztec | Pangaea | Notes |
|-------|-------|---------|-------|
| `/api/operatives/[id]/onboard` | Not present | Present | Pangaea has onboarding trigger endpoint |

**Verdict: API routes are 99% identical. Pangaea has 1 extra route.**

---

## 8. COMPONENTS — FILE BY FILE

### Component Structure — Identical
Both repos have the exact same component file structure:

- `sidebar.tsx`, `page-header.tsx`, `stats-card.tsx`, `status-badge.tsx`, `confirm-dialog.tsx`, `data-table.tsx`, `empty-state.tsx`, `alerts-bell.tsx`, `realtime-refresh.tsx`
- `activity/activity-feed.tsx`
- `adverts/` (2 files)
- `allocations/` (2 files)
- `assistant/` (11 files + 5 rich renderers)
- `audit-log/` (1 file)
- `comms/` (2 files)
- `documents/` (4 files)
- `ncrs/` (5 files)
- `operatives/` (17 files)
- `requests/` (3 files)
- `settings/` (7 files)
- `sites/` (2 files)
- `timesheets/` (3 files)
- `ui/` (25-27 shadcn primitives)

### Component Differences

| Component | Aztec | Pangaea | Difference |
|-----------|-------|---------|------------|
| **Sidebar branding** | "ALF" logo, "Aztec Construction" | "Pangaea" logo, "Pangea" | Name/logo swap |
| **Login page** | ALF mark + "Aztec Construction" | Pangaea mark + "Pangea -- Built on solid ground" | Branding |
| **Assistant widget** | "ALF" identity | "Rex" identity | Name swap |
| **Login help text** | "Contact Cold Lava to get set up" | "Contact your administrator" | Pangaea is generic |
| **shadcn ui count** | 27 primitives | 25 primitives | Pangaea missing 2 |

---

## 9. LIBRARIES & UTILITIES

### Identical Files
| File | Purpose | Difference |
|------|---------|------------|
| `lib/utils.ts` | `cn()` class merge | **Identical** |
| `lib/pay-rates.ts` | Grade/quartile rate card | **Identical** |
| `lib/cscs-colours.ts` | CSCS card styling | **Identical** |
| `lib/translate.ts` | Claude Haiku translation | **Identical** |
| `lib/collapse-imports.ts` | Import notification collapsing | **Identical** |
| `lib/compliance/can-allocate.ts` | Pre-allocation compliance | **Identical** |
| `lib/export/check-export.ts` | Export permission | **Identical** |
| `lib/import/operative-importer.ts` | CSV import | **Identical** |
| `lib/i18n/apply.ts` | Apply page translations | **Identical** |
| `lib/notifications/create.ts` | Notification + Telegram push | **Identical** |
| `lib/supabase/client.ts` | Browser Supabase client | **Identical** |
| `lib/supabase/server.ts` | Server + service client | **Identical** |
| `lib/auth/get-user-role.ts` | JWT role extraction | **Identical** |
| `lib/auth/types.ts` | UserRole, SupabaseJWT | **Identical** |

### Name-Different Files (same logic)

| Aztec File | Pangaea File | Content Difference |
|------------|-------------|-------------------|
| `lib/whatsapp/sophie-handler.ts` | `lib/whatsapp/amber-handler.ts` | Bot name "Sophie" -> "Amber", company "Aztec Landscapes" -> org name from config |
| `lib/assistant/system-prompt.ts` | `lib/assistant/system-prompt.ts` | "ALF" -> "Rex", "Aztec" -> org-aware |

### Workflow Differences

| Workflow | Aztec | Pangaea |
|----------|-------|---------|
| `document-chase` | Present | Present |
| `data-collection` | Present | Present |
| `job-offer` | Present | Present |
| `profile-completion` | Present | Present |
| `smart-onboarding` | Not present | **Present** |

Pangaea has 5 workflow definitions vs Aztec's 4.

---

## 10. MIDDLEWARE

**Identical logic in both:**
- Public routes bypass: `/login`, `/auth`, `/api/webhooks`, `/api/apply`, `/apply`, `/r/`, `/induction`, `/api/cron`, `/join`, `/briefing`
- Auth check via `supabase.auth.getUser()`
- RBAC: `site_manager` blocked from settings/adverts/comms/operatives/new
- RBAC: `auditor` allowed only dashboard/documents/reports/operatives
- JWT role extraction via `jwt-decode`

**No differences.**

---

## 11. AI ASSISTANTS — SOPHIE/AMBER & ALF/REX

### Intake Bot Comparison

| Aspect | Sophie (Aztec) | Amber (Pangaea) |
|--------|---------------|-----------------|
| **File** | `sophie-handler.ts` | `amber-handler.ts` |
| **Model** | Claude Sonnet 4 (`claude-sonnet-4-6`) | Claude Sonnet 4 (`claude-sonnet-4-6`) |
| **Flow** | 7-step qualification | 7-step qualification (identical) |
| **Steps** | RTW -> Age -> CSCS -> Trade -> Experience -> Name -> Email | RTW -> Age -> CSCS -> Trade -> Experience -> Name -> Email |
| **Circuit breaker** | 3 failures, 60s cooldown | 3 failures, 60s cooldown |
| **Company name** | Hardcoded "Aztec Landscapes" | Dynamic from org config |
| **Creates operative** | Yes + upload link | Yes + upload link |

### Dashboard Assistant Comparison

| Aspect | ALF (Aztec) | Rex (Pangaea) |
|--------|-------------|---------------|
| **File** | `lib/assistant/system-prompt.ts` | `lib/assistant/system-prompt.ts` |
| **Model** | Claude Sonnet 4 (`claude-sonnet-4-6`) | Claude Sonnet 4 (`claude-sonnet-4-6`) |
| **Streaming** | SSE | SSE |
| **Tools** | 10 tool definitions | 12 tool definitions |
| **Feature flags** | From `assistant_settings` table | From `assistant_settings` table |
| **Rich cards** | 5 renderers (data-table, missing-fields, operative-table, stats-grid, workflow-status) | 5 renderers (identical) |
| **Identity** | "ALF" - Aztec Labour Force | "Rex" - Pangaea assistant |
| **System prompt** | Aztec-specific principles | Principles-first architecture, org-aware |

### Rex has 2 extra tools vs ALF:
- `tasks` tool
- `workflows` tool (direct workflow orchestration)

---

## 12. WHATSAPP / TWILIO — COMPLETE COMPARISON

### Account Structure

| Aspect | Aztec | Pangaea |
|--------|-------|---------|
| **Account SID** | `[REDACTED-AZTEC-SID]` | `[REDACTED-PANGAEA-SID]` |
| **Account type** | **Primary/full account** | **Subaccount OF Aztec** |
| **Auth Token** | `[REDACTED]` | `[REDACTED]` |
| **Account name** | "My first Twilio account" | "Pangea" |
| **Balance** | GBP 23.35 | On parent (Aztec) |
| **Created** | 2025-07-16 | 2026-03-13 |

### Phone Numbers

| Aspect | Aztec | Pangaea |
|--------|-------|---------|
| **WhatsApp number** | +447414157366 | +447723325497 |
| **Number SID** | `PN65caf5a67befd31391b0e81facb5006c` | `PNa77af075b5d043b96be2b5c65ed6a9e6` |
| **Friendly name** | "AZTEC - TEST" | "+447723325497" |
| **SMS webhook** | `aztec-landscapes-bos.vercel.app/api/webhooks/twilio` | `pangaea-demo.vercel.app/api/webhooks/twilio` |
| **Total numbers on account** | 12 | 1 |
| **Other numbers** | VAPI, Retell, Solar BOS, Subvert, staging, dashboard test | None |

### Messaging Services

| Aspect | Aztec | Pangaea |
|--------|-------|---------|
| **Service SID** | `MGe162a92fff5765d3dad1cee8ea73d064` | `MG03817d08ea73081b4ae78b8eb29bc5e8` |
| **Name** | "Aztec Landscapes" | "Pangea" |
| **Inbound URL** | `aztec-landscapes-bos.vercel.app/api/webhooks/twilio` | `pangea-bos.vercel.app/api/webhooks/twilio` |
| **Status callback** | Not set at service level | `pangea-bos.vercel.app/api/webhooks/twilio/status` |
| **use_inbound_webhook_on_number** | false | false |

**PANGAEA ISSUE:** Messaging Service webhook points to `pangea-bos.vercel.app` which is NOT the live URL (`pangaea-demo.vercel.app`). This may cause webhook routing failures.

### Content Templates

| Template | Aztec SID | Aztec Status | Pangaea SID | Pangaea Status |
|----------|-----------|-------------|-------------|----------------|
| `DOC_VERIFIED` | `HX0e9a46d6...` | **APPROVED** | Same SID in code | **MISSING** |
| `DOC_REJECTED` | `HX66ad4bb3...` | **APPROVED** | Same SID in code | **MISSING** |
| `WELCOME_VERIFIED` | `HXf24bcc23...` | **APPROVED** | Same SID in code | **MISSING** |
| `JOB_OFFER` | `HX27452fce...` | **APPROVED** | Same SID in code | **MISSING** |
| `DOC_CHASE` | `HX96e82100...` | **APPROVED** | Same SID in code | **MISSING** |
| `DOC_REMINDER` | `HX02ee37ca...` | **APPROVED** | Same SID in code | **MISSING** |
| `DATA_REQUEST` | `HXaded45da...` | **APPROVED** | Same SID in code | **MISSING** |
| `USER_INVITE` | `HX877e076c...` | **APPROVED** | Same SID in code | **MISSING** |
| `DOC_EXPIRING` | `HXdd0da062...` | **APPROVED** | Same SID in code | **MISSING** |
| `PROFILE_COMPLETION` | `HX21c57d71...` | **APPROVED** | Same SID in code | **MISSING** |
| `RE_ENGAGE` | `HX0f58bfdb...` | **APPROVED** | `HXe2b377f4...` (different!) | **APPROVED** |
| `RE_ENGAGE_FOLLOW_UP` | `HX5eb9b502...` | **APPROVED** | Same SID in code | **MISSING** |
| `JOB_OFFER_REMINDER` | `HX82f56a16...` | **APPROVED** | Same SID in code | **MISSING** |
| `STAFF_ALERT` | `HXae65312c...` | **UNSUBMITTED** | Same SID in code | **MISSING** |

**CRITICAL: Pangaea's code contains 13 Aztec template SIDs that DON'T EXIST on the Pangaea subaccount. Only RE_ENGAGE has its own Pangaea-specific SID. All other template sends will FAIL.**

### Code Architecture — Identical Issues

Both codebases have:
- **Duplicate `sendWhatsAppTemplate` functions** (one in `send.ts`, one in `templates.ts`)
- **No statusCallback on template sends** (delivery not tracked)
- **Send-offer route bypasses SDK** (uses raw `fetch()`)
- **No language variant templates** (all TODOs)
- **Smart send with 24h window** (identical logic)
- **Deferred message queue** (identical logic)

---

## 13. TELEGRAM BOTS

| Aspect | Aztec | Pangaea |
|--------|-------|---------|
| **Site manager bot** | @AztecSiteBot | @PangaeaSiteBot |
| **Bot token env** | `TELEGRAM_BOT_TOKEN` | `TELEGRAM_BOT_TOKEN` |
| **Webhook secret** | `aztec-tg-sm-2026` | `pangaea-tg-sm-2026` |
| **Commands** | Mark Arrived, Log NCR, Rate Operative, Request Labour, Finish Operative | Identical commands |
| **Notify bot** | @AlfNotificationsBot | @RexNotifyBot |
| **Notify token env** | `TELEGRAM_NOTIFY_TOKEN` | `TELEGRAM_NOTIFY_TOKEN` |
| **Notify commands** | Unread, Recent, NCRs, Requests, Status, Mark read | Identical commands |
| **Code files** | `lib/telegram/send.ts`, `send-notify.ts`, `site-manager-handler.ts` | Identical file structure |

**Identical functionality, different bot identities.**

---

## 14. WORKFLOWS

| Workflow | Aztec | Pangaea | Difference |
|----------|-------|---------|------------|
| `document_chase` | Present | Present | Identical |
| `data_collection` | Present | Present | Identical |
| `job_offer` | Present | Present | Identical |
| `profile_completion` | Present | Present | Identical |
| `smart_onboarding` | **Not present** | **Present** | Pangaea-only |

### Workflow Engine — Identical
- `engine.ts` — same triggerWorkflow, processInbound, processUpload, processFollowUps, processDataSubmission
- `types.ts` — same WorkflowDefinition interface with 6 lifecycle hooks
- `registry.ts` — Pangaea maps 5 types, Aztec maps 4
- `engagement.ts` — same 24h window check + initiateEngagement

### Smart Onboarding (Pangaea only)
- Combined onboarding workflow that uses Amber handler
- Not present in Aztec codebase

---

## 15. SUPABASE — FULL SCHEMA DIFF

| Aspect | Aztec | Pangaea |
|--------|-------|---------|
| **Project ID** | `ybfhkcvrzbgzrayjskfp` | `xmmigscmuohcjwkmqvwi` |
| **Region** | Frankfurt (assumed) | London |
| **Tables** | ~39 + 2 views | ~40 + 2 views |
| **Enums** | 27 | 24 |
| **Functions** | 13+ | 13+ (identical) |
| **Triggers** | 11 | 11 (identical) |
| **Sequences** | 2 (operative_ref_seq, ncr_ref_seq) | 2 (same) |
| **Extensions** | uuid-ossp, unaccent, pg_trgm | uuid-ossp, unaccent, pg_trgm |
| **Storage** | `operative-documents` (public) | `operative-documents` (private) |
| **Realtime** | Not configured | `notifications` published |
| **Reference prefix** | AZT-XXXX | CL-XXXX |
| **Migration count** | 16 files | 67 files |

### RLS Differences

| Table | Aztec RLS | Pangaea RLS |
|-------|-----------|-------------|
| `operatives` | Basic `org_isolation` | **Granular**: admin/staff full, site_manager scoped to sites, auditor read-only |
| `allocations` | Basic `org_isolation` | **Granular**: admin/staff full, site_manager scoped, auditor read-only |
| `timesheets` | Basic `org_isolation` | **Granular**: admin/staff full, site_manager scoped, auditor read-only |
| `user_sites` | Basic | **Granular**: admin manage, users read own |
| All others | `org_isolation` | `org_isolation` (same) |

**Pangaea has more mature RLS policies** — likely because it has 67 migrations vs 16, meaning the schema evolved further.

---

## 16. VERCEL — FULL CONFIG DIFF

| Aspect | Aztec | Pangaea |
|--------|-------|---------|
| **Project name** | `aztec-bos` | `pangaea-demo` |
| **Project ID** | `prj_ccxAw94w8HIeiK8l8R5m6jA44sDg` | `prj_udFubVIsaVLRg1v4pv81hf4N0agg` |
| **Team** | `olivers-projects-a3cbd2e0` | `olivers-projects-a3cbd2e0` (same!) |
| **GitHub repo** | `Aztec-Landscapes/aztec-bos` | `coldlavaai/pangaea-demo` |
| **Framework** | Next.js 15 (auto-detected) | Next.js 15 (auto-detected) |
| **Build command** | `npm run build` | `npm run build` |
| **Build machine** | 4 cores, 8GB RAM | 4 cores, 8GB RAM |
| **Build region** | iad1 (US East) | iad1 (US East) |
| **Function region** | iad1 (US East) | iad1 + sin1 (US East + Singapore) |
| **Build duration** | ~1 min | ~1 min |
| **Custom domains** | None (4 .vercel.app aliases) | None (3 .vercel.app aliases) |
| **Env vars (prod)** | 22 | 13 |
| **Env vars (preview)** | 0 | 0 |
| **Env vars (dev)** | 0 | 0 |
| **Cron jobs** | 5 | 5 (identical) |
| **Function overrides** | 4 | 4 (identical) |
| **Auto-deploy** | Yes, from main | Yes, from main |

### Both Missing:
- Preview/dev environment variables
- Custom domain
- `RESEND_API_KEY`
- Redirects/rewrites in vercel.json
- Custom Next.js config

---

## 17. LIVE APP SCAN COMPARISON

| Aspect | Aztec | Pangaea |
|--------|-------|---------|
| **Title** | "AZTEC BOS" | "Pangaea" |
| **Description** | "AZTEC Landscapes Business Operating System" | "Pangaea -- Workforce Management Platform" |
| **Login branding** | ALF mark + "Aztec Construction" | Pangaea mark + "Pangea -- Built on solid ground" |
| **Login help** | "Contact Cold Lava to get set up" | "Contact your administrator" |
| **Favicon** | `/alf-mark.png?v=3` | `/pangaea-mark.png?v=3` |
| **`/briefing` public?** | **YES** | **YES** |
| **robots.txt** | Missing (404) | Missing (404) |
| **sitemap.xml** | Missing (404) | Missing (404) |
| **manifest.json** | Missing (404) | Missing (404) |
| **HSTS** | 2 years + preload | 2 years + preload |
| **CSP header** | Missing | Missing |
| **X-Frame-Options** | Missing | Missing |
| **X-Content-Type-Options** | Missing | Missing |
| **Auth on dashboard routes** | 307 -> /login | 307 -> /login |
| **Cron auth** | 401 Unauthorized | 401 Unauthorized |
| **Webhook validation** | Twilio signature check (403) | Twilio signature check (403) |
| **Status webhook validation** | **None** (accepts all) | **None** (accepts all) |
| **Telegram-notify validation** | **None** | **None** |

---

## 18. SECURITY COMPARISON

| Security Aspect | Aztec | Pangaea | Rating |
|----------------|-------|---------|--------|
| HSTS | 2yr + preload | 2yr + preload | Good |
| CSP header | Missing | Missing | Bad |
| X-Frame-Options | Missing | Missing | Bad |
| X-Content-Type-Options | Missing | Missing | Bad |
| Referrer-Policy | Missing | Missing | Bad |
| Auth middleware | Solid | Solid | Good |
| Cron secret | Protected | Protected | Good |
| Twilio signature validation | Yes (inbound) | Yes (inbound) | Good |
| Status callback validation | **None** | **None** | Medium risk |
| Telegram notify validation | **None** | **None** | Medium risk |
| `/briefing` public exposure | **YES** - reveals architecture | **YES** - reveals architecture | Bad |
| robots.txt | Missing | Missing | Medium |
| Supabase anon key in JS | Yes (expected) | Yes (expected) | Normal |
| RLS | Basic org_isolation | **Better** - role-based policies | Pangaea better |
| Storage bucket | **Public** (anyone can read) | **Private** (auth required) | Pangaea better |
| `x-powered-by: Next.js` | Exposed | Not exposed | Aztec slightly worse |

---

## 19. BRANDING & STYLING

| Aspect | Aztec | Pangaea |
|--------|-------|---------|
| **Theme mode** | Dark only | Dark only |
| **CSS framework** | Tailwind CSS 4 | Tailwind CSS 4 |
| **Component lib** | shadcn/ui new-york | shadcn/ui new-york |
| **Icons** | Lucide React | Lucide React |
| **Toasts** | Sonner (bottom-right, dark) | Sonner (bottom-right, dark) |
| **Animations** | tw-animate-css | tw-animate-css |
| **Color space** | oklch | oklch |
| **Primary color** | Neutral (no custom palette) | **Forest green** (#2D6A4F / #52B788) |
| **Accent color** | None | **Copper** (#C17F59) |
| **Body font** | Geist Sans | **DM Sans** |
| **Display font** | Geist Sans | **DM Serif Display** |
| **Mono font** | Geist Mono | **JetBrains Mono** |
| **Sidebar bg** | Default dark | **Deep forest green** (#0B2118) |
| **Status colors** | Default | Custom: ready=#2D6A4F, verifying=#E09F3E, danger=#D62828 |
| **Logo files** | `alf-logo.png/svg`, `alf-mark.png/svg` | `pangaea-mark.png`, `pangaea-logo-tagline.png` |

---

## 20. CRITICAL ISSUES FOUND

### BOTH SYSTEMS

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 1 | `/briefing` publicly accessible | **HIGH** | Exposes full architecture, roadmap, pricing, bot details to anyone |
| 2 | Missing security headers | **MEDIUM** | No CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| 3 | No robots.txt | **LOW** | Search engines could index login page |
| 4 | Status callback no validation | **LOW** | `/api/webhooks/twilio/status` accepts any POST |
| 5 | Telegram notify no validation | **LOW** | `/api/webhooks/telegram-notify` accepts any POST |
| 6 | No preview/dev env vars | **MEDIUM** | Preview deployments will fail |
| 7 | Missing `RESEND_API_KEY` | **LOW** | Email fallback won't work |
| 8 | Duplicate `sendWhatsAppTemplate` | **MEDIUM** | Two implementations in different files |
| 9 | No statusCallback on templates | **MEDIUM** | Template delivery not tracked |
| 10 | No language variant templates | **LOW** | Non-English operatives get English templates |
| 11 | US East region | **MEDIUM** | UK companies, data in US — latency + GDPR? |

### PANGAEA ONLY

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 12 | **13/14 template SIDs invalid** | **CRITICAL** | Copied from Aztec, don't exist on Pangaea subaccount |
| 13 | **`STAFF_WHATSAPP_NUMBER` not set** | **CRITICAL** | Will crash when operative accepts/declines offer |
| 14 | **Webhook URL mismatch** | **HIGH** | Messaging Service -> `pangea-bos.vercel.app`, app -> `pangaea-demo.vercel.app` |
| 15 | Missing env vars (9 fewer than Aztec) | **HIGH** | No Google Maps, no MS OAuth, no template SID env vars, no Telegram notify |
| 16 | `.env.local` all placeholders | **MEDIUM** | Local dev impossible |

### AZTEC ONLY

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 17 | `STAFF_ALERT` template unsubmitted | **MEDIUM** | Never sent for Meta approval, silently does nothing |
| 18 | `AZTEC_DOC_EXPIRING_SID` uses `!` assertion | **HIGH** | Will crash if env var missing |
| 19 | Storage bucket is public | **MEDIUM** | Anyone with URL can read uploaded documents |
| 20 | Solar BOS number in messaging service | **LOW** | +447480486658 shouldn't be in Aztec service |
| 21 | Account name "My first Twilio account" | **LOW** | Should be renamed |

---

## FINAL VERDICT

**Pangaea is a white-label clone of Aztec BOS.** The codebase was duplicated today (2026-03-13) with branding swapped (ALF->Rex, Sophie->Amber, Aztec->Pangaea). The core architecture, database schema, API routes, components, and business logic are **99% identical**.

Key improvements in Pangaea over Aztec:
- More mature RLS policies (role-based, not just org isolation)
- Private storage bucket (Aztec's is public)
- More migrations (67 vs 16 — cleaner schema evolution)
- 5th workflow (smart_onboarding)
- Dedicated onboarding API route
- Generic branding ("Contact your administrator" vs "Contact Cold Lava")
- Custom color scheme (forest green + copper vs neutral)

Key things Pangaea is missing vs Aztec:
- 13 of 14 WhatsApp templates (only RE_ENGAGE exists)
- 9 fewer Vercel env vars
- No Microsoft/Outlook OAuth configured
- No Google Maps API
- No Telegram notify bot token
- `STAFF_WHATSAPP_NUMBER` will cause crashes
- Webhook URL mismatch with Twilio

**To make Pangaea production-ready, you need to:**
1. Create all 13 missing WhatsApp templates on the Pangaea Twilio subaccount
2. Set the 9 missing env vars in Vercel
3. Fix the webhook URL mismatch (Messaging Service points to wrong domain)
4. Set `STAFF_WHATSAPP_NUMBER` to prevent crashes
5. Protect `/briefing` behind auth
6. Add security headers
7. Consider moving to London region (lhr1) for latency
