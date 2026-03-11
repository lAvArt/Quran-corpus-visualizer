# Deployment Guide

This project is a Next.js application deployed on Vercel backed by a Supabase PostgreSQL database.

## Prerequisites

- A [Vercel](https://vercel.com) account with GitHub repo access
- A [Supabase](https://supabase.com) project (free tier works)
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed (for running migrations)

---

## 1. Supabase Database Setup

### Apply migrations

```bash
# Link the CLI to your Supabase project (run once)
supabase link --project-ref <your-project-ref>

# Push all migrations (001 – 006)
supabase db push
```

Alternatively, paste each file from `supabase/migrations/` into the [Supabase Dashboard](https://supabase.com/dashboard) → SQL Editor, in order (`001` → `006`).

### (Optional) Seed the corpus

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
npx tsx scripts/seed-corpus.ts
```

### (Optional) Generate vector embeddings

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
OPENAI_API_KEY=sk-... \
npx tsx scripts/generate-embeddings.ts
```

---

## 2. Environment Variables

Set these in **Vercel Dashboard → Project → Settings → Environment Variables**.

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Your Supabase project URL (`https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key — safe to expose client-side |
| `BREVO_API_KEY` | Optional | Brevo transactional email key (feedback form) |
| `FEEDBACK_TO_EMAIL` | Optional | Recipient address for feedback submissions |
| `FEEDBACK_FROM_EMAIL` | Optional | Verified sender address in Brevo |
| `FEEDBACK_FROM_NAME` | Optional | Sender display name (default: `Quran Corpus Visualizer`) |

> ⚠️ **Never set `SUPABASE_SERVICE_ROLE_KEY` in Vercel for the app deployment.** It bypasses Row Level Security and is only intended for local admin scripts (`seed-corpus.ts`, `generate-embeddings.ts`).

---

## 3. Vercel Deployment

1. Push your latest code to GitHub.
2. Go to [Vercel Dashboard](https://vercel.com/dashboard) → **Add New…** → **Project**.
3. Import the `quran-corpus-visualizer` repository.
4. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./`
   - **Build Command**: `next build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`
5. Add all required environment variables (see above).
6. Click **Deploy**.

---

## 4. Post-Deployment Verification

1. **Initial Load** — UI loads immediately.
2. **Supabase connectivity** — Search for any Arabic root; results should return from the database.
3. **Auth** — Sign in and confirm tracked roots persist across sessions.
4. **Console** — Check the browser console for unexpected Supabase or network errors.
5. **Caching** — Refresh after initial load; second load should be significantly faster (IndexedDB).
