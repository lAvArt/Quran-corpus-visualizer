# Visualization Architecture

Reference map of the graph/visualization surface: routes, components, shell anatomy,
state, and the UX-debt ledger. Written so nobody has to re-derive this from the code.
Line numbers drift — anchor by symbol/class names when navigating.

_Last full audit: 2026-07-18 (branch `feature/viz-declutter`)._

## Routes & deep links

| Surface | URL pattern | Notes |
| --- | --- | --- |
| Observatory (full shell) | `/{locale}/?viz={mode}&surah=&ayah=&root=&lemma=&token=` | Home page becomes AppShell when viz/selection params present. Deep-link hydration in `AppShell.tsx` (`useSearchParams` → `handleSearchResultNavigate`). |
| Embeds (standalone) | `/embed/{mode}?surah=&root=&theme=` | `app/embed/[vizMode]/page.tsx` → `components/embed/EmbedClient.tsx`. postMessage protocol: `qcv:config`, `qcv:selection`, `qcv:ready`. Modes needing full corpus: `surah-distribution`, `corpus-architecture`, `knowledge-graph`. |

Example deep links: `/en?viz=radial-sura&surah=2`, `/en?viz=collocation-network&root=علم`
(URL-encode Arabic in scripts). Root params are corpus root keys — plain-alif forms,
see `docs/DATA_SOURCES.md` and the hamza-normalization note in `lib/corpus`.

## The nine modes

All in `components/visualisations/`. Each renders its own left-panel cards through
the sidebar portal (see Shell anatomy).

| Mode id | Component | What it draws |
| --- | --- | --- |
| `radial-sura` | `RadialSuraMap.tsx` | Every word of one surah on a ring; per-ayah bars, root-connection curves, center annotation. Has zoom LOD (below). |
| `root-network` | `RootNetworkGraph.tsx` | Orbital system: root "planets" on canvas-scaled orbits (1 ring ≤24 roots, 2 frequency bands above) with lemma "moons" hugging their root; stellar-core center; sim pre-ticks before paint (no settle tangle); root-limit slider (advanced). |
| `arc-flow` | `ArcFlowDiagram.tsx` | Grouped arc fan (group by root/POS/ayah) with frequency bars; root-mode arcs = ayah co-occurrence (weight = shared verses, scope-normalized widths, hover tooltip). |
| `dependency-tree` | `AyahDependencyGraph.tsx` | Per-ayah syntax tree with labeled dependency arcs; surah/ayah stepper controls in sidebar. |
| `sankey-flow` | `RootFlowSankey.tsx` | Root → word-form ribbons for the scoped surah; on-canvas chips carry scope/coverage. |
| `surah-distribution` | `SurahDistributionGraph.tsx` | All 114 surahs, x = surah index, dot = surah (revelation place color, size = ayahs). |
| `corpus-architecture` | `CorpusArchitectureMap.tsx` | Corpus → surah → root structure map with root search. |
| `knowledge-graph` | `KnowledgeGraphViz.tsx` | Personal tracked-roots network; ghost/empty state when nothing tracked. |
| `collocation-network` | `CollocationNetworkGraph.tsx` | PMI-weighted collocates orbiting a target root; "Heuristic estimate" badge = derived, not corpus-annotated. Strongest default view of the nine. |

Mode switching: `components/ui/VisualizationSwitcher.tsx` (grouped by intent,
beginner/advanced toggle) inside `components/shell/GraphToolbar.tsx`.

## Shell anatomy (AppShell)

`components/shell/AppShell.tsx` composes, around `components/home/VisualizationViewport.tsx`:

