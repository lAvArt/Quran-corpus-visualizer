# Deployment Guide

Quran Corpus Visualizer is deployed as a Next.js app on Vercel with Supabase as the primary database and auth backend.

## Prerequisites

- Vercel project access
- Supabase project access
- Supabase CLI for migrations

## 1. Supabase Setup

### Apply migrations

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

The current migration set is `001` through `007`, including `tracked_roots`, security hardening, and `quiz_attempts`.

If you are applying SQL manually in the dashboard, apply the files in order from `supabase/migrations/001_extensions.sql` through `supabase/migrations/007_quiz_attempts.sql`.

### Optional corpus seed

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
npm run db:seed
```

### Optional embedding generation

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
OPENAI_API_KEY=sk-... \
npx tsx scripts/generate-embeddings.ts
```

## 2. Environment Variables

Configure these in Vercel for the app deployment.

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key |
| `BREVO_API_KEY` | No | Feedback email delivery |
| `FEEDBACK_TO_EMAIL` | No | Feedback recipient |
| `FEEDBACK_FROM_EMAIL` | No | Verified sender address |
| `FEEDBACK_FROM_NAME` | No | Sender label |
| `NEXT_PUBLIC_FEEDBACK_EMAIL` | No | Fallback public feedback email |
| `OPENAI_API_KEY` | No | Semantic search or image-assisted helpers |
| `OPENAI_VISION_MODEL` | No | Vision model override for image root extraction |
| `SEMANTIC_SEARCH_RATE_LIMIT_MAX` | No | Per-instance search limit |
| `SEMANTIC_SEARCH_RATE_LIMIT_WINDOW_MS` | No | Search rate-limit window |
| `IMAGE_ROOT_RATE_LIMIT_MAX` | No | Image route limit |
| `IMAGE_ROOT_RATE_LIMIT_WINDOW_MS` | No | Image route rate-limit window |

Do not deploy `SUPABASE_SERVICE_ROLE_KEY` to Vercel. It is only for local or controlled admin scripts.

## 3. Supabase Auth Configuration

If you use auth flows in production, configure the following in Supabase Auth:

- Site URL: `https://<your-domain>`
- Redirect URL: `https://<your-domain>/auth/callback`

If you serve localized auth entry points, the callback still resolves through `/auth/callback`.

## 4. Vercel Deployment

1. Import the repository into Vercel.
2. Use the default Next.js framework preset.
3. Keep the root directory at the repository root.
4. Add the environment variables listed above.
5. Deploy.

## 5. Post-Deployment Verification

Run these checks against the deployed environment:

1. Explore loads with shell-ready content before deep corpus loading finishes.
2. Search returns usable results and degraded states are readable.
3. Study loads for signed-in users and tracked roots sync correctly.
4. Quiz loads, local progress records save, and authenticated quiz history syncs to `quiz_attempts`.
5. Auth flows complete through `/auth/callback`.
6. Feedback submission works if Brevo variables are configured.
7. Browser console and server logs show no unexpected Supabase, search, or hydration errors.

Use [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md) for the full release pass.
