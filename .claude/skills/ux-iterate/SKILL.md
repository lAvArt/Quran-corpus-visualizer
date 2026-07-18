---
name: ux-iterate
description: Run one cost-efficient UI/UX polish iteration - screenshot the app, assess visuals, spec improvements, delegate implementation to cheap agents, verify, re-screenshot. Use when the user asks to polish/iterate on UI, UX, design, animations, or visual quality.
---

# UX Iteration Loop (cost-efficient)

Division of labor — this is a hard constraint from the user:
- **Main model (Fable)**: visual assessment, design decisions, writing precise specs, reviewing diffs/screenshots. Nothing mechanical.
- **`scout` agent (haiku)**: any codebase lookup needed to write a spec.
- **`ui-builder` agent (sonnet)**: implements each spec'd change.
- **`verifier` agent (haiku)**: runs lint/typecheck/tests after implementation batches.
- **`data-auditor` agent (sonnet)**: checks any number/graph shown by the UI against corpus data.

## Loop

1. **Ensure dev server** is running (`npm run dev`, background). Note the port.
2. **Screenshot** the surfaces under review:
   `npx tsx scripts/ux-shots.ts --base http://localhost:<port> --routes en,en/search,en/study,en/quiz,ar --viewports desktop,mobile --themes light,dark --out .ux-shots`
   (pass routes WITHOUT leading slashes — Git Bash mangles leading-slash args; the script prepends the slash)
   (gitignored dir; add flags per need — `tablet`/`laptop` viewports exist too).
3. **Assess** (main model): Read the screenshots selectively — start with dark/desktop + mobile, spot-check light + RTL (/ar). Judge against the north star: elegant, subtle motion, informative and accurate, instantly answers "what does this word mean / how often does it occur". Check both shells (immersive home AppShell vs AppWorkspaceShell sub-pages) for consistency.
4. **Spec** (main model): write concrete, file-scoped specs. Each spec: goal, exact files, exact visual/behavioral outcome, what NOT to touch. Parallelize independent specs.
5. **Delegate** each spec to a `ui-builder` agent. Independent specs → parallel agents; overlapping files → sequence or use worktree isolation.
6. **Verify**: one `verifier` agent (typecheck + lint + targeted tests). If UI numbers/graphs changed, also a `data-auditor` agent.
7. **Re-screenshot and compare** (main model). Iterate or conclude.
8. Work on a feature branch; commit only when the user asked for it or approved the result.

## Project-specific review checklist

- Both themes (`data-theme` on `<html>`; cookie `quran-corpus-theme`), RTL (`/ar`), reduced motion.
- No hardcoded UI strings — next-intl messages (en + ar).
- Animations: 150-300ms, ease-out, framer-motion or CSS; must respect `prefers-reduced-motion`.
- Design language: near-black editorial dataviz aesthetic (see DesignReference/ JPGs), glassmorphism panels, `--accent` teal (light) / orange (dark).
- Accuracy: any count/stat shown must trace to lib/corpus or lib/search derivations — when in doubt, data-auditor.
