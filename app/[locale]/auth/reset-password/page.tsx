"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { useAuth } from "@/lib/context/AuthContext";
import AuthShell from "@/components/auth/AuthShell";

export default function ResetPasswordPage() {
  const t = useTranslations("Auth");
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const { error: resetError } = await resetPassword(email);
      if (resetError) {
        setError(resetError);
        return;
      }
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title={t("resetPassword")}
      description={t("resetPasswordHint")}
      footer={
        <Link href="/auth/login" className="auth-footer-link">
          {t("backToSignIn")}
        </Link>
      }
    >
      {sent ? (
        <p role="status" className="message ui-message ui-message-success">{t("resetEmailSent")}</p>
      ) : (
        <form className="ui-auth-form" onSubmit={handleSubmit}>
          <label className="ui-field">
            <span>{t("email")}</span>
            <input
            type="email"
            autoComplete="email"
            required
            className="ui-input"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
          {error ? <p role="alert" className="message ui-message ui-message-error">{error}</p> : null}
          <button type="submit" className="primary-btn ui-btn ui-btn-primary" disabled={submitting}>
            {submitting ? t("loading") : t("sendResetLink")}
          </button>
        </form>
      )}
      <style jsx>{`
        :global(.auth-footer-link) {
          color: inherit;
        }
      `}</style>
    </AuthShell>
  );
}
