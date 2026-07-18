"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/lib/context/AuthContext";
import { useKnowledge } from "@/lib/context/KnowledgeContext";
import { useRecentExplorationState } from "@/lib/hooks/useRecentExplorationState";
import { useQuizProgressSummary } from "@/lib/quiz/useQuizProgressSummary";
import type { TrackedRoot } from "@/lib/cache/knowledgeCache";
import AppWorkspaceShell from "@/components/ui/AppWorkspaceShell";

interface StudyHubProps {
  showBackLink?: boolean;
  title?: string;
}

type RootFilter = "all" | "learning" | "learned";
type StudyPanel = "overview" | "roots" | "account";

const DAY_MS = 1000 * 60 * 60 * 24;
const WEEK_MS = DAY_MS * 7;

export default function StudyHub({ showBackLink = false, title }: StudyHubProps) {
  const locale = useLocale();
  const t = useTranslations("Profile");
  const tAuth = useTranslations("Auth");
  const router = useRouter();
  const { user, signOut, updateProfile, loading: authLoading } = useAuth();
  const {
    roots,
    stats,
    updateRoot,
    exportKnowledge,
    importKnowledge,
    removeRoot,
    loading: knowledgeLoading,
    pendingMigration,
    acceptMigration,
    declineMigration,
  } = useKnowledge();
  const importRef = useRef<HTMLInputElement>(null);
  const recentExploration = useRecentExplorationState();
  const quizProgress = useQuizProgressSummary();
  // Profile identity (account panel): avatar from OAuth metadata (Google
  // users carry one) + an editable display name persisted to user_metadata.
  const meta = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
  const avatarUrl = meta.avatar_url || meta.picture || null;
  const currentDisplayName = (meta.display_name || meta.full_name || meta.name || "").trim();
  const identityInitials = (currentDisplayName
    ? currentDisplayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("")
    : (user?.email ?? "?").split("@")[0].slice(0, 2)
  ).toUpperCase();
  const [displayNameDraft, setDisplayNameDraft] = useState(currentDisplayName);
  // Auth hydrates after mount — adopt the stored name once it arrives (and
  // after saves, when the canonical value catches up to the draft).
  useEffect(() => {
    setDisplayNameDraft(currentDisplayName);
  }, [currentDisplayName]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSavedFlash, setProfileSavedFlash] = useState(false);

  const handleSaveDisplayName = async () => {
    setSavingProfile(true);
    setProfileSavedFlash(false);
    const { error } = await updateProfile({ display_name: displayNameDraft.trim() });
    setSavingProfile(false);
    if (!error) {
      setProfileSavedFlash(true);
      setTimeout(() => setProfileSavedFlash(false), 2500);
    }
  };

  const [editingRoot, setEditingRoot] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [activeFilter, setActiveFilter] = useState<RootFilter>("all");
  const [activePanel, setActivePanel] = useState<StudyPanel>("overview");

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const count = await importKnowledge(text, true);
      alert(t("importSuccess", { count }));
    } catch {
      alert(t("importError"));
    }
    event.target.value = "";
  }

  const trackedRoots = useMemo(() => sortTrackedRoots(Array.from(roots.values())), [roots]);
  const learningRoots = useMemo(() => trackedRoots.filter((root) => root.state === "learning"), [trackedRoots]);
  const learnedRoots = useMemo(() => trackedRoots.filter((root) => root.state === "learned"), [trackedRoots]);
  const visibleRoots = useMemo(() => {
    if (activeFilter === "learning") return learningRoots;
    if (activeFilter === "learned") return learnedRoots;
    return trackedRoots;
  }, [activeFilter, learningRoots, learnedRoots, trackedRoots]);
  const notesCount = useMemo(() => trackedRoots.filter((root) => root.notes.trim()).length, [trackedRoots]);
  const reviewedThisWeek = useMemo(
    () => trackedRoots.filter((root) => Date.now() - root.lastReviewedAt <= WEEK_MS).length,
    [trackedRoots]
  );
  const completionPercent = stats.total > 0 ? Math.round((stats.learned / stats.total) * 100) : 0;
  const nextRoot = learningRoots[0] ?? trackedRoots[0] ?? null;
  const recentRoots = trackedRoots.slice(0, 3).map((root) => root.root);

  // Guests get the full study surface backed by the local (IndexedDB)
  // knowledge store — the same one the graphs' "Track this root" writes to.
  // Signing in is a SYNC upsell (banner below), never a gate.
  if (authLoading || knowledgeLoading) {
    return (
      <main className="ui-page-shell ui-page-shell-centered ui-theme-scope">
        <div className="ui-panel ui-page-panel ui-page-panel-wide">
          <h1 className="ui-title">{title ?? t("title")}</h1>
          <p className="study-loading">{t("loading")}</p>
        </div>
      </main>
    );
  }

  const beginEditingRoot = (root: string, notes: string) => {
    setActivePanel("roots");
    setActiveFilter("all");
    setEditingRoot(root);
    setNotesDraft(notes);
  };

  const handleSaveRootNotes = async () => {
    if (!editingRoot) return;
    await updateRoot(editingRoot, { notes: notesDraft });
    setEditingRoot(null);
    setNotesDraft("");
  };

  const handleToggleRootState = async (root: string, currentState: "learning" | "learned") => {
    await updateRoot(root, { state: currentState === "learning" ? "learned" : "learning" });
  };

  const panelTabs: Array<{ key: StudyPanel; label: string; count: number | null }> = [
    { key: "overview", label: t("studySummary"), count: stats.total },
    { key: "roots", label: t("trackedRoots"), count: trackedRoots.length },
    { key: "account", label: t("dataAndAccount"), count: null },
  ];

  return (
    <AppWorkspaceShell
      kicker={t("studyKicker")}
      title={title ?? t("title")}
      description={user ? "" : t("guestMode")}
      panelWidth="wide"
      backgroundVariant="study"
      status={
        showBackLink ? (
          <button type="button" className="ui-btn ui-btn-ghost" onClick={() => router.push("/")}>
            {t("backToApp")}
          </button>
        ) : undefined
      }
    >
      {!user ? (
        <div className="migration-banner ui-card-muted" data-testid="study-guest-banner">
          <div>
            <strong>{t("guestBannerTitle")}</strong>
            <p>{t("guestBannerBody")}</p>
          </div>
          <button type="button" className="ui-btn ui-btn-primary" onClick={() => router.push("/auth/login")}>
            {tAuth("signIn")}
          </button>
        </div>
      ) : null}

      {user ? (
        <section className="ui-card ui-section-card study-identity-card study-identity-hero" data-testid="profile-identity-card">
          <div className="study-identity-row">
            <span className="study-identity-avatar" aria-hidden="true">
              {avatarUrl ? (
                /* remote avatar hosts (Google) aren't in next/image's allowlist */
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                identityInitials
              )}
            </span>
            <div className="study-identity-fields">
              <label className="ui-field">
                <span>{t("displayNameLabel")}</span>
                <div className="study-identity-name-row">
                  <input
                    type="text"
                    className="ui-input"
                    value={displayNameDraft}
                    placeholder={t("displayNamePlaceholder")}
                    maxLength={60}
                    onChange={(event) => setDisplayNameDraft(event.target.value)}
                  />
                  <button
                    type="button"
                    className="ui-btn ui-btn-primary"
                    disabled={savingProfile || displayNameDraft.trim() === currentDisplayName}
                    onClick={() => void handleSaveDisplayName()}
                  >
                    {savingProfile ? t("savingProfile") : t("saveProfile")}
                  </button>
                </div>
              </label>
              <p className="study-identity-meta">
                {user.email}
                {profileSavedFlash ? <span className="study-identity-saved"> · {t("profileSaved")}</span> : null}
              </p>
              <p className="study-identity-hint">{t("avatarHint")}</p>
            </div>
          </div>
        </section>
      ) : null}

      {pendingMigration ? (
        <div className="migration-banner ui-card-muted">
          <div>
            <strong>{t("migrationTitle")}</strong>
            <p>{t("migrationDescription")}</p>
          </div>
          <div className="migration-actions">
            <button type="button" className="ui-btn ui-btn-primary" onClick={() => void acceptMigration()}>
              {t("mergeLocalData")}
            </button>
            <button type="button" className="ui-btn ui-btn-ghost" onClick={declineMigration}>
              {t("keepLocalOnly")}
            </button>
          </div>
        </div>
      ) : null}

      <nav className="study-panel-switcher section-spacer" aria-label={t("title")}>
        {panelTabs.map((panel) => (
          <button
            key={panel.key}
            type="button"
            className={`study-panel-tab ${activePanel === panel.key ? "active" : ""}`}
            onClick={() => setActivePanel(panel.key)}
            aria-pressed={activePanel === panel.key}
          >
            <span>{panel.label}</span>
            {panel.count !== null ? <small>{formatNumber(panel.count, locale)}</small> : null}
          </button>
        ))}
      </nav>

      {activePanel === "overview" ? (
        <section className="study-panel-page section-spacer">
          <section className="ui-card ui-section-card study-summary-card">
            <div className="ui-card-head">
              <div className="study-head-copy">
                <h2>{t("studySummary")}</h2>
                <p>{t("snapshotDescription")}</p>
              </div>
            </div>

            <div className="study-summary-strip">
              <article className="study-metric">
                <span>{t("statsTotal")}</span>
                <strong>{formatNumber(stats.total, locale)}</strong>
              </article>
              <article className="study-metric">
                <span>{t("statsLearning")}</span>
                <strong>{formatNumber(stats.learning, locale)}</strong>
              </article>
              <article className="study-metric">
                <span>{t("statsLearned")}</span>
                <strong>{formatNumber(stats.learned, locale)}</strong>
              </article>
              <article className="study-metric">
                <span>{t("completionRate")}</span>
                <strong>{completionPercent}%</strong>
              </article>
              <article className="study-metric">
                <span>{t("quizSessionsCompleted")}</span>
                <strong>{formatNumber(quizProgress.completedSessions, locale)}</strong>
              </article>
              <article className="study-metric">
                <span>{t("quizAccuracy")}</span>
                <strong>{quizProgress.averageAccuracy}%</strong>
              </article>
            </div>

            <div className="study-chip-row">
              <span className="study-chip">{t("notesSaved")}: {formatNumber(notesCount, locale)}</span>
              <span className="study-chip">{t("reviewedThisWeek")}: {formatNumber(reviewedThisWeek, locale)}</span>
              <span className="study-chip">
                {t("lastQuizLabel")}: {quizProgress.lastCompletedAt ? formatRelativeTime(quizProgress.lastCompletedAt, locale) : t("noQuizActivity")}
              </span>
              {recentRoots.length > 0 ? recentRoots.map((root) => (
                <span key={root} className="study-root-pill" lang="ar" dir="rtl">{root}</span>
              )) : null}
            </div>
          </section>

          <section className="ui-grid-two-wide">
            <section className="ui-card ui-section-card study-continue-card">
              <div className="ui-card-head">
                <div className="study-head-copy">
                  <h2>{t("reviewNext")}</h2>
                  <p>{t("reviewNextHint")}</p>
                </div>
              </div>

              <div className="study-continue-grid">
                <article className="study-panel-block">
                  <span className="study-section-kicker">{t("nextReview")}</span>
                  {nextRoot ? (
                    <>
                      <div className="study-next-head">
                        <strong className="study-root-value" lang="ar" dir="rtl">{nextRoot.root}</strong>
                        <span className={`ui-state-pill ${nextRoot.state === "learned" ? "ui-state-pill-success" : "ui-state-pill-warning"}`}>
                          {nextRoot.state === "learned" ? t("learned") : t("learning")}
                        </span>
                      </div>
                      <p className="study-muted-copy">{nextRoot.notes.trim() || t("notesPrompt")}</p>
                      <div className="study-chip-row">
                        <span className="study-chip">{t("lastReviewedLabel")}: {formatRelativeTime(nextRoot.lastReviewedAt, locale)}</span>
                        <span className="study-chip">{nextRoot.notes.trim() ? t("notesReady") : t("notesMissing")}</span>
                      </div>
                      <div className="ui-card-actions">
                        <button
                          type="button"
                          className="ui-btn ui-btn-primary"
                          onClick={() => void handleToggleRootState(nextRoot.root, nextRoot.state)}
                        >
                          {nextRoot.state === "learned" ? t("markLearning") : t("markLearned")}
                        </button>
                        <button type="button" className="ui-btn ui-btn-ghost" onClick={() => beginEditingRoot(nextRoot.root, nextRoot.notes)}>
                          {t("editNotes")}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="ui-empty-copy">{t("reviewNextEmpty")}</p>
                  )}
                </article>

                <article className="study-panel-block">
                  <span className="study-section-kicker">{t("resumeExploration")}</span>
                  {recentExploration ? (
                    <>
                      <div className="study-detail-row">
                        <span>{t("lastView")}</span>
                        <strong>
                          {recentExploration.lastVisualizationMode}
                          {recentExploration.lastSurahId ? ` ${t("inSurah", { surahId: recentExploration.lastSurahId })}` : ""}
                        </strong>
                      </div>
                      <div className="study-detail-row">
                        <span>{t("rootLabel")}</span>
                        <strong>{recentExploration.lastRoot || t("noRecentRoot")}</strong>
                      </div>
                      <div className="ui-card-actions">
                        <button type="button" className="ui-btn ui-btn-primary" onClick={() => router.push("/")}>
                          {t("resumeInExplore")}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="ui-empty-copy">{t("resumeEmpty")}</p>
                  )}
                </article>
              </div>
            </section>

            <section className="ui-card ui-section-card study-continue-card">
              <div className="ui-card-head">
                <div className="study-head-copy">
                  <h2>{t("quizProgressTitle")}</h2>
                  <p>{t("quizProgressDescription")}</p>
                </div>
              </div>

              <div className="study-summary-strip study-summary-strip-compact">
                <article className="study-metric">
                  <span>{t("dailySessionsLabel")}</span>
                  <strong>{formatNumber(quizProgress.dailySessions, locale)}</strong>
                </article>
                <article className="study-metric">
                  <span>{t("studySessionsLabel")}</span>
                  <strong>{formatNumber(quizProgress.studySessions, locale)}</strong>
                </article>
              </div>
              <div className="study-chip-row">
                <span className="study-chip">{t("questionsAnsweredLabel")}: {formatNumber(quizProgress.questionsAnswered, locale)}</span>
                <span className="study-chip">{t("correctAnswersLabel")}: {formatNumber(quizProgress.correctAnswers, locale)}</span>
                <span className="study-chip">
                  {t("lastSessionTypeLabel")}: {quizProgress.lastSessionType ? t(`quizSessionTypes.${quizProgress.lastSessionType}`) : t("noneYet")}
                </span>
              </div>
              <div className="ui-card-actions">
                <button type="button" className="ui-btn ui-btn-primary" onClick={() => router.push("/quiz")}>
                  {t("goToQuiz")}
                </button>
              </div>
            </section>
          </section>
        </section>
      ) : null}

      {activePanel === "roots" ? (
        <section className="study-panel-page section-spacer">
          <section className="ui-card ui-section-card">
            <div className="ui-card-head">
              <div className="study-head-copy">
                <h2>{t("trackedRoots")}</h2>
                <p>{t("trackedRootsDescription", { count: visibleRoots.length, total: trackedRoots.length })}</p>
              </div>
              <span>{roots.size}</span>
            </div>

            {roots.size === 0 ? (
              <p className="ui-empty-copy">{t("noRoots")}</p>
            ) : (
              <>
                <div className="study-filter-row" role="tablist" aria-label={t("trackedRoots")}>
                  {([
                    { key: "all", label: t("filters.all"), count: trackedRoots.length },
                    { key: "learning", label: t("filters.learning"), count: learningRoots.length },
                    { key: "learned", label: t("filters.learned"), count: learnedRoots.length },
                  ] as const).map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      className={`study-filter-btn ${activeFilter === filter.key ? "active" : ""}`}
                      onClick={() => setActiveFilter(filter.key)}
                      role="tab"
                      aria-selected={activeFilter === filter.key}
                    >
                      {filter.label} <small>{formatNumber(filter.count, locale)}</small>
                    </button>
                  ))}
                </div>

                <ul className="root-list study-root-list">
                  {visibleRoots.map((root) => (
                    <li key={root.root} className="study-root-card">
                      <div className="study-root-row">
                        <div className="study-root-main">
                          <strong className="study-root-inline" lang="ar" dir="rtl">{root.root}</strong>
                          <div className="study-inline-meta">
                            <span>{t("lastReviewedLabel")}: {formatRelativeTime(root.lastReviewedAt, locale)}</span>
                            <span>{t("addedOnLabel")}: {formatAbsoluteDate(root.addedAt, locale)}</span>
                          </div>
                        </div>
                        <span className={`ui-state-pill ${root.state === "learned" ? "ui-state-pill-success" : "ui-state-pill-warning"}`}>
                          {root.state === "learned" ? t("learned") : t("learning")}
                        </span>
                      </div>

                      {editingRoot === root.root ? (
                        <div className="root-notes-editor">
                          <textarea
                            className="root-notes-input"
                            value={notesDraft}
                            onChange={(event) => setNotesDraft(event.target.value)}
                            rows={3}
                          />
                          <div className="ui-card-actions">
                            <button type="button" className="ui-btn ui-btn-primary study-root-action" onClick={() => void handleSaveRootNotes()}>
                              {t("saveNotes")}
                            </button>
                            <button
                              type="button"
                              className="ui-btn ui-btn-ghost study-root-action"
                              onClick={() => {
                                setEditingRoot(null);
                                setNotesDraft("");
                              }}
                            >
                              {t("cancel")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="study-root-notes">{root.notes.trim() || t("notesPrompt")}</p>
                          <div className="root-row-actions">
                            <button
                              type="button"
                              className="ui-btn ui-btn-ghost study-root-action"
                              onClick={() => void handleToggleRootState(root.root, root.state)}
                            >
                              {root.state === "learned" ? t("markLearning") : t("markLearned")}
                            </button>
                            <button
                              type="button"
                              className="ui-btn ui-btn-ghost study-root-action"
                              onClick={() => beginEditingRoot(root.root, root.notes)}
                            >
                              {t("editNotes")}
                            </button>
                            <button type="button" className="ui-btn ui-btn-ghost study-root-action" onClick={() => void removeRoot(root.root)}>
                              {t("removeRoot")}
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </section>
      ) : null}

      {activePanel === "account" ? (
        <section className="study-panel-page section-spacer">
          <section className="ui-grid-two-wide">
            <section className="ui-card ui-section-card study-tools-card">
              <div className="ui-card-head">
                <div className="study-head-copy">
                  <h2>{t("quizCardTitle")}</h2>
                  <p>{t("quizPromptDesc")}</p>
                </div>
              </div>

              <div className="study-panel-block">
                <div className="study-summary-strip study-summary-strip-compact">
                  <article className="study-metric">
                    <span>{t("quizSessionsCompleted")}</span>
                    <strong>{formatNumber(quizProgress.completedSessions, locale)}</strong>
                  </article>
                  <article className="study-metric">
                    <span>{t("quizAccuracy")}</span>
                    <strong>{quizProgress.averageAccuracy}%</strong>
                  </article>
                </div>
                <div className="ui-card-actions">
                  <button type="button" className="ui-btn ui-btn-primary" onClick={() => router.push("/quiz")}>
                    {t("goToQuiz")}
                  </button>
                </div>
              </div>
            </section>

            <section className="ui-card ui-section-card study-tools-card">
              <div className="ui-card-head">
                <div className="study-head-copy">
                  <h2>{t("dataAndAccount")}</h2>
                  <p>{t("dataAndAccountDescription")}</p>
                </div>
              </div>

              <div className="study-tool-actions study-tool-actions-panel">
                <button type="button" className="ui-btn ui-btn-ghost" onClick={() => void exportKnowledge()}>
                  {t("exportData")}
                </button>
                <button type="button" className="ui-btn ui-btn-ghost" onClick={() => importRef.current?.click()}>
                  {t("importData")}
                </button>
                {user ? (
                  <button type="button" className="ui-btn ui-btn-danger" onClick={() => void signOut().then(() => router.push("/"))}>
                    {tAuth("signOut")}
                  </button>
                ) : (
                  <button type="button" className="ui-btn ui-btn-primary" onClick={() => router.push("/auth/login")}>
                    {tAuth("signIn")}
                  </button>
                )}
                <input ref={importRef} type="file" accept=".json" hidden onChange={handleImport} />
              </div>
            </section>
          </section>
        </section>
      ) : null}

      <style jsx>{`
        .study-identity-card {
          margin-bottom: 1rem;
        }

        /* Hero placement: identity leads the page, study panels follow. */
        .study-identity-hero .study-identity-avatar {
          width: 84px;
          height: 84px;
          font-size: 1.7rem;
        }

        .study-identity-hero {
          background: color-mix(in srgb, var(--accent) 5%, var(--ui-surface));
          border-color: color-mix(in srgb, var(--accent) 22%, var(--line));
        }

        .study-identity-row {
          display: flex;
          align-items: flex-start;
          gap: 18px;
        }

        .study-identity-avatar {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: var(--accent);
          color: var(--accent-ink, #fff);
          font-size: 1.3rem;
          font-weight: 700;
          overflow: hidden;
          flex-shrink: 0;
          border: 2px solid color-mix(in srgb, var(--accent) 40%, transparent);
        }

        .study-identity-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .study-identity-fields {
          flex: 1;
          min-width: 0;
          display: grid;
          gap: 6px;
        }

        .study-identity-name-row {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .study-identity-name-row .ui-input {
          flex: 1;
          min-width: 0;
        }

        .study-identity-meta {
          margin: 0;
          font-size: 0.8rem;
          color: var(--ink-muted);
        }

        .study-identity-saved {
          color: var(--accent-2, #56a697);
          font-weight: 600;
        }

        .study-identity-hint {
          margin: 0;
          font-size: 0.72rem;
          color: var(--ink-muted);
          opacity: 0.8;
        }

        @media (max-width: 640px) {
          .study-identity-row {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }

          .study-identity-name-row {
            flex-direction: column;
            align-items: stretch;
          }
        }

        .study-panel-page {
          display: grid;
          gap: 1rem;
        }

        .study-panel-switcher {
          display: flex;
          flex-wrap: wrap;
          gap: 0.65rem;
        }

        .study-panel-tab {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.62rem 0.9rem;
          border: 1px solid var(--line);
          border-radius: var(--radius-pill);
          background: var(--bg-2);
          color: var(--ink-secondary);
          font: inherit;
          font-size: 0.86rem;
          font-weight: 700;
          cursor: pointer;
          transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease, transform 0.2s ease;
        }

        .study-panel-tab:hover {
          transform: translateY(-1px);
        }

        .study-panel-tab.active {
          border-color: color-mix(in srgb, var(--accent), white 36%);
          background: color-mix(in srgb, var(--accent), transparent 88%);
          color: var(--ink);
        }

        .study-panel-tab small {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 1.35rem;
          padding: 0.16rem 0.38rem;
          border-radius: var(--radius-pill);
          background: var(--line);
          color: inherit;
          font-size: 0.72rem;
          line-height: 1;
        }

        .study-head-copy {
          display: grid;
          gap: 0.18rem;
        }

        .study-head-copy h2 {
          font-size: 1rem;
          line-height: 1.2;
        }

        .study-head-copy p,
        .study-muted-copy,
        .study-root-notes {
          margin: 0;
          color: var(--ink-muted);
          font-size: 0.94rem;
          line-height: 1.5;
        }

        .study-summary-card,
        .study-continue-card {
          background: var(--panel);
        }

        .study-summary-strip,
        .study-continue-grid {
          display: grid;
          gap: 0.8rem;
        }

        .study-summary-strip {
          grid-template-columns: repeat(6, minmax(0, 1fr));
          margin-bottom: 0.9rem;
        }

        .study-summary-strip-compact {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin-bottom: 0;
        }

        .study-metric,
        .study-panel-block {
          display: grid;
          gap: 0.45rem;
          padding: 0.85rem 0.95rem;
          border: 1px solid var(--line);
          border-radius: var(--radius-md);
          background: var(--bg-2);
        }

        .study-metric span,
        .study-section-kicker,
        .study-detail-row span {
          color: var(--ink-muted);
          font-size: 0.7rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .study-metric strong {
          font-size: 1.55rem;
          line-height: 1;
        }

        .study-chip-row,
        .study-filter-row,
        .study-tool-actions,
        .study-inline-meta,
        .root-row-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.55rem;
        }

        .study-chip,
        .study-root-pill {
          display: inline-flex;
          align-items: center;
          padding: 0.36rem 0.62rem;
          border-radius: var(--radius-pill);
          background: var(--bg-2);
          color: var(--ink);
          font-size: 0.76rem;
          line-height: 1;
        }

        .study-root-pill,
        .study-root-value,
        .study-root-inline {
          font-family: var(--font-arabic, serif);
        }

        .study-continue-grid {
          grid-template-columns: 1.1fr 0.9fr;
        }

        .study-next-head,
        .study-detail-row {
          display: flex;
          justify-content: space-between;
          gap: 0.9rem;
          align-items: flex-start;
        }

        /* V2 tracked-root row */
        .study-root-row {
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 16px 20px;
          border-top: 1px solid var(--line);
        }

        .study-root-main {
          display: flex;
          align-items: center;
          gap: 18px;
          flex: 1;
          min-width: 0;
        }

        .study-root-inline {
          font-family: var(--font-arabic, serif);
          font-size: 26px;
          color: var(--ink);
          width: 90px;
          flex: 0 0 90px;
          line-height: 1.1;
        }

        .study-inline-meta {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          color: var(--ink-muted);
          font-family: var(--font-sans, inherit);
          font-size: 12px;
        }

        /* V2 state pill tints (scoped override of global ui-state-pill) */
        .study-root-row :global(.ui-state-pill) {
          padding: 5px 12px;
          border-radius: var(--radius-pill);
          font-size: 11px;
          text-transform: capitalize;
          letter-spacing: 0.02em;
        }

        .study-root-row :global(.ui-state-pill-success) {
          background: color-mix(in srgb, #56a697 10%, transparent);
          border: 1px solid color-mix(in srgb, #56a697 30%, transparent);
          color: #9fd4c4;
        }

        .study-root-row :global(.ui-state-pill-warning) {
          background: color-mix(in srgb, #e6c24e 10%, transparent);
          border: 1px solid color-mix(in srgb, #e6c24e 30%, transparent);
          color: #ecd07e;
        }

        .study-root-value {
          font-size: 1.95rem;
          line-height: 0.95;
        }

        .study-detail-row {
          padding-bottom: 0.5rem;
          border-bottom: 1px solid var(--line);
        }

        .study-detail-row:last-of-type {
          margin-bottom: 0.25rem;
        }

        .study-panel-block :global(.ui-btn),
        .study-tool-actions :global(.ui-btn),
        .study-root-card :global(.ui-btn),
        .migration-actions :global(.ui-btn) {
          padding: 0.66rem 0.9rem;
          font-size: 0.94rem;
          line-height: 1.1;
        }

        .study-panel-block :global(.ui-card-actions),
        .study-root-card :global(.ui-card-actions),
        .study-tool-actions,
        .root-row-actions {
          gap: 0.55rem;
        }

        .study-tool-actions :global(.ui-btn) {
          min-width: 0;
        }

        .study-tool-actions {
          margin-top: 0.9rem;
          padding-top: 0.9rem;
          border-top: 1px solid var(--line);
        }

        .study-tool-actions-panel {
          margin-top: 0;
          padding-top: 0;
          border-top: 0;
        }

        .study-filter-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.38rem;
          padding: 0.5rem 0.75rem;
          border: 1px solid var(--line);
          border-radius: var(--radius-pill);
          background: transparent;
          color: var(--ink-secondary);
          font: inherit;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
        }

        .study-filter-btn.active,
        .study-filter-btn:hover {
          border-color: color-mix(in srgb, var(--accent), white 40%);
          background: color-mix(in srgb, var(--accent), transparent 88%);
          color: var(--ink);
        }

        .study-root-list {
          max-height: none;
          gap: 0.75rem;
        }

        .study-root-card {
          gap: 0.8rem;
        }

        .study-root-notes {
          font-size: 0.9rem;
        }

        .study-root-action {
          font-size: 0.9rem;
        }

        @media (min-width: 721px) {
          .study-panel-block :global(.ui-card-actions) {
            align-items: center;
          }
        }

        @media (max-width: 1100px) {
          .study-summary-strip,
          .study-continue-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .study-summary-strip,
          .study-continue-grid {
            grid-template-columns: 1fr;
          }

          .study-panel-block :global(.ui-btn),
          .study-tool-actions :global(.ui-btn),
          .study-root-card :global(.ui-btn) {
            width: auto;
          }

          .study-next-head,
          .study-detail-row,
          .study-root-row {
            flex-direction: column;
            align-items: flex-start;
          }
        }

        :global([data-theme="dark"] .study-summary-card),
        :global([data-theme="dark"] .study-continue-card) {
          background: var(--panel);
        }

        :global([data-theme="dark"] .study-metric),
        :global([data-theme="dark"] .study-panel-block) {
          background: var(--bg-2);
          border-color: var(--line);
        }

        :global([data-theme="dark"] .study-chip),
        :global([data-theme="dark"] .study-root-pill) {
          background: var(--bg-2);
        }

        :global([data-theme="dark"] .study-detail-row),
        :global([data-theme="dark"] .study-tool-actions) {
          border-color: var(--line);
        }

        :global([data-theme="dark"] .study-panel-tab) {
          background: var(--bg-2);
          border-color: var(--line);
        }

        :global([data-theme="dark"] .study-panel-tab.active) {
          background: color-mix(in srgb, var(--accent), transparent 86%);
        }

        :global([data-theme="dark"] .study-panel-tab small) {
          background: var(--line);
        }
      `}</style>
    </AppWorkspaceShell>
  );
}

function sortTrackedRoots(roots: TrackedRoot[]) {
  return [...roots].sort((a, b) => {
    if (a.state !== b.state) return a.state === "learning" ? -1 : 1;
    if (a.lastReviewedAt !== b.lastReviewedAt) return a.lastReviewedAt - b.lastReviewedAt;
    return a.addedAt - b.addedAt;
  });
}

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function formatAbsoluteDate(timestamp: number, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(timestamp);
}

function formatRelativeTime(timestamp: number, locale: string) {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const deltaDays = Math.round((timestamp - Date.now()) / DAY_MS);
  if (Math.abs(deltaDays) <= 30) return rtf.format(deltaDays, "day");

  const deltaMonths = Math.round(deltaDays / 30);
  if (Math.abs(deltaMonths) < 12) return rtf.format(deltaMonths, "month");

  return rtf.format(Math.round(deltaDays / 365), "year");
}
