"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { useAuth } from "@/lib/context/AuthContext";
import AuthShell from "@/components/auth/AuthShell";

type Tab = "signin" | "signup";

export default function LoginPage() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const { signIn, signUp } = useAuth();

  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (tab === "signup" && password !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }

    setSubmitting(true);
    try {
      if (tab === "signin") {
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          setError(signInError);
          return;
        }
        router.push("/");
        return;
      }

      const { error: signUpError } = await signUp(email, password);
      if (signUpError) {
        setError(signUpError);
        return;
      }
      setSuccessMessage(t("signUpSuccess"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title={tab === "signin" ? t("signIn") : t("signUp")}
      description={tab === "signin" ? "Return to your exploration workspace and pick up where you left off." : "Create an account to sync tracked roots, notes, and study progress."}
      footer={
        tab === "signin" ? (
          <Link href="/auth/reset-password" className="auth-footer-link">
            {t("forgotPassword")}
          </Link>
        ) : null
      }
    >
      <div className="auth-tabs ui-tab-group" role="tablist" aria-label="Authentication mode">
        {(["signin", "signup"] as Tab[]).map((tabValue) => (
          <button
            key={tabValue}
            type="button"
            role="tab"
            aria-selected={tab === tabValue}
            className={`auth-tab ui-tab ${tab === tabValue ? "active" : ""}`}
            onClick={() => {
              setTab(tabValue);
              setError(null);
              setSuccessMessage(null);
            }}
          >
            {tabValue === "signin" ? t("signIn") : t("signUp")}
          </button>
        ))}
      </div>

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

        <label className="ui-field">
          <span>{t("password")}</span>
          <input
            type="password"
            autoComplete={tab === "signin" ? "current-password" : "new-password"}
            required
            minLength={8}
            className="ui-input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {tab === "signup" ? (
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
        ) : null}

        {error ? <p role="alert" className="message ui-message ui-message-error">{error}</p> : null}
        {successMessage ? <p role="status" className="message ui-message ui-message-success">{successMessage}</p> : null}

        <button type="submit" className="primary-btn ui-btn ui-btn-primary" disabled={submitting}>
          {submitting ? t("loading") : tab === "signin" ? t("signIn") : t("signUp")}
        </button>
      </form>
      <style jsx>{`
        .auth-tabs {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .auth-tab {
          text-align: center;
        }

        :global(.auth-footer-link) {
          color: inherit;
        }
      `}</style>
    </AuthShell>
  );
}
