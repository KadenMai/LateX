# LaTeX View

VS Code extension: view/edit `.tex` files, render a live HTML preview, export to PDF, and edit page margins through a UI. Target: publish to the VS Code Marketplace.

## Locked architecture decisions — do not relitigate

- **PDF export** supports two backends, chosen by the `latex-view.pdf.engine.preference` setting (`auto` | `local` | `wasm`):
  - `local`: shell out to a local TeX distribution (latexmk preferred, pdflatex/xelatex/lualatex fallback).
  - `wasm`: bundled SwiftLaTeX WASM engine, no local install required.
  - `auto` (default): prefer local, fall back to wasm.
- **HTML preview** renders client-side in a webview using **LaTeX.js** (document structure) + **KaTeX** (math), not a local-TeX-dependent tool like tex4ht. No local TeX required for preview.

Full design detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Phase status/checklist: [docs/ROADMAP.md](docs/ROADMAP.md).

## Repo layout

- `src/` — extension host code (Node context, imports `vscode`).
- `webview-ui/` — webview code (browser context, must NOT import `vscode`; communicates with the host only via `postMessage`, typed in `webview-ui/shared/messages.ts`).
- `docs/` — architecture and roadmap references.
- `.claude/agents/` — the Manager/Principal/Tester sub-agent team (see below).
- `.claude/skills/build-feature/` — the workflow skill for picking up the next roadmap phase.

## Commands

- `npm install`
- `npm run watch` — esbuild watch mode (also the F5 pre-launch task).
- `npm run check-types` — typecheck `src/` and `webview-ui/` separately.
- `npm run lint`
- `npm run test:unit` — vitest, pure-logic tests (no VS Code needed).
- `npm run test:integration` — `@vscode/test-electron` smoke tests.
- `npm run compile` — production esbuild bundle.
- `npm run vsce:package` / `npm run vsce:publish`

A phase/feature isn't done until `check-types`, `lint`, `test:unit`, and `compile` all pass.

## Working with the agent team

For any new feature or roadmap phase, use the three custom sub-agents via the `Agent` tool rather than doing everything inline:

1. **manager** — breaks the phase/feature into concrete tasks, updates `docs/ROADMAP.md` / `CHANGELOG.md`. Never writes implementation code.
2. **principal** — implements the tasks Manager hands off, following `docs/ARCHITECTURE.md` conventions.
3. **tester** — writes/runs tests and verifies acceptance criteria before the phase is marked done.

The `.claude/skills/build-feature` skill encodes this workflow end-to-end — invoke it (or follow its steps manually) when picking up the next phase instead of re-deriving the plan from scratch.
