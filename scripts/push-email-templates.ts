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

function readTemplate(filename: string): string {
    return fs.readFileSync(path.join(TEMPLATES_DIR, filename), 'utf-8');
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

    // Fix site_url to production first
    await patchAuth('site_url → https://quran.pluragate.org', {
        site_url: 'https://quran.pluragate.org',
    });

    // Push subjects
    await patchAuth('subjects', {
        mailer_subjects_confirmation: 'Verify your email — Quran Corpus Visualizer',
        mailer_subjects_recovery: 'Reset your password — Quran Corpus Visualizer',
        mailer_subjects_magic_link: 'Your sign-in link — Quran Corpus Visualizer',
        mailer_subjects_invite: "You've been invited — Quran Corpus Visualizer",
        mailer_subjects_email_change: 'Confirm your new email — Quran Corpus Visualizer',
        mailer_subjects_reauthentication: 'Confirm reauthentication — Quran Corpus Visualizer',
    });

    // Push each template individually to identify any blocked-keyword failures
    const templates: Array<[string, string, string]> = [
        ['confirmation',     'mailer_templates_confirmation_content',     'confirmation.html'],
        ['recovery',         'mailer_templates_recovery_content',         'recovery.html'],
        ['magic-link',       'mailer_templates_magic_link_content',       'magic-link.html'],
        ['invite',           'mailer_templates_invite_content',           'invite.html'],
        ['email-change',     'mailer_templates_email_change_content',     'email-change.html'],
        ['reauthentication', 'mailer_templates_reauthentication_content', 'reauthentication.html'],
    ];

    for (const [label, field, file] of templates) {
        await patchAuth(label, { [field]: readTemplate(file) });
    }

    console.log('\nDone.\n');
}

pushTemplates().catch(err => {
    console.error('❌  Unexpected error:', err);
    process.exit(1);
});
