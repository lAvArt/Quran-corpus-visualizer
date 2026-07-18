# Design Brief: "Quran Corpus Visualizer" — an Observatory for the Language of the Qur'an

You are designing high-fidelity UI mockups for a web app that lets people explore the linguistic structure of the Qur'an through interactive data visualizations. Treat this as an "editorial data-art / scientific-viz observatory," NOT a generic SaaS dashboard. The visualizations are luminous data-art on near-black; the surrounding interface is quiet, precise and reverent and must recede so the graph is the hero.

## 1. Product in one line
An interactive observatory for Quranic linguistics — surahs, ayahs, tokens, roots (e.g. ر-ح-م "mercy"), lemmas, glosses, parts of speech and collocations — explored through nine custom visualizations, plus search, a personal study loop, and quizzes.

**Three personas to satisfy at once:**
- **Curious newcomer** — no Arabic; wants a beautiful, guided "show me something interesting" path. Needs plain-language explainers and a single obvious starting action.
- **Arabic student** — learning morphology; tracks roots, takes quizzes, reads glosses and dependency structure. Needs the study/quiz loop tight and in-context.
- **Researcher** — wants precise search (root:/lemma:/pos:/ayah:/gloss:), dense networks, exports, and honest data-provenance signals.

## 2. Design goal & principles
Rework the experience to be dramatically MORE user-friendly while keeping the visualizations as the emotional core.
- **Task-first, not feature-first.** Entry asks "what do you want to understand," not "here are 9 chart types."
- **One command bar** for all search (today it is duplicated across 8 surfaces — collapse to one).
- **Context-reactive chrome.** A single right drawer auto-switches Explain → Inspect → Search → Notes based on what's selected; nothing else competes.
- **Quieter shell, louder graph.** Default to viewport + one slim top bar + a compact rail; reveal panels on demand or on first selection. The unobstructed graph area must be large.
- **Progressive disclosure.** Beginners see one default viz per intent; advanced controls appear with experience.
- **Reverent & precise.** Calm, dark, observatory mood — never busy, never "dashboardy."

## 3. The visual language

**Mood:** near-black scientific poster; fine 1px threads, dense radial bar-rings, Sankey ribbons and force-networks of small luminous nodes; color used strictly as DATA encoding with tiny annotated legends — think Accurat / Densitydesign / Felton.

**Dark palette (PRIMARY / hero):**
- Canvas `#070708` → panels `#0d0d11` → raised `#15151b` → hairline borders `rgba(255,255,255,0.07)`.
- Ink `#F3F1E8`, secondary `rgba(243,241,232,0.72)`, muted `rgba(243,241,232,0.55)` (raise muted opacity until ≥4.5:1 on `#0d0d11`).
- Subtle radial "atmosphere" glow behind the stage at ~3–5% opacity; an optional 1px grid + low-opacity halftone dot texture (≤4%).

**Data-encoding accent spectrum** (a legend reading against black — vibrant but controlled, never decorative): teal/cyan `#22D3EE`, magenta/pink `#F472B6`, violet/indigo `#8B7BFF`, amber/orange `#F9A03F`, coral-red `#FF6B6B`, lime-green `#9BE15D`. Reserve ONE dedicated selection/highlight color (e.g. a bright near-white cyan ring) that is excluded from the data palettes so a selected node never collides with an encoded hue.

**Light palette (secondary — a calm reading mode):** cream/parchment `#F7F3EA` → `#EFE6D6`, ink `#1F1C19`, teal accent `#0F766E`. Same components, lower-energy; for long reading/printing of ayah text. Dark is the identity; light is opt-in.