- **TopBar** (`shell/TopBar.tsx`) — brand, CommandBar search, language, auth.
- **StatusBar** (`shell/StatusBar.tsx`) — corpus load state + breadcrumb pill (top center).
- **Left dock** (desktop ≥981px) — ONE glass container `.viz-dock` fusing two flex
  children: the JourneyRail spine (68px; `inDock` prop strips its standalone chrome)
  and the info column (`.viz-sidebar-stack`, ~256px; keeps that class — `fitToView`
  and portals depend on it). Spine groups: "Views" (Overview → surah-distribution,
  Roots → root-network, Surah → radial-sura) and "Pages" (Search/Study/Quiz links),
  each button with a `title` hint. A chevron at the spine bottom collapses the dock
  to spine-only; state persists in localStorage `quran-corpus-left-dock`.
  `lib/viz/fitToView.ts` measures `.viz-dock` (fallback `.viz-sidebar-stack`) for
  occlusion. Below 981px the dock is `display: contents`: the rail becomes the
  horizontal top strip and the panel is reached via MobileBottomBar, as before.
  JourneyRail is ALSO used standalone (no dock) by `ui/AppWorkspaceShell.tsx` on
  search/study/quiz pages — dock styling is scoped to `.in-dock`, don't leak it.
- **Info column content** — per-viz cards via portal target `#viz-sidebar-portal`.
  Each viz renders a `sidebarCards` block into it. Contract after the declutter pass:
  **≤1 functional card (real controls only) + 1 encoding-only legend (≤5 one-line rows)**.
  No interaction instructions, no Zoom % / token-count / scope rows duplicated elsewhere.
- **Right ContextDrawer** (`shell/ContextDrawer.tsx`) — tabs Explain / Inspect / Search / Index.
  Explain renders `ui/VizExplainer.tsx` (claim, legend, numbered hints, purpose) —
  the single home of "how to read this view". Inspect hosts
  `inspectors/MorphologyInspector.tsx`. Auto-switches to Inspect on token focus.
  Starts collapsed until a selection or explicit open (chip / edge handle).
- **GraphToolbar** (bottom, floating) — LexicalColorSwitch · VisualizationSwitcher ·
  DisplaySettingsPanel · VizExportMenu.
- **Intro chip** (`ui/VizIntroCard.tsx`) — small "How to read this view" pill under the
  breadcrumb; opens drawer → Explain. Per-mode dismissal in localStorage
  `quran-corpus-viz-intro`. (Was a center-screen overlay card before 2026-07;
  do not reintroduce overlays over the canvas.)
- **Mobile**: `ui/MobileBottomBar.tsx` (Show Legend / search / Show Tools) above the
  toolbar; marketing `ui/Footer.tsx` is hidden on mobile for the observatory view.
- **Onboarding**: `onboarding/FirstRunMission.tsx` (intent selection; suppresses intro chip),
  `MissionChecklist.tsx`.

State: `VizControlContext` (mode, selection, panels, `isRightSidebarOpen`).
Theme cookie `quran-corpus-theme`; viz prefs localStorage `quran-corpus-viz-state`;
onboarding localStorage `quran-corpus-onboarding`.

## Cross-cutting mechanics

- **Radial LOD** (`RadialSuraMap.tsx` top constants): surahs > `OVERVIEW_WORD_THRESHOLD`
  (800 words) render hairline per-ayah ticks; zooming past `DETAIL_ZOOM_THRESHOLD` (2.2×)
  swaps ticks → full word bars in place. Small surahs always render full detail.
  Initial fit-to-ring runs for **all** surah sizes (small-surah overflow was a bug, fixed).
- **Corpus data streams in — for real now.** `lib/corpus/sampleCorpus.ts` provides a
  tiny stub before real data lands, and `loadFullCorpus({ onBatch })` emits ~12 batches
  of WHOLE surahs (10/batch, ascending; never a partial surah — both Supabase and
  Quran.com paths; cache hits stay one-shot). `useCorpusData` streams `deepTokens`
  per batch and drives real loading progress. Consequences: any effect that measures
  geometry and then locks itself (entry fits, initial focus, one-shot layout) must
  gate on complete data (`isSurahDataComplete` in `RadialSuraMap.tsx`,
  `isScopeDataComplete` in `ArcFlowDiagram.tsx`), and components seeing the growing
  array re-render per batch — keep per-batch work cheap. Corollary: NEVER mutate
  user-chosen state from data-derived values (root-network's limit clamp ratcheted the
  slider to 5 because the surah-2 stub has 3 roots — clamp at use time via
  `Math.min(userValue, derivedMax)` instead). The structure map renders a
  static 114-surah skeleton (angles from `SURAH_NAMES`, fixed from first paint) and
  reveals root branches per batch with a CSS opacity stagger (once per arrival,
  tracked in a ref; instant under reduced motion).
