# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| 0.5.x | Yes |
| 0.4.x | Limited |
| < 0.4 | No |

## Database Security

Supabase Row Level Security and explicit privilege controls are used to protect both corpus data and user state.

- `corpus_tokens`, `ayahs`, and `root_embeddings` are public read-only surfaces for `anon` and `authenticated` roles.
- `tracked_roots` uses an `auth.uid() = user_id` RLS policy for all operations. Anonymous callers cannot satisfy the policy. `TRUNCATE` is revoked from end-user roles.
- `quiz_attempts` uses the same per-user RLS pattern for synced quiz history.
- Materialized views (`collocations`, `cross_references`) are exposed through explicit read grants because PostgreSQL does not apply RLS to materialized views.
- Database functions use `SET search_path = public, pg_catalog` to reduce search-path injection risk.
- `refresh_corpus_views()` is restricted to `service_role`.
- `SUPABASE_SERVICE_ROLE_KEY` is only intended for controlled scripts such as seeding and embedding generation. It must never be shipped to the browser.

## Reporting a Vulnerability

Do not open a public GitHub issue for a security vulnerability.

Report it by email to `info@pluragate.org` with:

- a description of the issue
- reproduction steps
- likely impact
- suggested remediation, if known

## Response Timeline

- Acknowledgment: within 48 hours
- Initial assessment: within 1 week
- Fix timeline: based on severity

## Scope

This policy covers:

- the application at `quranobservatory.org`
- the source code in this repository
- Supabase schema, RLS policies, and function exposure
- deployed dependencies under this app's control

## Out of Scope

- upstream Quranic Arabic Corpus infrastructure
- Vercel, Supabase platform, or Brevo platform vulnerabilities unrelated to this app's configuration

Thank you for reporting issues responsibly.
