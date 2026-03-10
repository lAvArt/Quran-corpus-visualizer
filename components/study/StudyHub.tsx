"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/context/AuthContext";
import { useKnowledge } from "@/lib/context/KnowledgeContext";
import { useRecentExplorationState } from "@/lib/hooks/useRecentExplorationState";
import type { StudySummary } from "@/lib/schema/appShell";
import AppWorkspaceShell from "@/components/ui/AppWorkspaceShell";

interface StudyHubProps {
  showBackLink?: boolean;
  title?: string;
}

export default function StudyHub({ showBackLink = false, title }: StudyHubProps) {
  const t = useTranslations("Profile");
  const tAuth = useTranslations("Auth");
  const router = useRouter();
  const { user, signOut, loading: authLoading } = useAuth();
  const {
    roots,
    stats,
    updateRoot,
    exportKnowledge,
    importKnowledge,
    loading: knowledgeLoading,
    pendingMigration,
    acceptMigration,
    declineMigration,
  } = useKnowledge();
  const importRef = useRef<HTMLInputElement>(null);
  const recentExploration = useRecentExplorationState();
  const [editingRoot, setEditingRoot] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth/login");
    }
  }, [authLoading, router, user]);

  if (authLoading || knowledgeLoading || !user) {
    return (
      <main className="ui-page-shell ui-page-shell-centered ui-theme-scope">
        <div className="ui-panel ui-page-panel ui-page-panel-wide">
          <p className="study-loading">{t("loading")}</p>
        </div>
      </main>
    );
  }

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

  const summary: StudySummary = {
    trackedRootCount: stats.total,
    learningCount: stats.learning,
    learnedCount: stats.learned,
    recentRoots: Array.from(roots.values()).slice(0, 4).map((root) => root.root),
    hasPendingMigration: pendingMigration,
  };

  const beginEditingRoot = (root: string, notes: string) => {
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

  return (
    <AppWorkspaceShell
      kicker={t("studyKicker")}
      title={title ?? t("title")}
      description={user.email ?? ""}
      panelWidth="wide"
      backgroundVariant="study"
      status={showBackLink ? (
        <button type="button" className="ui-btn ui-btn-ghost" onClick={() => router.push("/")}>
          {t("backToApp")}
        </button>
      ) : undefined}
    >
      {pendingMigration ? (
        <div className="migration-banner ui-card-muted">
          <div>
            <strong>{t("migrationTitle")}</strong>
            <p>{t("migrationDescription")}</p>
          </div>
          <div className="migration-actions">
            <button
              type="button"
              className="ui-btn ui-btn-primary"
              data-testid="study-migration-merge"
              onClick={() => void acceptMigration()}
            >
              {t("mergeLocalData")}
            </button>
            <button
              type="button"
              className="ui-btn ui-btn-ghost"
              data-testid="study-migration-decline"
              onClick={declineMigration}
            >
              {t("keepLocalOnly")}
            </button>
          </div>
        </div>
      ) : null}

      <section className="ui-grid-three study-stats">
        {[
          { label: t("statsTotal"), value: stats.total },
          { label: t("statsLearning"), value: stats.learning },
          { label: t("statsLearned"), value: stats.learned },
        ].map(({ label, value }) => (
          <article key={label} className="ui-stat-card ui-card">
            <strong>{value}</strong>
            <span>{label}</span>
          </article>
        ))}
      </section>

      <section className="ui-grid-two-wide section-spacer">
        <section className="ui-card ui-section-card">
          <div className="ui-card-head">
            <h2>{t("resumeExploration")}</h2>
          </div>
          {recentExploration ? (
            <div className="ui-info-list">
              <p className="ui-empty-copy">
                {t("lastView")} <strong>{recentExploration.lastVisualizationMode}</strong>
                {recentExploration.lastSurahId ? ` ${t("inSurah", { surahId: recentExploration.lastSurahId })}` : ""}
              </p>
              <p className="ui-empty-copy">
                {recentExploration.lastRoot ? `${t("rootLabel")} ${recentExploration.lastRoot}` : t("noRecentRoot")}
                {recentExploration.lastLemma ? ` | ${t("lemmaLabel")} ${recentExploration.lastLemma}` : ""}
              </p>
              <div className="ui-card-actions">
                <button type="button" className="ui-btn ui-btn-primary" data-testid="study-resume-explore" onClick={() => router.push("/")}>
                  {t("resumeInExplore")}
                </button>
              </div>
            </div>
          ) : (
            <p className="ui-empty-copy">{t("resumeEmpty")}</p>
          )}
        </section>

        <section className="ui-card ui-section-card">
          <div className="ui-card-head">
            <h2>{t("studySummary")}</h2>
          </div>
          <div className="ui-info-list">
            <p className="ui-empty-copy">{t("trackedRootsLabel")} {summary.trackedRootCount}</p>
            <p className="ui-empty-copy">{t("learningLabel")} {summary.learningCount}</p>
            <p className="ui-empty-copy">{t("learnedLabel")} {summary.learnedCount}</p>
            <p className="ui-empty-copy">{t("migrationPendingLabel")} {summary.hasPendingMigration ? t("yes") : t("no")}</p>
            <p className="ui-empty-copy">
              {t("recentRootsLabel")} {summary.recentRoots.length > 0 ? summary.recentRoots.join(" | ") : t("noneYet")}
            </p>
          </div>
        </section>
      </section>

      <section className="ui-grid-two-wide">
        <section className="ui-card ui-section-card">
          <div className="ui-card-head">
            <h2>{t("trackedRoots")}</h2>
            <span>{roots.size}</span>
          </div>
          {roots.size === 0 ? (
            <p className="ui-empty-copy">{t("noRoots")}</p>
          ) : (
            <ul className="root-list">
              {Array.from(roots.values()).map((root) => (
                <li key={root.root}>
                  <div className="root-row-main">
                    <span dir="rtl" className="arabic-root">{root.root}</span>
                    <span
                      className={`ui-state-pill ${root.state === "learned" ? "ui-state-pill-success" : "ui-state-pill-warning"}`}
                      data-testid={`study-root-state-${root.root}`}
                    >
                      {root.state === "learned" ? t("learned") : t("learning")}
                    </span>
                  </div>
                  <div className="root-row-actions">
                    <button
                      type="button"
                    className="ui-btn ui-btn-ghost study-root-action"
                    data-testid={`study-root-toggle-${root.root}`}
                    onClick={() => void handleToggleRootState(root.root, root.state)}
                    >
                      {root.state === "learned" ? t("markLearning") : t("markLearned")}
                    </button>
                    <button
                      type="button"
                      className="ui-btn ui-btn-ghost study-root-action"
                      data-testid={`study-root-edit-${root.root}`}
                      onClick={() => beginEditingRoot(root.root, root.notes)}
                    >
                      {t("editNotes")}
                    </button>
                  </div>
                  {editingRoot === root.root ? (
                    <div className="root-notes-editor">
                      <textarea
                        className="root-notes-input"
                        data-testid={`study-root-notes-input-${root.root}`}
                        value={notesDraft}
                        onChange={(event) => setNotesDraft(event.target.value)}
                        rows={3}
                      />
                      <div className="ui-card-actions">
                        <button
                          type="button"
                          className="ui-btn ui-btn-primary study-root-action"
                          data-testid={`study-root-save-${root.root}`}
                          onClick={() => void handleSaveRootNotes()}
                        >
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
                  ) : root.notes ? (
                    <p className="root-notes-copy">{root.notes}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ui-card ui-section-card">
          <div className="ui-card-head">
            <h2>{t("dataAndAccount")}</h2>
          </div>
          <p className="ui-empty-copy">{t("dataAndAccountDescription")}</p>
          <div className="ui-card-actions">
            <button
              type="button"
              className="ui-btn ui-btn-ghost"
              data-testid="study-export-data"
              onClick={() => void exportKnowledge()}
            >
              {t("exportData")}
            </button>
            <button
              type="button"
              className="ui-btn ui-btn-ghost"
              data-testid="study-import-data"
              onClick={() => importRef.current?.click()}
            >
              {t("importData")}
            </button>
            <button
              type="button"
              className="ui-btn ui-btn-danger"
              data-testid="study-sign-out"
              onClick={() => void signOut().then(() => router.push("/"))}
            >
              {tAuth("signOut")}
            </button>
            <input
              ref={importRef}
              data-testid="study-import-input"
              type="file"
              accept=".json"
              hidden
              onChange={handleImport}
            />
          </div>
        </section>
      </section>

    </AppWorkspaceShell>
  );
}