- **Fit-to-view** (`lib/viz/fitToView.ts`) — shared fit helper, chrome-aware on all four
  sides: left dock (`.viz-dock`/`.viz-sidebar-stack`), right ContextDrawer when open
  (`.context-drawer`, aspect-ratio-guarded so the mobile bottom-sheet variant doesn't
  count as an inline inset), StatusBar pill top, GraphToolbar bottom. LTR/RTL aware;
  joint clamps keep ≥40% width / ≥55% height free. Any new viz should use this rather
  than raw viewport math.
- **Per-tick geometry must be plain SVG** (the collocation pattern). Anything whose
  transform/`d` changes every simulation tick renders as plain `<g>`/`<path>` — React
  patches them in one fast commit. framer-motion is reserved for decorative elements
  whose geometry doesn't tick (pulse rings, sun breathing) and for ONE layer-level
  entrance/settle fade per layer (keyed by topology, namespaced sibling keys). Wrapping
  each node/edge in `motion.g` caused bursty frame pacing users read as "wires lagging"
  (measured: 78.6%→94.4% frame-advance under 2× CPU throttle after the fix).
- **Never `transition: all` on classes applied to SVG geometry.** In Chromium, `d`,
  `cx/cy`, `x/y` are CSS-animatable presentation attributes, so `all` makes the browser
  EASE every per-tick geometry write — DOM attributes update instantly (probes reading
  attributes see 0 gap) while the render trails by the transition duration (users see
  rubber-band wires; measured 8px sustained gap in 86% of drag frames before the fix,
  0.00px after). Use explicit property lists (stroke, stroke-width, fill, opacity,
  filter, transform-for-hover) — see `.edge`/`.node-circle`/`.radial-arc` in
  `styles/dark-theme.css`. Key edges by pair identity, never array index.
- **Selection is global and bidirectional.** `useSelectionState` (via
  `useHomePageController`) owns surah/ayah/root/lemma; every mode ADOPTS the shared
  root/surah when the prop changes (ref-track the previous prop; adoption never calls
  the write-back) and WRITES BACK explicit user picks (click/blur/Enter/change only —
  never hover) via `onRootSelect`-style callbacks. Explicit picks re-lock
  `searchLockedRoot` (they are authoritative). The URL mirrors
  `{viz, surah, ayah, root, lemma}` via debounced `window.history.replaceState`
  (never `token`), gated on deep-link hydration completing; the controller's own URL
  writes are deduped against Next's `useSearchParams` echo via
  `lastAppliedParamsRef` — keep that guard when touching either side.
- **Category colors must be theme-stable.** Never bind categorical encodings to
  `--accent`/`--accent-2`: those swap hues between light and dark themes.
  Use dedicated tokens (`--viz-cat-makki`, `--viz-cat-madani` — teal family / amber family
  in both themes; light values in `app/[locale]/globals.css` :root, dark in
  `styles/dark-theme.css`). Add new `--viz-cat-*` tokens for any future categorical scale.
- **Screenshot harness**: `npx tsx scripts/ux-shots.ts --base http://localhost:PORT
  --routes "en?viz=radial-sura&surah=2,..." --viewports desktop,mobile --themes dark
  --out .ux-shots/NAME` — quote the routes arg (contains `&`), no leading slashes,
  URL-encode Arabic. Sets theme cookie + suppresses onboarding automatically.
- **i18n**: every viz string is a next-intl key (en + ar). Explainer copy:
  `VizExplainer.{mode}.*` in `messages/en.json` / `ar.json`; how-to-read step keys listed
  in `lib/vizExplainers.ts`. Interaction hints must say "hover **or tap**" (touch).

