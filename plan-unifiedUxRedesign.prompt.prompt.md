# Unified Plan: UX/UI Redesign + Auto-Generated Quizzes + iframe Embedding

## TL;DR

Redesign the product shell around 5 user intents (Discover, Root, Ayah, Quiz, Study) while keeping all 9 visualization components untouched. Decompose the 77-prop `useHomePageController` into focused contexts. Replace tour-based onboarding with task-based first-run. Add an auto-generated quiz engine (daily puzzle + personalized review). Add iframe embedding with a public postMessage API. Ship in 6 phases with clear dependency ordering.

---

## Diagnosis: What's Wrong Today

The visualizations are excellent. The shell around them is the problem.

**State architecture**: `useHomePageController` returns 77 properties (34 state values, 11 setters, 32 handlers). These are prop-drilled through `HomePageClient` → `HomeHeader` (45+ props) → `HomeOverlayLayer` (60+ props) → `VisualizationViewport`. Every shell change risks breaking prop threading.

**Surface fragmentation**: Search appears in 5 places (header GlobalSearch, sidebar Search tab, sidebar Inspector quick-search, mobile search overlay, SearchWorkspace page). Each surface has slightly different behavior.

**Cognitive overload**: The header contains brand, search bar, display settings panel, visualization switcher, export menu, sidebar toggle, language switcher, auth button, and mobile nav — all competing for attention. `HomeOverlayLayer` renders 13 distinct surfaces (loading bar, status pill, banners, breadcrumbs, feedback prompt, left sidebar, right sidebar, onboarding modal, walkthrough overlay, mobile bottom bar, mobile search, context notices, selection panel).

**Onboarding teaches the tool, not the task**: The current 3-step carousel (find root → see across surahs → inspect grammar) explains mechanics. It doesn't ask "what do you want to understand?" and doesn't give the user a mission to complete.

**Study is isolated**: `StudyHub` lives on a separate route (`/study`). Tracking a root requires navigating away from visualization context. There's no "save this root" action on graph nodes.

---

## Design Principles

1. **Task-first, not tool-first** — every screen answers "what can I do here?" before "what is this?"
2. **One command bar** — search is a single model with multiple presentations, not 5 separate implementations
3. **Context-reactive chrome** — the sidebar auto-switches based on what's selected, not manual tab clicking
4. **Quieter shell, louder graph** — the visualization is the emotional core; chrome stays out of the way
5. **Progressive complexity** — beginner sees 3 modes + guided missions; advanced sees 9 modes + power tools
6. **Accuracy over content volume** — quizzes are auto-generated from the same data powering visualizations; zero manual curation

---

## Phase 0: State Architecture Cleanup

**Goal**: Decompose the 77-prop monolith into focused contexts so subsequent shell changes don't fight prop spaghetti.

**Why first**: Every subsequent phase (new shell, quiz integration, embed) needs to read/write state. If that state is threaded through 3 layers of prop drilling, every UI change requires touching every intermediate component. Contexts fix this.

### Steps

0.1. **Create `SelectionContext`** (`lib/context/SelectionContext.tsx`)
Extract from `useHomePageController`:
- `selectedSurahId`, `selectedRoot`, `selectedLemma`, `selectedAyahInSurah`
- `focusedToken`, `hoverTokenId`, `inspectorTokenFinal`, `inspectorModeFinal`
- `setSelectedSurahId`, `setSelectedRoot`, `setSelectedLemma`, `setHoverTokenId`, `setFocusedTokenId`
- `handleTokenSelect`, `handleSurahSelect`, `handleRootSelect`, `handleLemmaSelect`, `handleSearchRootSelect`

0.2. **Create `VizModeContext`** (`lib/context/VizModeContext.tsx`)
Extract:
- `vizMode`, `experienceLevel`, `showAdvancedModes`, `isHierarchicalMode`
- `handleVizModeChange`, `handleExperienceLevelChange`, `setShowAdvancedModes`
- `contextTransformNotice`, `handleDismissContextTransformNotice`, `handleRestoreFocusedContext`
- `vizSuggestion`, `handleAcceptVizSuggestion`, `handleDismissVizSuggestion`