**Typography:**
- UI / Latin: geometric grotesque (Space Grotesk). Micro-labels, kickers and legends are UPPERCASE with generous letter-spacing (0.12–0.18em). Large light-weight numerals as accents (counts, "367×", "83 surahs").
- Display: Fraunces (high-contrast serif) for screen titles and big editorial numerals.
- Arabic: elegant naskh (Amiri / Scheherazade-class), larger size and ~1.8–1.9 line-height, always `dir="rtl"`, one canonical fallback chain.
- **Type scale tokens:** display 40/48, h1 30, h2 22, h3 18, body 15, caption 13, overline 11 (uppercase, tracked). Pair each with a line-height.

**Tokens to define and SHOW in the style tile** (the codebase currently lacks all of these): radius `xs 6 / sm 10 / md 14 / lg 20 / pill 999`; spacing 4px base (4/8/12/16/24/32/48); elevation `shadow-1..3` + `shadow-glow`; blur `sm 8 / md 16 / lg 24`; z-ladder base/sticky/header/overlay/toast/modal.

**Motion:** slow, settling, observatory-like — fade + gentle scale, 180–260ms, eased. Network/Sankey settle into place rather than snap. Everything must honor reduced-motion (fade-only, no slide/scale).

## 4. Information architecture & navigation
- **Left journey rail (desktop):** five INTENTS, icon + label, with active state — **Discover, Root, Ayah, Quiz, Study**. Separate "what I'm looking at" (viz presets behind an intent) from "where I am" (app section). Collapses to a slim icon rail that expands on hover.
- **Mobile:** the same five as a bottom tab bar (≥44px targets); search is a full-screen modal launched from the bar.
- **Slim top command bar:** brand monogram (left), ONE global search field (center, ⌘/Ctrl-K), language + theme + account (right). This is the single search entry point everywhere.
- **Right context drawer (auto-switching):** tabs **Explain / Inspect / Search / Notes**. Focus a token → Inspect; run a search → Search; default → Explain. Persistent labeled edge handle visible at tablet widths too (not a tiny "Show tools" text toggle).
- **Floating graph toolbar (bottom-center):** viz switcher, display settings (incl. the lexical color-mode toggle), zoom/reset cluster, export. Co-locate the color-mode toggle with the legend.
- **Breadcrumb/status bar above the stage:** ONE canonical renderer — Qur'an › Surah › Ayah › Root, clickable to drill up, plus a quiet status/loading chip. (Today there are three breadcrumb renderers; ship one.)

## 5. Screens & states to mock (desktop 1440 + mobile 390 unless noted)

**(a) Explore / Home — first run.** Hero visualization (Radial Surah Map of Al-Fātiḥah) full-bleed on near-black; slim top command bar; collapsed journey rail; ONE focal first-run "mission" card overlay asking "What do you want to understand?" with 4 intent cards (Discover structure / Trace a root / Inspect a verse / Test knowledge). Everything else dimmed/sequenced — no six docks at once. Include the floating mission checklist (3 task-specific steps that end in a real outcome, e.g. "Track the root ر-ح-م → see it in Study").

**(b) Explore — token selected → Inspector.** Same stage with a token highlighted (reserved selection ring). Right drawer open on **Inspect**: morphology card (Arabic token, transliteration, root ر-ح-م, lemma, POS, gloss "mercy", occurrence count), and a primary **Track this root** action plus "Quiz me on this root" — proving study happens in-context. Show a legend with an explicit caption "Color = part of speech."

**(c) Unified command-bar search.** Command bar focused with grouped results (Ayah / Surah / Root / Lemma / Token / Gloss / Semantic-AI with an "AI" badge + disclaimer line). Each row shows that selecting it routes to the right viz (e.g. ayah → Ayah Dependency, root → Root Network). Include the parsed-intent badge and a discoverable `?` revealing `root: lemma: pos: ayah: gloss:` syntax. Keyboard-nav highlighted row visible.

**(d) "What am I seeing?" explainer.** Right drawer on **Explain** for Collocation Network: one-line purpose, a legible legend whose swatches MATCH the on-canvas colors, a plain-language "how to read it," and a "Color = root frequency" caption when in frequency mode. Note a "sample ayah / heuristic" provenance chip where data is partial (e.g. Ayah Dependency).