## Cognitive-load ladder (2026-07-18)

Search-to-graph escalation is deliberately staged; keep new features on a rung:

1. **Home root profile** (`MinimalHome` ResultPanel) — count, gloss, 114-bar
   strip, top-5 surahs. Primary CTA "See it in context" → radial-sura scoped
   to the root's top surah; network is the explicit secondary CTA.
2. **Calm entry** — home root CTAs append `entry=calm`; AppShell's deep-link
   hydration collapses the left dock to its spine (one-shot, NOT persisted —
   `skipNextDockPersistRef`) and skips the drawer auto-open
   (`actionTarget.calmEntry` through `handleSearchResultNavigate`). The flag
   is consumed on arrival; the controller's URL mirror drops it.
3. **Focused root-network** — arriving with a `highlightRoot` renders only
   that root + its 8 strongest verse-mates (`isFocusEntry` in
   `RootNetworkGraph`; ayah co-occurrence within scope). Escalation is the
   always-visible "Show full network N/M" pill (fixed bottom-center — the
   sidebar focus card is hidden while the dock is collapsed) with a one-shot
   `qcv-attention-pulse` (globals.css). Re-arms per new highlighted root.
4. **Full field** — the root-limit slider (default 30). A highlighted root
   outside the top-N slice is force-included so search never points at nothing.

Related mechanics added the same day:

- **Staged overview LOD (radial)**: overview stages keyed to the ENTRY-FIT
  scale (`overviewBaseScaleRef`), not absolute zoom — stage 1 (1.6×base) top-8
  roots' arcs, stage 2 (2.6×base) full faint mesh (capped 400 paths);
  highlighted-root arcs + count-scaled match ticks + ayah milestones at every
  stage. Pattern: never reveal on one cliff; each zoom step earns structure.
- **Sticky node drag (root-network)**: d3-drag subject carries node x/y (grab
  offset), drop keeps fx/fy (no orbit snap-back), dblclick unpins. Never null
  fx/fy on drag end while a strong radial force exists.
- **Streaming honesty**: inspector occurrence card shows a pulsing "still
  counting" cue while `isLoadingCorpus` (prop chain AppShell → ContextDrawer →
  MorphologyInspector); StatusBar shows N/114 · % with a sheen.
- **TopBar geometry**: banner + centered search slot share one explicit height
  (58px, pill capped 46px). Never let the two grow independently from content.
  The centered dock widens to min(680px, 32vw) at ≥1800px viewports.

## UX-debt ledger

Findings from the 2026-07-11 all-modes audit (screenshots in `.ux-shots/`, gitignored).

Fixed in `feature/viz-declutter`:

- Center intro overlay covered every canvas on entry (incl. `surah=` deep links — the old
  suppression only checked `root`/`token`) → replaced by the intro chip + drawer Explain.
- Left-panel text walls: duplicated titles/eyebrows, Zoom %/token-count debug rows,
  interaction-state legend rows, sankey scope stats duplicated against canvas chips.
- Right drawer opened by default as an empty 380px column ("What am I seeing?" collapsed).
- Mobile: mode-select label hidden ≤420px (icon-only primary control); marketing footer
  stacked a third bottom bar; "hover" copy on touch.
- Makki/Madani colors flipped semantics between themes (bound to accent tokens).
- Radial small-surah ring overflowed (no entry fit); dependency tree clipped under the
  floating panel (fitToView ignored it).
- Inspector led with "Translation not available for this form" as the hero subtitle;
  demoted to a muted row in the morphology grid.
- Icon rail and info panel were two disconnected floating boxes; rail mislabeled its
  view-switchers (e.g. "Ayah" opened the surah-level radial) and mixed them with page
  links unlabeled → unified left dock with "Views"/"Pages" groups, honest labels
  (Overview/Roots/Surah), tooltips, and a spine-collapse replacing the edge handle.