0.3. **Create `SearchContext`** (`lib/context/SearchContext.tsx`)
Extract:
- `searchStatus`, `searchLockedRoot`, `setSearchLockedRoot`
- `handleSearchOpened`, `handleSearchQuerySubmitted`, `handleSearchResultSelected`

0.4. **Create `OnboardingContext`** (`lib/context/OnboardingContext.tsx`)
Extract:
- `experiencePhase`, `showOnStartup`, `walkthroughStepIndex`
- `handleOnboardingComplete`, `handleOnboardingSkip`, `handleStartWalkthrough`
- `handleOnboardingStartupChange`, `handleReplayExperience`
- `handleWalkthroughNext`, `handleWalkthroughBack`

0.5. **Wire contexts into the provider tree** in `providers.tsx`:
```
<I18nProvider>
  <AuthProvider>
    <KnowledgeProvider>
      <VizModeProvider>
        <SelectionProvider>
          <SearchProvider>
            <OnboardingProvider>
              <VizControlProvider>  ← existing, now lighter
                {children}
              </VizControlProvider>
            </OnboardingProvider>
          </SearchProvider>
        </SelectionProvider>
      </VizModeProvider>
    </KnowledgeProvider>
  </AuthProvider>
</I18nProvider>
```

0.6. **Refactor `useHomePageController`** into a thin composition hook that calls `useSelection()`, `useVizMode()`, `useSearch()`, `useOnboarding()` and assembles a flat return object for backward compatibility. Existing consumers keep working without changes.

0.7. **Migrate consumers incrementally** — `VisualizationViewport`, `HomeHeader`, `HomeOverlayLayer` can start consuming contexts directly instead of props, one component at a time.

### Relevant Files
- `lib/hooks/useHomePageController.ts` — The 77-prop monolith to decompose
- `lib/hooks/VizControlContext.tsx` — Existing context (17 props) stays as-is
- `app/[locale]/providers.tsx` — Provider tree to extend
- `components/home/HomePageClient.tsx` — Current prop-threading root
- `components/home/HomeHeader.tsx` — 45+ prop consumer
- `components/home/HomeOverlayLayer.tsx` — 60+ prop consumer

### Verification
- All existing tests pass with zero behavioral changes
- `useHomePageController` still returns the same 77 properties (backward compat)
- Each new context can be consumed independently from any component

---

## Phase 1: Unified Command Bar Search

**Goal**: Collapse 5 search surfaces into one model with multiple presentations.

### Architecture

One `SearchEngine` class/hook that encapsulates intent detection, query parsing, index lookup, and result grouping. Presentation adapters render results differently depending on surface.

### Steps

1.1. **Create `lib/search/searchEngine.ts`** — Extract the core search pipeline from `GlobalSearch.tsx` into a headless engine:
- `parse(query) → ParsedQuery` (reuse `queryParser.ts`)
- `execute(parsed, corpus, catalog) → GroupedResults`
- `getSuggestions(partial) → IntentHint[]`
No UI, no React, no side effects. Pure functions.

1.2. **Create `components/search/CommandBar.tsx`** — Single search input component that:
- Renders as a slim bar in the header (desktop) or as a modal (mobile, triggered from bottom bar)
- Uses `searchEngine` for all query processing
- Shows intent hints inline ("Searching root: حمد")
- Groups results by type with keyboard navigation
- Emits selection events via `SearchContext`

1.3. **Refactor `GlobalSearch.tsx`** to wrap `CommandBar` with surface-specific analytics and filter presets. `GlobalSearch` becomes a thin presentation adapter, not its own search implementation.

1.4. **Update sidebar Search tab** to render `CommandBar` with expanded results view (full result cards instead of compact list).

1.5. **Update mobile search overlay** to render `CommandBar` in full-screen modal mode.

1.6. **Remove duplicate search implementations** from sidebar Inspector quick-search (replace with CommandBar in compact mode).

1.7. **Retire `SearchWorkspace` page** — fold its functionality into the sidebar Search tab or a dedicated search-results panel below the command bar. Route `/search` can redirect to `/?search=open` or stay as a full-page search for SEO.

