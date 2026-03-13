# Pangaea Demo — Handoff Notes for JJ

**Date:** 13 March 2026
**Status:** Live and functional, test account ready

---

## Quick Links

| What | URL |
|------|-----|
| **Dashboard** | https://pangaea-demo.vercel.app |
| **Pitch Site** | https://pangea-pitch.vercel.app |
| **GitHub (BOS)** | https://github.com/coldlavaai/pangaea-demo |
| **GitHub (Pitch)** | https://github.com/coldlavaai/pangea-pitch |
| **Supabase** | https://supabase.com/dashboard/project/xmmigscmuohcjwkmqvwi |

---

## Login

- **Email:** oliver@coldlava.ai
- **Password:** (ask Oliver — set during Supabase user creation)
- **Organisation:** Cold Lava Construction

### To create your own test account:
1. Go to Supabase → Authentication → Users → Add User
2. Use any email/password, tick "Auto Confirm"
3. The trigger auto-creates a `public.users` row linked to "Cold Lava Construction" org
4. Log in at https://pangaea-demo.vercel.app/login

---

## What's Working

- Full dashboard with Pangaea branding (forest green + copper)
- Operative CRUD (add, edit, view operatives)
- Sites, Allocations, Labour Requests, NCRs, Timesheets
- Rex AI assistant (needs Anthropic API key — already set in Vercel)
- Trade categories (20 construction trades)
- Reference numbers auto-generate as CL-0001, CL-0002, etc.
- RAP scoring system
- Document management
- Compliance tracking
- Audit log

---

## What's Set Up But Needs Testing

- **WhatsApp (Amber intake):** Twilio configured (number: +447723325497), webhook set to pangaea-demo.vercel.app. Send a WhatsApp to this number to trigger the Amber onboarding flow.
- **Rex assistant:** Anthropic key is set. Open Rex from the sidebar and ask it questions about operatives.
- **Workflow engine:** Document chase, data collection, profile completion, job offer workflows are all in the codebase.

---

## What's NOT Set Up Yet

- **Telegram bots** — need @PangaeaSiteBot and @RexNotifyBot created via BotFather
- **STAFF_WHATSAPP_NUMBER** — env var for staff notifications (set to a real number in Vercel)
- **Demo seed data** — no fake operatives yet. Oliver is adding himself as first test operative.
- **Supabase types regeneration** — some `as any` casts in code due to new tables not in TypeScript types

---

## Twilio Details (Pangea Subaccount)

- **Account SID:** See Twilio console (Pangea subaccount)
- **Auth Token:** See Twilio console
- **WhatsApp Number:** +447723325497
- **Webhook URL:** https://pangaea-demo.vercel.app/api/webhooks/twilio

---

## To Deploy Changes

```bash
cd ~/pangaea-demo
git add -A && git commit -m "description" && git push origin main
vercel --prod
vercel alias <deployment-url> pangaea-demo.vercel.app
```

Git author must be: `Oliver Tatler / otatler@gmail.com`

---

## Brand Guidelines

See `/docs/brand-guidelines.html` and `/docs/BRAND_GUIDELINES.md` in the repo.

- **Primary:** Forest green (#1B4332 nav, #2D6A4F actions)
- **Accent:** Copper (#C17F59) — CTAs, highlights, sparingly
- **Fonts:** DM Serif Display (brand name only), DM Sans (everything else), JetBrains Mono (data)
- **Assistant:** Rex | **Onboarding bot:** Amber
- **Tagline:** "Built on solid ground"
- **Voice:** Direct. No waffle. Construction people don't have time for it.
