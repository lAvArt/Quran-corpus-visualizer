/**
 * This app's identity marker inside SHARED Pluragate infrastructure.
 *
 * The Supabase project is shared across Pluragate products (see
 * docs/DATA_SOURCES.md + team memory): auth email templates are
 * project-global, so each app stamps its signups with this id
 * (`options.data.app`) and the templates branch on `{{ .Data.app }}`.
 * Apps that stamp nothing get the generic Pluragate template.
 */
export const APP_EMAIL_IDENTITY = "quran-observatory";