- root-network was a clumped ring hairball (radial pin at fixed 80/150px, invisible
  edges, all-nodes labels) → orbital planets/moons redesign; sim pre-ticks before
  paint so no wire tangle; blurry center blob → 48px eased-gradient stellar core;
  perceived wire-drag lag root-caused to per-element framer-motion wrappers on all
  per-tick geometry → plain SVG + layer-level fades (see the plain-SVG rule above).
- arc-flow drew zero arcs: links were "roots sharing a lemma", impossible in this
  corpus (a lemma belongs to one root) → ayah co-occurrence links (audited exact:
  surah 12 top pair اله|قول = 25 shared verses; corpus-wide 514); saturating
  width cap → scope-normalized sqrt widths; weights exposed via hover tooltip/aria.
- Fits ignored top/bottom/right chrome → fitToView now measures all four sides
  (breadcrumb pill, graph toolbar, open drawer).
- Selection was inconsistent across graphs (arc-flow/collocation kept stale local
  roots, sankey/knowledge-graph siloed, explicit clicks swallowed by the search lock,
  URL never reflected in-app picks) → global bidirectional selection + URL mirroring
  (see the "Selection is global" rule above).
- Structure map zoom stalled (155-204ms frames, p95 up to 2s, focused) → zoom-state
  commits quantized (0.25 scale buckets + 120ms floor; transform stays imperative
  per tick) and root labels admitted by screen-space separation (rank-priority
  greedy, ≥15px along the fan, hovered/selected exempt-as-blockers; more labels
  admitted as zoom deepens) → 20-30ms avg, overlap-free labels. Pattern to reuse:
  never re-render per zoom tick; commit LOD state on settle/threshold only.
- Structure map was one-shot and heavy → static 114-surah skeleton paints in ~1.2s
  (was 35-65s to first structure on cold loads), root branches stream in per batch
  with a staggered reveal; hover sets memoized, labels view-culled, token-reference
  churn stabilized (−21% frame time at overview pre-streaming). True overview element
  count is ~8,810 (5,604 is the focused-surah state — earlier probes measured focus
  due to a phantom unfocus click, since fixed).

Fixed 2026-07-18 (same branch; verify suite green, data-audit agent re-confirmed all
displayed counts against fresh recomputation from the raw morphology file):

- knowledge-graph embed crash → `components/embed/EmbedProviders.tsx` ("use client",
  AuthProvider→KnowledgeProvider, same nesting as app/[locale]/providers.tsx) mounted in
  app/embed/layout.tsx; guest/IndexedDB path, verified live (ghost network + empty state).
- MorphologyInspector light theme → all ~57 hardcoded dark colors tokenized
  (var(--ink/--accent/--panel/--line) + color-mix tiers; component-scoped --mi-* props
  with [data-theme="light"] overrides for lavender/error tones). Verified legible.
- seed-corpus.ts aligned to first-root-wins (matches morphologyLoader; the one
  divergent word 20:94:2 now resolves identically in both pipelines).
- VizExplainer legend chips localized: `LegendItem.label` → `labelKey`
  (`VizExplainer.<mode>.legend.*` in en+ar). Same pass: the Makki/Madani drawer
  swatches were bound to --accent/--accent-2 (theme-unstable) → now --viz-cat-*.
  Also removed a DUPLICATE top-level "VizExplainer" JSON block in both message files
  (first block was dead — later key wins on parse).
- ar.json hygiene: 9 mojibake strings ("???") restored, 15 untranslated-English
  strings translated (collocation controls, GlobalSearch aria), CommandBar +
  SemanticSearchPanel placeholders wrap Latin prefix operators in LRI/PDI isolates
  (⁦…⁩) so RTL ordering stays sane.
- Stale "Structural Map" heading bleed → RadialSuraMap's legacy `panel-head` +
  `viz-controls` blocks removed (RootNetworkGraph had already dropped its own);
  breadcrumb/center annotation/Explain drawer carry that content. Verified mobile+RTL.
- sankey ribbons → sqrt width scale [1.5,16]px + deterministic per-root hue tint
  (base opacity 0.4, emphasis 0.85/dim 0.15) in the default color mode; node chips
  strengthened. Verified.