### Relevant Files
- `components/ui/GlobalSearch.tsx` — Current search implementation to extract from
- `lib/search/queryParser.ts` — Reuse directly
- `lib/search/indexes.ts` — Reuse directly
- `components/ui/AppSidebar.tsx` — Sidebar Search tab consumer
- `components/ui/MobileBottomBar.tsx` — Mobile search trigger
- `components/search/SearchWorkspace.tsx` — Candidate for retirement
- `app/[locale]/search/page.tsx` — Route to redirect or keep

### Verification
- All search intents (root, lemma, pos, ayah ref, gloss, text) work identically from header, sidebar, and mobile
- Keyboard navigation (arrows, Enter, Escape) works in all surfaces
- Analytics track which surface triggered each search
- No duplicate search logic remains

---

## Phase 2: Task-Based Onboarding

**Goal**: Replace the 3-step tour with a guided first mission that asks "what do you want to understand?" and drops the user into a preset graph state.

### Architecture

Replace `OnboardingOverlay` + `GuidedWalkthroughOverlay` with a single `FirstRunMission` flow:

1. **Intent selection** (not a tour): "What do you want to explore first?"
   - "Discover the Quran's structure" → opens `surah-distribution` with a highlighted surah
   - "Trace a root word" → opens `root-network` focused on root ر-ح-م with explainer
   - "Inspect a verse" → opens `radial-sura` on Al-Fatiha with ayah 1 selected
   - "Test my knowledge" → opens the daily puzzle (Phase 4)

2. **3-minute mission** (not a tour): Each choice gives a concrete task:
   - Find one root → compare two occurrences → save one note
   - Completing the mission marks onboarding as done and unlocks a "What am I seeing?" panel

3. **"What am I seeing?" explainer** — persistent panel available on every visualization:
   - One-sentence summary
   - Visual legend
   - Interaction hints
   - Why this graph is useful
   - Toggled via a `?` button in the graph toolbar

### Steps

2.1. **Create `components/onboarding/FirstRunMission.tsx`** — Replaces `OnboardingOverlay.tsx`. Renders 4 intent cards on a calm overlay (graph visible behind, blurred). Each card shows a graph thumbnail and a task description. Selecting a card sets `vizMode` + injects preset selection state + shows a task checklist.

2.2. **Create `components/onboarding/MissionChecklist.tsx`** — Floating checklist (bottom-right) that tracks 3 sub-tasks. Updates reactively as user completes each action (search, select, save). Dismisses on completion with a congratulatory flash.

2.3. **Create `components/ui/VizExplainer.tsx`** — "What am I seeing?" panel. Content is static per visualization mode, defined in a config object in `lib/config/vizExplainers.ts`. Shows summary, legend, hints, and purpose. Available to all users (not just first-run).

2.4. **Create `lib/config/vizExplainers.ts`** — Static content for each of the 9 visualization modes:
```ts
export const VIZ_EXPLAINERS: Record<VisualizationMode, {
  summary: string;        // e.g., "A radial map of every word in this surah"
  legend: LegendItem[];   // Color/shape meanings
  hints: string[];        // "Click a token to inspect it"
  purpose: string;        // "Use this to see word frequency patterns"
}> = { ... }
```

2.5. **Refactor `OnboardingContext`** — Replace `experiencePhase: "onboarding" | "walkthrough" | "none"` with `firstRunState: "intent-selection" | "mission-active" | "completed" | "skipped"`. Persist in localStorage under the existing `quran-corpus-onboarding` key.

2.6. **Remove `OnboardingOverlay.tsx` and `GuidedWalkthroughOverlay.tsx`** once `FirstRunMission` is validated.

### Relevant Files
- `components/ui/OnboardingOverlay.tsx` — Replace
- `components/ui/GuidedWalkthroughOverlay.tsx` — Replace
- `lib/hooks/useHomePageController.ts` — Onboarding state (now in OnboardingContext)
- `lib/schema/experience.ts` — Experience level types
- `lib/config/visualizationTypes.ts` — Visualization mode metadata

