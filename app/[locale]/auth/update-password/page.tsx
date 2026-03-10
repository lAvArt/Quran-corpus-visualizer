"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/lib/context/AuthContext";
import AuthShell from "@/components/auth/AuthShell";

export default function UpdatePasswordPage() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const { updatePassword, user } = useAuth();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <AuthShell title={t("updatePassword")} description={t("sessionRequired")}>
        <p className="message ui-message ui-message-error">{t("sessionRequired")}</p>

        <style jsx>{`
          .message {
            font-size: 0.9rem;
          }
        `}</style>
      </AuthShell>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await updatePassword(password);
      if (updateError) {
        setError(updateError);
        return;
      }
      router.push("/");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title={t("updatePassword")} description="Choose a new password to keep your study space secure.">
      <form className="ui-auth-form" onSubmit={handleSubmit}>
        <label className="ui-field">
          <span>{t("newPassword")}</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="ui-input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <label className="ui-field">
          <span>{t("confirmPassword")}</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="ui-input"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </label>

        {error ? <p role="alert" className="message ui-message ui-message-error">{error}</p> : null}

        <button type="submit" className="primary-btn ui-btn ui-btn-primary" disabled={submitting}>
          {submitting ? t("loading") : t("updatePasswordButton")}
        </button>
      </form>
    </AuthShell>
  );
}
