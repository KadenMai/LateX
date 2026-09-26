# Roadmap

Phase checklist for the LaTeX View VS Code extension. See [ARCHITECTURE.md](ARCHITECTURE.md) for the technical design behind each phase.

## Phase 0 — Scaffolding ✅

- [x] `package.json` with commands, configuration schema, and npm scripts
- [x] `tsconfig.json` / `tsconfig.webview.json`
- [x] `esbuild.js` (node bundle for `src/`, watch-mode markers for the VS Code task problem matcher)
- [x] `eslint.config.mjs`
- [x] `src/extension.ts` with 4 stub commands
- [x] `language-configuration.json`
- [x] `.vscode/launch.json` + `tasks.json` (F5 to run)
- [x] `.github/workflows/ci.yml` (check-types, lint, test:unit, compile)
- [x] `.vscodeignore`, `.gitignore`
- [x] Governance docs: README, CHANGELOG, LICENSE, CONTRIBUTING, this roadmap, architecture doc
- [x] Agent team (`.claude/agents/manager.md`, `principal.md`, `tester.md`) and `.claude/skills/build-feature`

## Phase 1 — HTML Preview

- [ ] `webview-ui/shared/messages.ts` — full `HostToWebview`/`WebviewToHost` discriminated unions (replacing the Phase 0 placeholder)
- [ ] `src/preview/previewManager.ts` — per-document panel map, debounced `onDidChangeTextDocument` (via `latex-view.preview.debounceMs`)
- [ ] `src/preview/htmlPreviewPanel.ts` — webview panel wrapper, CSP shell with nonce
- [ ] `webview-ui/html-preview/renderer.ts` — LaTeX.js + KaTeX rendering pipeline
- [ ] `scripts/copyWebviewAssets.mjs` — copies `katex/dist` into `media/dist/katex`
- [ ] Wire `latex-view.openHtmlPreview` / `openHtmlPreviewToSide` commands to open/reveal the panel
- **Acceptance criteria:** opening a `.tex` file and running "Open HTML Preview to the Side" shows a live-updating HTML render of the document (including math) as the user types, with parse errors shown inline rather than crashing the panel.

## Phase 2 — Margin Editor

- [ ] `src/latex/marginPatcher.ts` — pure `readMargins`/`applyMargins` logic (see ARCHITECTURE.md §7 for the algorithm and edge cases)
- [ ] `src/test/unit/marginPatcher.test.ts` — table-driven vitest coverage of the documented cases
- [ ] `webview-ui/margin-editor/form.ts` — margin form UI, added as a tab in the existing preview panel
- [ ] Wire `latex-view.editMargins` command; apply edits via a single `WorkspaceEdit` (minimal range replace, not whole-document)
- **Acceptance criteria:** editing margin values in the panel updates the `.tex` source's `\geometry{...}`/`\usepackage{geometry}` in place, preserving unrelated content and undo history.

## Phase 3 — Local PDF Export

- [ ] `src/pdf/engineSelector.ts` — auto/local/wasm resolution logic
- [ ] `src/pdf/localEngine.ts` — detect latexmk/pdflatex/xelatex/lualatex, shell out, stream log to an Output channel, timeout + process-tree kill on Windows
- [ ] `src/pdf/pdfExportCoordinator.ts` — save dialog, open result, aux-file cleanup
- [ ] Wire `latex-view.exportPdf` command
- **Acceptance criteria:** with a local TeX distribution installed, exporting a `.tex` file with the local engine produces a correct PDF the user can save, with compile errors surfaced clearly on failure.

## Phase 4 — WASM PDF Fallback

- [ ] Vendor SwiftLaTeX engine assets into `wasm-assets/` (re-verify current packaging/licensing before vendoring — flagged as unresolved in ARCHITECTURE.md §6)
- [ ] `webview-ui/wasm-worker/compile.worker.ts` — runs the WASM engine in a Web Worker inside the preview webview
- [ ] `src/pdf/wasmEngineHost.ts` — extension-host orchestration
- [ ] Extend `engineSelector.ts`'s `auto` mode to fall back to WASM when no local TeX is detected
- **Acceptance criteria:** with no local TeX distribution installed, exporting a single-file `.tex` document still produces a PDF via the bundled WASM engine.

## Phase 5 — Marketplace Polish

- [ ] Register a real Marketplace publisher id (currently a placeholder in `package.json`)
- [ ] Add `media/icons/extension-icon.png` (128×128) and reference it in `package.json`'s `icon` field
- [ ] `src/pdf/pdfViewerPanel.ts` — optional pdf.js in-editor PDF preview (upgrade over `vscode.env.openExternal`)
- [ ] Real README screenshots/GIFs
- [ ] `@vscode/test-electron` integration test suite fleshed out
- [ ] `.github/workflows/release.yml` (`workflow_dispatch`, `vsce publish` via `VSCE_PAT` secret)
- [ ] Tag `v0.1.0` and publish
- **Acceptance criteria:** `vsce package` produces a clean `.vsix`, and the extension is published and installable from the VS Code Marketplace.