### Verification
- New user sees intent selection, not a tour
- Each intent drops into correct viz mode with preset selection
- Mission checklist tracks 3 actions and auto-completes
- "What am I seeing?" panel works on all 9 visualizations
- Returning users skip onboarding (localStorage persistence)
- "Replay experience" still works via existing handler

---

## Phase 3: Shell Redesign

**Goal**: Thinner header, journey rail, auto-switching contextual drawer, quieter chrome.

### New Layout Structure

```
┌─────────────────────────────────────────────────┐
│ [Brand]  [═══ Command Bar ═══]  [🌐] [👤]      │  ← Slim top bar
├────┬────────────────────────────────────────┬────┤
│    │                                        │    │
│ D  │                                        │ E  │
│ i  │        Graph Stage (sacred)            │ x  │
│ s  │        VisualizationViewport           │ p  │
│ c  │                                        │ l  │
│ o  │     [Quran > Surah 2 > Root: علم]      │ a  │
│ v  │        ↑ breadcrumb trail              │ i  │
│ e  │                                        │ n  │
│ r  │                                        │    │
│    │                                        │    │
│ R  ├────────────────────────────────────────┤ I  │
│ o  │  [? What am I seeing?]  [Export ▼]     │ n  │
│ o  │        ↑ graph toolbar                 │ s  │
│ t  │                                        │ p  │
│    │                                        │ e  │
│ A  │                                        │ c  │
│ y  │                                        │ t  │
│ a  │                                        │    │
│ h  │                                        │ S  │
│    │                                        │ e  │
│ Q  │                                        │ a  │
│ u  │                                        │ r  │
│ i  │                                        │ c  │
│ z  │                                        │ h  │
│    │                                        │    │
│ S  │                                        │ N  │
│ t  │                                        │ o  │
│ u  │                                        │ t  │
│ d  │                                        │ e  │
│ y  │                                        │ s  │
│    │                                        │    │
├────┴────────────────────────────────────────┴────┤
│  Mobile: [◀ Nav] [🔍 Search] [⚙ Tools]          │  ← Bottom bar
└─────────────────────────────────────────────────┘
```

**Left rail** — 5 intent icons (Discover, Root, Ayah, Quiz, Study). Clicking one sets viz mode presets + opens relevant right drawer tab. Not full pages — they're graph presets with contextual chrome.

**Right drawer** — Auto-switches based on selection:
- Nothing selected → "Explain" tab (VizExplainer)
- Token selected → "Inspect" tab (morphology inspector)
- Root selected → "Inspect" tab (root details + track button)
- Search triggered → "Search" tab (CommandBar results)
- Quiz active → "Quiz" tab (quiz card)
- User explicitly switches → manual override sticks until next selection

**Top bar** — Brand + CommandBar + locale + auth. Nothing else. Export moves to a graph toolbar (floating bar at bottom of graph).

### Steps

3.1. **Create `components/shell/TopBar.tsx`** — Slim header: brand logo (links to home), CommandBar (Phase 1), locale switcher, auth button. Replaces `HomeHeader.tsx`.

3.2. **Create `components/shell/JourneyRail.tsx`** — Left vertical rail with 5 icon buttons:
| Icon | Label | Action |
|------|-------|--------|
| 🔭 | Discover | `vizMode → surah-distribution`, right drawer → Explain |
| ر | Root | `vizMode → root-network`, right drawer → Search (root filter) |
| آ | Ayah | `vizMode → radial-sura`, right drawer → Search (ayah filter) |
| ❓ | Quiz | Navigate to `/quiz` or open quiz panel |
| 📖 | Study | Navigate to `/study` or open study panel |

Uses `VizModeContext.setVizMode()` and `VizControlContext.setRightSidebarOpen()`.

3.3. **Create `components/shell/ContextDrawer.tsx`** — Right panel that auto-switches tabs based on `SelectionContext`:
- Tabs: Explain | Inspect | Search | Notes
- Auto-switch rules:
  - `focusedToken !== null` → Inspect
  - `searchActive` → Search
  - Default → Explain
- Manual tab click sets override flag; override clears on new selection
- Replaces `AppSidebar.tsx`.