**(e) Study dashboard.** Leads with the ACTION: "Review next" card + "Add your first root" empty state at top; tracked-roots list with state pills (learning/learned) and notes; stats strip demoted below. Anonymous users see it read-only with a gentle "sign in to sync" upsell — NOT a login wall.

**(f) Quiz — daily puzzle.** Quiz card: progress dots, Arabic + gloss question, answer options, per-question reveal with factual explanation ("appears 367× across 83 surahs"), difficulty pill. Plus a real RESULT screen: score, list of missed questions with correct answers, "Retry" and "Study these roots" handoff, streak.

**(g) Mobile:** home (hero viz + bottom tabs + minimal top bar), full-screen search modal (grouped results), bottom tab bar. Show an on-canvas collapsible legend/controls sheet so the legend is never hidden off-screen on phones.

**(h) Iframe embed minimal shell.** A single viz (Root Flow Sankey) full-viewport, zero chrome, tiny corner attribution + legend only — the public embeddable artifact.

**(i) Light reading mode variant.** One screen (Explore with Radial Surah Map) in the cream/parchment theme to show the calm reading alternative.

For all viz screens: render the desired LOOK — fine 1px threads, small luminous nodes, dense radial rings, Sankey ribbons, RTL dependency arcs on near-black with crisp annotated legends — but note the underlying D3 components are KEPT; only their chrome/legend/empty/loading/selection treatments are being unified. Reference the real viz names: Radial Surah Map, Root Network, Collocation Network, Root Flow Sankey, Ayah Dependency, Surah Distribution, Arc Flow, Knowledge Graph, Corpus Architecture.

## 6. Component inventory to design
Command bar (with intent badge + syntax hint); journey-rail item (collapsed + expanded, active); context-drawer tab set (Explain/Inspect/Search/Notes); morphology inspector card; root/token/lemma chips; viz switcher (grouped by intent with one default each); floating graph toolbar + zoom/reset cluster; canonical legend (theme/frequency/identity captions); mission card + floating checklist; quiz card + result screen; status/breadcrumb bar; buttons / inputs / selects / pills (ONE vocabulary); empty, loading ("settling"), and error states as a shared family; provenance/"sample data" chip; AI-assisted badge + disclaimer.

## 7. Arabic / RTL & accessibility requirements
- Full RTL mirror for Arabic (rail, drawer, toolbar, breadcrumbs all flip via logical layout, not hardcoded left/right). Arabic in elegant naskh, generous leading; inline Arabic inside English UI stays `lang="ar" dir="rtl"`.
- WCAG AA contrast on the dark palette — verify every accent-as-text and white-on-accent button; provide a tested high-contrast dark variant.
- Visible 2px focus rings on all interactive elements; full keyboard nav incl. command bar and viz-switcher; skip-to-content link.
- Reduced-motion (fade-only) and forced-colors/high-contrast support; ≥44px mobile touch targets; dialogs (search modal, mobile menu) get proper dialog semantics + focus trap.

## 8. Deliverables & format
Produce, as a cohesive set:
- Desktop **1440** and mobile **390** frames for screens (a)–(i) above, in the **dark theme (primary)**, plus a **light-mode sample** for screen (i).
- One **style tile**: the dark + light palettes with hex, the 6-color data-encoding spectrum as a legend, the type scale (Fraunces / Space Grotesk / Amiri specimens incl. Arabic), radius/spacing/elevation tokens, and the core components (command bar, drawer tab, chip, button, legend, quiz card).
- Result must be production-ready, internally consistent, and distinctly "editorial data-art observatory." Explicitly AVOID a default SaaS-dashboard look: no card-grid wall, no generic blue, no heavy chrome competing with the graph. Color is data; the graph is the hero; the shell is a quiet frame.