- arc-flow baseline "swoosh" (64px decorative var(--line) stroke, zero encoding)
  removed. Verified.
- dependency-tree initial placement migrated to shared fitGraphToView (chrome-aware),
  gated on surah-data completeness, refits on ayah/surah nav only; user pan/zoom no
  longer reset by resize. Long-ayah caveat below.
- Dictionary links: root badges now fold every alif/hamza carrier to أ
  (`toCitationRoot` in MorphologyInspector) before linking — hamza-family roots
  (امن→أمن) land on real Almaany/Doha pages; lemmas keep true orthography.
- d3 imports: all viz files + fitToView/useZoom now import from the curated barrel
  `lib/viz/d3.ts` (12 submodules re-exported; d3-transition side-effect included).
  RULE: never `import * as d3 from "d3"` again — add missing submodules to the barrel.
- Dead deps removed: tesseract.js, @use-gesture/react (zero imports).

Known, deliberately deferred (next iterations):

- Lemma glosses missing for many forms ("Translation not available") — data gap, see
  hamza normalization note in `docs/DATA_SOURCES.md`; affects inspector hero content.
- The "How to read this view" chip can transiently overlap sankey's canvas scope pills
  (both sit top-center; chip auto-fades after 8 s).
- Light theme: the "Selected / contains selected root" legend swatch is near-identical
  to the Makki teal — selected state relies on the canvas ring/glow to disambiguate.
- **Unscoped (entire-Quran) arc-flow/root-network views are unreachable**: `selectedSurahId`
  is a non-nullable number defaulting to 1 everywhere (`useSelectionState`, embeds), though
  components support a null scope. Decide whether to expose a corpus scope.
  (Corollary: the corpus-wide 514 اله|قول arc weight is computed correctly but never
  reachable through the UI.)
- Arc weights are never shown numerically beyond the hover tooltip.
- Dependency-tree on very long ayahs (2:255, 50 tokens): the shared fit is bounded by
  the zoom scaleExtent floor (0.4), so the token row still overflows horizontally and
  needs panning — full fix is a wrapped/multi-row layout, not a smaller scale (text
  would be illegible). Deep links with `ayah=` intentionally focus the ayah's first
  token (resolveFocusedTokenIdForSelection) so the Inspect drawer has content — that
  root chip in the breadcrumb is by design, not a stray write-back.
- Embed knowledge-graph empty-state card uses a light panel on the dark embed theme —
  legible but washed; tokenize if embeds get a theme pass.
- The learning loop is real (2026-07): inspector "Track this root" is a state-aware
  toggle on useKnowledge() (tracked → success outline, click to untrack); "Quiz me on
  this root" navigates to /quiz?root=… which renders a root-scoped quiz
  (generateRootQuiz, lockedRoot option, template-type dedupe, bounded distractor
  loops — a hapax root used to hard-freeze the tab) with a Track CTA on completion.
  Knowledge-graph empty state has i18n copy + Browse-roots/Open-Study CTAs (CTAs only
  when onExploreRoots is wired — hidden in embeds), legend suppressed only when
  !loading && empty. NOTE: knowledge-graph was missing from BEGINNER_PRIMARY_MODES
  (useVizModeState.ts) — the mode silently snapped back to radial-sura for beginner
  users; fixed. Quiz Finish buttons are in-flight-guarded (double-fire recorded
  sessions twice).
- Dictionary links (Almaany/Doha, restored into the inspector) pass the raw corpus
  root form (plain alif) — both sites land on their search page for non-citation
  forms; if lookups miss for hamza-family roots (امن vs أمن), consider mapping to
  citation orthography before linking.

## Review checklist for viz changes

Both themes (categorical colors identical semantics), RTL `/ar`, reduced motion,
mobile 390px (toolbar fits, no third bottom bar), no canvas-covering overlays,
legend = encodings only, any displayed count traceable to `lib/corpus`/`lib/search`
(when in doubt run the `data-auditor` agent), re-run `scripts/ux-shots.ts` before/after.
