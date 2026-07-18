/**
 * Push branded email templates to Supabase via the Management API.
 *
 * Usage:
 *   dotenv -e .env.local -- tsx scripts/push-email-templates.ts
 *
 * Required env vars:
 *   SUPABASE_MANAGEMENT_TOKEN   – Personal access token (sbp_…)
 *   NEXT_PUBLIC_SUPABASE_URL    – e.g. https://<ref>.supabase.co
 */

import * as fs from 'fs';
import * as path from 'path';

const MANAGEMENT_TOKEN = process.env.SUPABASE_MANAGEMENT_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!MANAGEMENT_TOKEN) {
    console.error('❌  SUPABASE_MANAGEMENT_TOKEN is not set in .env.local');
    process.exit(1);
}
if (!SUPABASE_URL) {
    console.error('❌  NEXT_PUBLIC_SUPABASE_URL is not set in .env.local');
    process.exit(1);
}

// Extract project ref from URL: https://<ref>.supabase.co
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
if (!projectRef) {
    console.error('❌  Could not extract project ref from NEXT_PUBLIC_SUPABASE_URL');
    process.exit(1);
}

const TEMPLATES_DIR = path.join(process.cwd(), 'supabase', 'templates');

// Must match lib/config/appIdentity.ts — the marker this app stamps into
// signup metadata (options.data.app). The templates branch on it.
const APP_ID = 'quran-observatory';

function readTemplate(filename: string): string {
    return fs.readFileSync(path.join(TEMPLATES_DIR, filename), 'utf-8');
}

/**
 * The Supabase project is SHARED across Pluragate apps and its email
 * templates are project-global. Every subject/body below therefore branches
 * on the app marker: our stamped signups get the Quran-Observatory-branded
 * content; anything unstamped (sibling apps, admin invites) falls through to
 * a neutral Pluragate default. Go-template conditionals are supported in
 * both subjects and bodies.
 */
function brandedSubject(quranSubject: string, genericSubject: string): string {
    return `{{ if eq .Data.app "${APP_ID}" }}${quranSubject}{{ else }}${genericSubject}{{ end }}`;
}

/** Neutral org-level fallback body for unstamped users. */
function genericBody(heading: string, buttonLabel: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background-color:#f4f4f6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f4f4f6">
    <tr><td align="center" style="padding:48px 20px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:12px;max-width:560px;width:100%;box-shadow:0 2px 12px rgba(20,22,28,0.08);">
        <tr><td style="padding:28px 40px 22px;border-bottom:1px solid rgba(20,22,28,0.08);">
          <p style="margin:0;font-size:18px;font-weight:700;color:#14161c;letter-spacing:0.02em;">Pluragate</p>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <h1 style="margin:0 0 12px;font-size:20px;color:#14161c;">${heading}</h1>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:rgba(20,22,28,0.7);">Use the button below to continue. If you did not request this email, you can safely ignore it.</p>
          <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#14161c;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">${buttonLabel}</a>
        </td></tr>
        <tr><td style="padding:18px 40px 26px;border-top:1px solid rgba(20,22,28,0.08);">
          <p style="margin:0;font-size:12px;color:rgba(20,22,28,0.45);">Pluragate</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function brandedBody(quranHtml: string, heading: string, buttonLabel: string): string {
    return `{{ if eq .Data.app "${APP_ID}" }}${quranHtml}{{ else }}${genericBody(heading, buttonLabel)}{{ end }}`;
}

async function patchAuth(label: string, body: Record<string, string>) {
    const res = await fetch(
        `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
        {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${MANAGEMENT_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        }
    );
    if (!res.ok) {
        const text = await res.text();
        console.error(`  ❌  ${label} — HTTP ${res.status}: ${text}`);
        return false;
    }
    console.log(`  ✅  ${label}`);
    return true;
}

async function pushTemplates() {
    console.log(`\n📧  Pushing email templates to Supabase project: ${projectRef}\n`);

    // NOTE — deliberately NOT touching site_url: this Supabase project is
    // shared across Pluragate apps and site_url belongs to a sibling app.
    // Our flows always pass an explicit redirectTo, so we never depend on it.

    // Subjects: per-app conditional (unstamped users get the generic line).
    await patchAuth('subjects', {
        mailer_subjects_confirmation: brandedSubject('Verify your email — Quran Observatory', 'Verify your email — Pluragate'),
        mailer_subjects_recovery: brandedSubject('Reset your password — Quran Observatory', 'Reset your password — Pluragate'),
        mailer_subjects_magic_link: brandedSubject('Your sign-in link — Quran Observatory', 'Your sign-in link — Pluragate'),
        mailer_subjects_invite: brandedSubject("You've been invited — Quran Observatory", "You've been invited — Pluragate"),
        mailer_subjects_email_change: brandedSubject('Confirm your new email — Quran Observatory', 'Confirm your new email — Pluragate'),
        mailer_subjects_reauthentication: brandedSubject('Confirm reauthentication — Quran Observatory', 'Confirm reauthentication — Pluragate'),
    });

    // Bodies: quran-branded file for stamped users, neutral Pluragate
    // fallback otherwise. Pushed individually to surface any blocked-keyword
    // failures per template.
    const templates: Array<[string, string, string, string, string]> = [
        ['confirmation',     'mailer_templates_confirmation_content',     'confirmation.html',     'Verify your email',        'Verify email'],
        ['recovery',         'mailer_templates_recovery_content',         'recovery.html',         'Reset your password',      'Reset password'],
        ['magic-link',       'mailer_templates_magic_link_content',       'magic-link.html',       'Your sign-in link',        'Sign in'],
        ['invite',           'mailer_templates_invite_content',           'invite.html',           "You've been invited",      'Accept invite'],
        ['email-change',     'mailer_templates_email_change_content',     'email-change.html',     'Confirm your new email',   'Confirm email change'],
        ['reauthentication', 'mailer_templates_reauthentication_content', 'reauthentication.html', 'Confirm reauthentication', 'Confirm'],
    ];

    for (const [label, field, file, heading, buttonLabel] of templates) {
        await patchAuth(label, { [field]: brandedBody(readTemplate(file), heading, buttonLabel) });
    }

    console.log('\nDone.\n');
}

pushTemplates().catch(err => {
    console.error('❌  Unexpected error:', err);
    process.exit(1);
});