3.4. **Create `components/shell/GraphToolbar.tsx`** — Floating bar at bottom of graph:
- Visualization mode switcher (icon dropdown)
- Display settings (theme, color mode)
- Export menu (SVG, PNG, PDF, **Embed** — Phase 5)
- "What am I seeing?" toggle
- Replaces the controls currently in `HomeHeader`.

3.5. **Create `components/shell/AppShell.tsx`** — Composes `TopBar` + `JourneyRail` + `VisualizationViewport` + `ContextDrawer` + `GraphToolbar`. Replaces `HomePageClient.tsx` as the page root. Consumes contexts directly instead of prop drilling.

3.6. **Create `components/shell/MobileShell.tsx`** — Mobile adaptation:
- No journey rail (space constraint)
- Bottom bar with 5 tabs matching rail icons
- Swipe between Discover/Root/Ayah/Quiz/Study
- Pull-up drawer for Inspect/Search/Notes
- Replaces `MobileBottomBar.tsx` + mobile surfaces in `VizControlContext`.

3.7. **Update route `app/[locale]/page.tsx`** — Render `AppShell` instead of `HomePageClient`.

3.8. **Fold study actions into ContextDrawer** — When a root is selected in any visualization, the Inspect tab shows a "Track this root" / "Add note" action. No need to navigate to `/study` to start tracking. `StudyHub` page becomes a review dashboard, not the primary entry for tracking.

3.9. **Move breadcrumbs** — `VizBreadcrumbs` becomes a persistent bar directly above the graph (inside `AppShell`), not inside `HomeOverlayLayer`.

3.10. **Retire `HomeHeader.tsx`, `HomeOverlayLayer.tsx`, `HomePageClient.tsx`, `AppSidebar.tsx`, `MobileBottomBar.tsx`** — once shell components are validated.

### Relevant Files
- `components/home/HomePageClient.tsx` — Replace with `AppShell`
- `components/home/HomeHeader.tsx` — Replace with `TopBar` + `GraphToolbar`
- `components/home/HomeOverlayLayer.tsx` — Decompose into `ContextDrawer` + inline elements
- `components/ui/AppSidebar.tsx` — Replace with `ContextDrawer`
- `components/ui/MobileBottomBar.tsx` — Replace with `MobileShell`
- `components/ui/VizBreadcrumbs.tsx` — Relocate into `AppShell`
- `components/ui/AppModeNav.tsx` — Replace with `JourneyRail`
- `components/home/VisualizationViewport.tsx` — Untouched, re-mounted in `AppShell`

### Verification
- All 9 visualizations render correctly in the new shell
- Journey rail switches viz mode + auto-opens correct drawer tab
- Context drawer auto-switches on token/root selection
- Mobile shell has all 5 intents accessible
- Breadcrumbs work in both hierarchical and chip mode
- "Track this root" works from ContextDrawer without navigating to `/study`
- Export menu works from GraphToolbar
- No prop drilling — all state via contexts from Phase 0

---

## Phase 4: Auto-Generated Quizzes

**Goal**: Add a quiz engine that auto-generates questions from corpus data, with a global daily puzzle and personalized review quizzes.

### Architecture

**Quiz Generator Engine** — pure function library (`lib/quiz/`) that takes corpus tokens + frequency maps + glosses and deterministically produces quiz questions. No manual question authoring. Every question is derived from computed corpus facts, guaranteeing accuracy.

**Question Types** (7 templates, all auto-generated):

| Type | Example | Data Source | Difficulty |
|------|---------|-------------|------------|
| Root frequency | "Root ر-ح-م appears in the Quran ___ times" (4 choices) | `rootFrequencies` | Easy |
| Surah distribution | "Which surah contains root ع-ل-م the most?" | `rootSurahFrequencies` + `SURAH_NAMES` | Easy |
| Root identification | "The word الرحمن comes from which root?" | Token → root mapping | Easy |
| Gloss matching | "Which root means 'mercy / compassion'?" | `ROOT_GLOSSES` | Medium |
| Comparative frequency | "Which root appears more: ح-م-د or ش-ك-ر?" | `rootFrequencies` | Medium |
| Collocation | "Which root co-occurs most with ص-ل-و in the same ayah?" | `calculateCollocations()` | Hard |
| Morphology | "How many verbs derive from root ك-ت-ب?" | Token POS filtering | Hard |

