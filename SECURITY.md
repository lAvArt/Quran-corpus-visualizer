# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 0.5.x   | :white_check_mark: Current |
| 0.4.x   | :white_check_mark: |
| 0.3.x   | :warning: End of life |
| < 0.3   | :x:                |

## Database Security

All data access is enforced through Supabase Row Level Security (RLS):

- **`corpus_tokens`, `ayahs`, `root_embeddings`** — public read-only; `anon` and `authenticated` roles have `SELECT` only; `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, and `TRIGGER` are revoked.
- **`tracked_roots`** — RLS policy requires `auth.uid() = user_id`; authenticated users may only read and write their own rows; `anon` has `SELECT` only; `TRUNCATE` is revoked from both roles.
- **Database functions** — all functions use `SET search_path = public, pg_catalog` to prevent search_path-based injection.
- **`SUPABASE_SERVICE_ROLE_KEY`** — used only in local admin scripts; never sent to the browser or deployed to Vercel.
- **`refresh_corpus_views()`** — `EXECUTE` revoked from `PUBLIC`; only `service_role` may call it.

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, email: **info@pluragate.org**

Include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Fix/Patch**: Depending on severity, typically within 2 weeks

## Scope

This policy covers:

- The web application at [quran.pluragate.org](https://quran.pluragate.org)
- The source code in this repository
- Supabase database configuration (RLS policies, functions, privilege grants)
- Dependencies used by this project

## Out of Scope

- The upstream [Quranic Arabic Corpus](https://corpus.quran.com) API
- Third-party infrastructure (Vercel, Brevo, Supabase platform)

Thank you for helping keep this project and its users safe.
