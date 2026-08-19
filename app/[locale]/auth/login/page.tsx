"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { useAuth } from "@/lib/context/AuthContext";
import AuthShell from "@/components/auth/AuthShell";

type Tab = "signin" | "signup";

export default function LoginPage() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const { signIn, signUp, signInWithGoogle } = useAuth();

  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // A failed OAuth / email handshake redirects here carrying its reason. Before
  // this, /auth/callback set ?error=… and nothing read it, so a broken sign-in
  // was indistinguishable from arriving at the form for the first time.
  const searchParams = useSearchParams();
  const callbackError = searchParams.get("error");
  useEffect(() => {
    if (!callbackError) return;
    const key =
      callbackError === "auth_cancelled"
        ? "errorCancelled"
        : callbackError === "auth_no_code"
          ? "errorNoCode"
          : callbackError === "auth_provider_error"
            ? "errorProvider"
            : "errorCallback";
    setError(t(key));
  }, [callbackError, t]);

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
      description={tab === "signin" ? t("signInDescription") : t("signUpDescription")}
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

        <div className="auth-divider" aria-hidden="true">
          <span>{t("orDivider")}</span>
        </div>

        <button
          type="button"
          className="ui-btn google-btn"
          disabled={submitting}
          onClick={async () => {
            setError(null);
            const { error: oauthError } = await signInWithGoogle();
            if (oauthError) setError(oauthError);
            // On success the browser redirects to Google — no local nav.
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {t("continueWithGoogle")}
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

        .auth-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--ink-muted);
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .auth-divider::before,
        .auth-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: var(--line);
        }

        :global(.google-btn) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border: 1px solid var(--line);
          background: var(--ui-surface-soft);
          color: var(--ink);
          font-weight: 600;
        }

        :global(.google-btn:hover) {
          border-color: var(--accent);
        }
      `}</style>
    </AuthShell>
  );
}