**Accuracy guarantee**: All answers are precomputed from the same `calculateRootFrequencies()` / `ROOT_GLOSSES` / corpus token data that powers the visualizations. No separate data source, no manual curation, no hallucination risk. Distractors are other real roots/surahs, never fabricated.

**Two quiz modes:**

- **Daily Puzzle** — 5 questions (2 easy → 2 medium → 1 hard). Seeded by PRNG with `YYYY-MM-DD` string → same questions for all users on a given day. Shareable results. No auth required. Stored in localStorage.

- **Review Your Roots** — Personalized quiz from user's `tracked_roots`. Prioritizes roots with oldest `last_reviewed_at` (spaced repetition lite). On completion, bumps `last_reviewed_at`. Auth-gated. When user has < 5 tracked roots, fills remaining slots from corpus "discovery" pool.

### Steps

4.1. **Create `lib/quiz/questionTemplates.ts`** — 7 template interfaces, each with:
- `generate(corpus, config) → Question` — produces question + correct answer + 3 distractors + explanation
- `validate(question, answer) → boolean`
- `difficulty: "easy" | "medium" | "hard"`
- Each template specifies required data sources

4.2. **Create `lib/quiz/quizGenerator.ts`** — Seeded PRNG (`mulberry32`, ~10 lines), question selection logic, difficulty balancing. Filters for "quiz-worthy" roots (has gloss, frequency > 10, appears in 5+ surahs). Depends on `calculateRootFrequencies()` and `ROOT_GLOSSES`.

4.3. **Create `lib/quiz/dailyPuzzle.ts`** — Thin wrapper: date seed → 5 deterministic questions. Pure function.

4.4. **Create `lib/quiz/personalizedQuiz.ts`** — Takes `TrackedRoot[]` + corpus, prioritizes stalest `last_reviewed_at`, fills gaps with discovery questions.

4.5. **Create `components/quiz/QuizCard.tsx`** — Single question: prompt, 4 choices, submit, reveal with explanation ("Root ر-ح-م appears 367 times across 83 surahs"). Reuses app card styling.

4.6. **Create `components/quiz/DailyPuzzle.tsx`** — 5-question sequence with progress dots, score, shareable result. Stores completion in localStorage keyed by date.

4.7. **Create `components/quiz/ReviewQuiz.tsx`** — Personalized quiz. On completion, calls `updateRoot()` from `KnowledgeContext` to bump `last_reviewed_at`. Auth-gated.

4.8. **Create route `app/[locale]/quiz/page.tsx`** — Quiz landing with two sections: "Today's Puzzle" (always available) and "Review Your Roots" (auth-gated). Uses `AppWorkspaceShell` layout (or integrates into the new shell's quiz intent).

4.9. **Wire quiz into JourneyRail** — Quiz icon on the left rail navigates to the quiz page or opens a quiz panel in the ContextDrawer (design decision: separate page vs inline panel).

4.10. **Add quiz prompt to study flow** — After tracking a root, suggest "Test yourself on this root" linking to a personalized quiz.

4.11. **Wire `last_reviewed_at` updates** — Personalized quiz completion batch-updates `last_reviewed_at` for all roots that appeared.

### Relevant Files
- `lib/search/collocation.ts` — `calculateRootFrequencies()`, `calculateCollocations()`
- `lib/data/rootGlosses.ts` — `ROOT_GLOSSES` (~200 roots with English meanings)
- `lib/data/surahData.ts` — `SURAH_NAMES` for surah-based questions
- `lib/schema/types.ts` — `CorpusToken`, `PartOfSpeech`
- `lib/context/KnowledgeContext.tsx` — `trackRoot()`, `updateRoot()`, `stats`
- `lib/cache/knowledgeCache.ts` — IndexedDB tracked roots for offline quiz
- `supabase/migrations/003_user_data.sql` — `tracked_roots` table (already has `last_reviewed_at`)
- `components/study/StudyHub.tsx` — Quiz prompt integration
- `components/ui/AppWorkspaceShell.tsx` — Layout wrapper for quiz page

### Verification
- Unit test `quizGenerator.ts`: fixed seed + corpus → deterministic output, every answer verifiable
- Unit test each template: generate 100 questions, verify every correct answer matches corpus data
- Test daily puzzle: same date → same questions across calls
- Test personalized: 3 tracked roots → 3 root questions + 2 discovery
- Manual: complete daily puzzle end-to-end, verify score + localStorage persistence
- Manual: complete review quiz, verify `last_reviewed_at` updates

---

## Phase 5: iframe Embedding

**Goal**: Render any visualization standalone in an iframe with a public API.

### Architecture

**Embed Route** — `/embed/[vizMode]` renders a single visualization in a minimal shell (no header, no sidebar, no auth). Data loaded via existing public API routes. Configuration via URL params. Dynamic updates via postMessage.

**URL-driven configuration:**
```
/embed/root-network?root=ر-ح-م&theme=dark&locale=en&surah=2
/embed/surah-distribution?theme=light&locale=ar
/embed/radial-sura?surah=1&theme=dark
```

**postMessage API:**
```js
// Parent → embed
iframe.contentWindow.postMessage({
  type: 'qcv:config',
  payload: { selectedRoot: 'ع-ل-م', theme: 'light' }
}, '*');

// Embed → parent
window.addEventListener('message', (e) => {
  if (e.data.type === 'qcv:selection') {
    console.log('User clicked:', e.data.payload.root);
  }
});
```

**Security model:**
- `X-Frame-Options: SAMEORIGIN` on all NON-embed routes (protect main app)
- Embed routes set `Content-Security-Policy: frame-ancestors *` (allow embedding anywhere)
- Embed routes strip auth/session handling — read-only, no cookies
- Rate limit via standard infra (Vercel/Cloudflare)

### Steps

5.1. **Create `app/embed/layout.tsx`** — Minimal layout: no header, no sidebar, no i18n provider nesting, no auth. Theme provider + bare HTML. Sets `frame-ancestors *` header.

5.2. **Create `app/embed/[vizMode]/page.tsx`** — Server component: validates `vizMode`, extracts URL params, renders `EmbedClient`.

5.3. **Create `components/embed/EmbedClient.tsx`** — Client component:
- Parses URL params into visualization props
- Loads data via `corpusLoader` (IndexedDB caching) or API routes
- Shims `VizControlProvider` (sidebar always closed)
- Renders visualization full-viewport
- Listens for `postMessage` for dynamic config
- Shows "Powered by QCV" watermark/link

5.4. **Create `lib/embed/embedDataLoader.ts`** — Per-vizMode data fetching:
- `root-network` → `/api/search?q=root:X`
- `surah-distribution` → full corpus via `corpusLoader`
- `radial-sura` → tokens for specific surah
- `collocation-network` → `/api/collocations`

5.5. **Add security headers to `next.config.ts`** — `X-Frame-Options: SAMEORIGIN` default, embed routes excluded.

5.6. **Add "Embed" to GraphToolbar export menu** (Phase 3) alongside SVG/PNG/PDF.

5.7. **Create `components/embed/EmbedCodeModal.tsx`** — Modal with:
- Live preview (small iframe)
- Copyable `<iframe>` snippet with current viz state in URL params
- Width/height controls
- Theme toggle
- "Copy code" button

5.8. **Implement bidirectional messaging in `EmbedClient.tsx`:**
- Inbound: `qcv:config` (update props), `qcv:navigate` (change surah/root)
- Outbound: `qcv:ready` (loaded), `qcv:selection` (user clicked node)
- Validate message structure (not origin — embeds are public)

5.9. **Exclude embed routes from i18n middleware** — Update matcher in `proxy.ts` to skip `/embed/*`.

### Relevant Files
- `components/home/VisualizationViewport.tsx` — Component switcher to reuse
- `lib/export/visualizationExport.ts` — Export patterns to follow
- `lib/corpus/corpusLoader.ts` — Data loading with IndexedDB caching
- `lib/hooks/useZoom.ts` — Zoom/pan (works standalone)
- `lib/config/visualizationTypes.ts` — Validate vizMode
- `next.config.ts` — Security headers
- `proxy.ts` — Embed route exclusion from middleware
- `app/api/search/route.ts`, `app/api/collocations/route.ts` — Public API for data

### Verification
- `/embed/root-network?root=ر-ح-م&theme=dark` loads graph, no chrome visible
- iframe on external HTML page renders (no X-Frame-Options block)
- Main app routes still have `X-Frame-Options: SAMEORIGIN`
- postMessage: `qcv:config` → graph updates → `qcv:selection` fires back
- Embed code modal: copy snippet, paste externally, works
- Lighthouse on embed route: 90+ performance (minimal shell)

---

## Phase Dependency Graph

```
Phase 0 (State Cleanup)
    │
    ├──→ Phase 1 (Unified Search)
    │        │
    │        └──→ Phase 3 (Shell Redesign) ──→ Phase 5 (Embed)
    │                    │
    ├──→ Phase 2 (Onboarding) ─────────────┘
    │
    └──→ Phase 4 (Quizzes) ← can start after Phase 0, parallel to 1-3
```

- **Phase 0** is prerequisite for everything (unblocks context-based consumption)
- **Phase 1** (search) must precede Phase 3 (shell) because the CommandBar is a shell component
- **Phase 2** (onboarding) can run parallel to Phase 1, but must land before Phase 3 (shell renders FirstRunMission)
- **Phase 3** (shell) must precede Phase 5 (embed) because embed reuses the GraphToolbar export menu
- **Phase 4** (quizzes) depends only on Phase 0 and can run in parallel with everything else

---

## Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| State decomposition approach | 4 new contexts + backward-compat wrapper | Incremental migration, no big-bang rewrite |
| Search retirement | Fold `/search` into sidebar, keep route for SEO | Reduces maintained surfaces from 5 to 1 model |
| Onboarding model | Task-based mission, not tour | Tours teach tool mechanics; missions teach goals |
| Journey rail vs tabs | Vertical rail (desktop), bottom tabs (mobile) | Rail preserves horizontal graph space |
| Context drawer auto-switch | Selection-driven with manual override | Reduces clicks; override prevents frustration |
| Quiz accuracy | Same data powering visualizations | Zero drift, zero manual curation |
| Daily puzzle seed | Date-string PRNG (deterministic) | Shareable, debuggable, spoiler-proof |
| Embed auth | Fully public, no API key | Maximizes adoption; rate-limit via infra |
| Embed data | Fetches via existing public API + corpusLoader | No new backend work |
| ROOT_GLOSSES bottleneck | Accept ~200 root coverage for now | Expanding glosses is a separate data effort |
| Mobile navigation | Bottom tab bar with 5 intents | Matches iOS/Android navigation patterns |
| Study integration | Track root from ContextDrawer, `/study` becomes review dashboard | Embeds study into exploration flow |

---

## Scope Boundary

**In scope**: Shell redesign, state cleanup, unified search, task-based onboarding, viz explainer panels, auto-generated quizzes (daily + personalized), iframe embedding with postMessage API, embed code generator.

**Out of scope**: Leaderboards, streaks, social features, tafsir integration, new visualization types, Supabase schema changes beyond existing columns, mobile app (PWA is sufficient), accessibility audit (separate effort), performance optimization (separate effort), expanding ROOT_GLOSSES coverage.

---

## Validation: 5 Core Tasks

Every design decision should be validated against these 5 user journeys:

1. **First search** — New user opens app → sees intent selection → picks "Trace a root" → command bar auto-focuses → types root → sees result in graph → mission checklist updates
2. **First root trace** — User clicks a root node in any graph → ContextDrawer auto-switches to Inspect → shows root details + gloss + frequency + "Track this root" button
3. **First ayah inspection** — User navigates to a surah → selects ayah → dependency/morphology view loads → inspector shows token details with plain-language explanation
4. **First saved note** — User clicks "Track this root" → adds note → note appears in Study dashboard → personalized quiz includes this root
5. **First return session** — User returns next day → daily puzzle available → previous tracked roots visible → recent exploration context restored → no onboarding (completed)
