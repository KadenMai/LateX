# Architecture

Technical design for the LaTeX View VS Code extension. This is the durable reference the **principal** agent reads before implementing any roadmap phase — see [ROADMAP.md](ROADMAP.md) for phase status and [../CLAUDE.md](../CLAUDE.md) for the locked top-level decisions this document elaborates on.

## 1. Repository structure

```
LateX/
├── .vscode/
│   ├── launch.json            # F5 "Run Extension" (extensionHost) + pre-launch watch task
│   └── tasks.json             # background task wired to `npm run watch`
├── .github/
│   └── workflows/
│       ├── ci.yml             # lint, typecheck, unit tests, compile
│       └── release.yml        # (Phase 5) workflow_dispatch, `vsce publish`
├── src/                        # extension host (Node context, has `vscode` module)
│   ├── extension.ts            # activate()/deactivate(), wires everything together
│   ├── commands/                # (Phase 1+) one file per command, index.ts to register all
│   ├── preview/                 # (Phase 1) htmlPreviewPanel.ts, previewManager.ts, webviewHtml.ts
│   ├── pdf/                     # (Phase 3/4) engineSelector.ts, localEngine.ts, wasmEngineHost.ts, pdfExportCoordinator.ts
│   ├── latex/                   # (Phase 2) marginPatcher.ts, documentModel.ts
│   ├── config/                  # (Phase 1+) settings.ts — typed wrapper over vscode.workspace.getConfiguration
│   ├── util/                    # logger.ts, tempDir.ts, nonce.ts
│   └── test/
│       ├── unit/                 # vitest, no vscode dependency
│       └── integration/          # @vscode/test-electron
├── webview-ui/                  # separate esbuild target(s), browser context, NO `vscode` import
│   ├── shared/
│   │   └── messages.ts          # discriminated-union message types, imported type-only by src/
│   ├── html-preview/             # (Phase 1) renderer.ts (LaTeX.js + KaTeX), index.ts, style.css
│   ├── margin-editor/            # (Phase 2) form.ts, style.css
│   ├── pdf-viewer/                # (Phase 5, optional) pdf.js viewer
│   └── wasm-worker/               # (Phase 4) compile.worker.ts
├── media/
│   ├── icons/                    # extension-icon.png (128x128) — added in Phase 5
│   └── dist/                     # esbuild output + copied vendor assets (generated, gitignored)
├── wasm-assets/                   # (Phase 4) vendored SwiftLaTeX engine files
├── language-configuration.json
├── esbuild.js
├── package.json
├── tsconfig.json                  # src/** (node, vscode types)
├── tsconfig.webview.json          # webview-ui/** (DOM lib, no vscode types)
├── eslint.config.mjs
├── vitest.config.ts
├── .vscodeignore
└── .gitignore
```

Key structural rule: `webview-ui/shared/messages.ts` contains only plain TS interfaces (no `vscode`, no DOM lib dependency) so `src/preview/*.ts` can `import type` from it, and `webview-ui/*` can use it without pulling in `vscode` types. This file exists from Phase 0 as a placeholder and gets its real message shapes in Phase 1.

## 2. `package.json` contributions

- `contributes.languages` registers the `latex` language id for `.tex`/`.sty`/`.cls`/`.ltx`, pointing at `language-configuration.json`. VS Code merges language contributions from multiple extensions, so this does not conflict with other LaTeX extensions a user may also have installed.
- `contributes.commands`: `latex-view.openHtmlPreview`, `latex-view.openHtmlPreviewToSide`, `latex-view.exportPdf`, `latex-view.editMargins`.
- `contributes.configuration`: the `latex-view.*` settings namespace (see [README.md](../README.md) for the current table). New settings always go here, never as ad-hoc `workspace.getConfiguration` reads without a schema entry.
- `activationEvents: []` — relies on VS Code's modern auto-activation from `contributes` (commands/languages), valid for `engines.vscode >= 1.74`.
- The margin editor is a second tab inside the same HTML preview webview panel (toolbar toggle "Preview / Margins"), not a separate `WebviewViewProvider`/sidebar — this avoids managing two independent webview lifecycles. Promoting it to a dedicated sidebar view is a valid future refactor, not required for the roadmap as planned.

## 3. Webview architecture — postMessage protocol

`webview-ui/shared/messages.ts` (imported type-only on both sides), planned Phase 1 shape:

```ts
export type HostToWebview =
  | { type: 'init'; text: string; docUri: string; config: PreviewConfig }
  | { type: 'update'; text: string; version: number }
  | { type: 'marginValues'; margins: Margins }
  | { type: 'compileProgress'; phase: 'detect' | 'compile' | 'save'; message: string }
  | { type: 'compileDone'; ok: boolean; message?: string };

export type WebviewToHost =
  | { type: 'ready' }
  | { type: 'renderError'; message: string; line?: number }
  | { type: 'applyMargins'; margins: Margins }
  | { type: 'requestExportPdf' }
  | { type: 'openExternal'; url: string };
```

- `previewManager.ts` owns one `htmlPreviewPanel` per open `.tex` document (`Map<string, HtmlPreviewPanel>`), mirroring the pattern VS Code's built-in Markdown preview uses.
- On `vscode.workspace.onDidChangeTextDocument`, filter to documents with an open panel, debounce per-document (`latex-view.preview.debounceMs`, default 300ms), then post the **full document text**. LaTeX files are small/medium and re-parsing whole-doc per update is what LaTeX.js expects; incremental diffing is an explicit non-goal.
- `webview.options = { enableScripts: true, localResourceRoots: [Uri.joinPath(extUri, 'media', 'dist')] }`, `retainContextWhenHidden: true` (trades memory for not re-parsing when the tab regains focus).
- Margin tab: on `{type:'ready'}` (or an explicit `requestMargins`), host responds with `marginValues` computed via `marginPatcher.readMargins(text)`, falling back to `latex-view.margins.default.*` settings when nothing is set in the doc yet.
- `applyMargins` from the webview → host computes new text via `marginPatcher.applyMargins`, diffs old/new to find the minimal changed span, and applies it via a single `vscode.WorkspaceEdit` range replace (not a full-document replace) so undo/cursor position stay sane.
- Links generated inside rendered LaTeX HTML (e.g. `\href`) are intercepted in the webview and forwarded as `openExternal` rather than navigated in-place (CSP blocks in-place navigation anyway).

## 4. Bundling LaTeX.js + KaTeX, and CSP

- `esbuild.js` has one Node-context build (`src/extension.ts`) and one browser-context build per `webview-ui/*/index.ts` entry point (added as each phase needs them), each `bundle: true, platform: 'browser', format: 'iife'`, output under `media/dist/<name>/index.js`.
- Planned `renderer.ts` uses LaTeX.js's documented ability to delegate math to KaTeX instead of its own limited math support:
  ```ts
  import { parse, HtmlGenerator } from 'latex.js';
  import katex from 'katex';
  const generator = new HtmlGenerator({ hyphenate: false, KaTeX: katex });
  const { htmlDocument } = parse(latexSource, { generator }).htmlDocument();
  ```
  The generated body/styles are injected into a container `<div>` inside our own CSP-controlled webview shell — LaTeX.js does not own the whole `<head>`.
- A `scripts/copyWebviewAssets.mjs` (added in Phase 1) copies `node_modules/katex/dist/**` (css + `fonts/`) into `media/dist/katex/`, preserving relative layout so `url()` references in `katex.min.css` resolve once the directory is under `localResourceRoots` and referenced via `webview.asWebviewUri`.
- CSP meta tag (built by a `webviewHtml.ts` helper):
  ```
  default-src 'none';
  img-src ${cspSource} https: data:;
  style-src ${cspSource} 'unsafe-inline';
  font-src ${cspSource};
  script-src 'nonce-${nonce}';
  worker-src ${cspSource} blob:;
  ```
  `style-src 'unsafe-inline'` is required because LaTeX.js's `HtmlGenerator` emits inline `style="..."` attributes for layout; all executable script stays in the single nonced bundle. `worker-src blob:` is needed for the Phase 4 SwiftLaTeX worker.
- Parse errors from LaTeX.js are caught in the renderer, shown as an inline banner in the webview, and forwarded via `renderError` to the host for logging (rather than crashing the panel).

## 5. Local TeX detection and shell-out compilation

Planned `src/pdf/localEngine.ts`:

- `detectLocalTex(config)`: builds a candidate PATH by prepending `latex-view.pdf.localTexPath` if set, then probes in preference order — `latexmk -v` → `pdflatex -version` → `xelatex -version` → `lualatex -version` (starting from the user's `localCommand` setting) via `child_process.execFile` with a short timeout; cache the result for the session, invalidated on config change or a manual "Detect Again" action.
- `compileWithLocalTex(texFilePath, opts)`: runs in an isolated work dir (`context.storageUri`-scoped, hashed by file path) so the user's source tree is never polluted:
  - Preferred: `latexmk -pdf -interaction=nonstopmode -halt-on-error -file-line-error -outdir="<workDir>" "<texFile>"` (swap `-pdf` for `-pdfxe`/`-pdflua` for xelatex/lualatex).
  - Fallback (no `latexmk`): run `pdflatex -interaction=nonstopmode -halt-on-error -output-directory="<workDir>"` **twice** (standard heuristic for resolving references/TOC).
  - Use `child_process.spawn` (not `exec`) to stream stdout/stderr live into a dedicated `vscode.OutputChannel` ("LaTeX View: Compile Log").
  - Enforce `latex-view.pdf.compileTimeoutMs`; on timeout, kill the process tree. On Windows (this repo's dev platform), a plain `child.kill()` won't reliably kill `latexmk`'s own spawned children — use the `tree-kill` npm package or `taskkill /pid <pid> /T /F`.
  - On non-zero exit, scan the `.log` for `^! ` / `l.<n>` lines to build a compact error surfaced via `showErrorMessage(..., 'Show Log')`.
  - On success, if `cleanAuxFiles` is true, delete `.aux/.log/.out/.toc/.fls/.fdb_latexmk/.synctex.gz` from the work dir, keeping only the produced PDF.
- `pdfExportCoordinator.ts` (shared by both engines): takes `{ pdfBytes, log, success }`, calls `vscode.window.showSaveDialog({ filters: { PDF: ['pdf'] } })`, copies the bytes to the chosen path. VS Code has no built-in native PDF renderer — "open the saved PDF" uses `vscode.env.openExternal(uri)` (MVP default) or the optional `pdfViewerPanel.ts` (pdf.js in a webview, Phase 5).

## 6. SwiftLaTeX WASM fallback (Phase 4)

**Open risk, re-verify before implementing:** SwiftLaTeXBase does not have a single well-maintained npm package the way `latex.js`/`katex` do — historically it ships prebuilt `PdfTeXEngine.js`/`XeTeXEngine.js` wrapper scripts plus multi-MB `.wasm`/`.js` core files as GitHub release/dist artifacts, not a clean versioned npm dependency. Re-check the current SwiftLaTeXBase repo state and licensing before vendoring.

- SwiftLaTeX's `PdfTeXEngine` manages its own internal Worker; we don't hand-roll message plumbing inside that worker, but the worker is spawned **from inside a VS Code webview** (itself a sandboxed iframe), so `worker-src ${cspSource} blob:` must be present in the CSP and all wasm/data files must sit under `localResourceRoots`, referenced via `asWebviewUri`.
- Because a true "invisible" webview panel doesn't exist in the VS Code API, the WASM compiler reuses the already-open `htmlPreviewPanel` when one exists; if none is open, `exportPdf` creates a transient panel purely to host the compile module and disposes it once the PDF bytes are returned.
- Flow: host → webview `{ type: 'compilePdf', engine: 'pdftex', mainTex }` → webview does:
  ```ts
  const engine = new PdfTeXEngine();
  await engine.loadEngine();
  engine.writeMemFSFile('main.tex', mainTex);
  engine.setEngineMainFile('main.tex');
  const { pdf, status, log } = await engine.compileLaTeX();
  ```
  → webview posts back `{ type: 'compileResult', ok, pdf: <ArrayBuffer>, log }` (transferable, avoiding a base64 round trip) → host feeds it into the same `pdfExportCoordinator.ts` used by the local path.
- MVP scope is single-file compile only (no `\input`/`\includegraphics` resource bundling) — multi-file support is explicitly deferred.
- First engine load pulls down a large wasm+format payload; wrap it in `vscode.window.withProgress`, and keep the compiler webview alive across exports in a session rather than reloading the engine each time.

## 7. Margin-editor text-patching logic

Planned `src/latex/marginPatcher.ts` — pure, framework-free, unit-tested with vitest, no `vscode` import:

```ts
export interface Margins {
  top?: string; bottom?: string; left?: string; right?: string; // "1in", "2.5cm", etc.
  paperSize?: string; // "a4paper" | "letterpaper" | ...
}

export function readMargins(text: string): Margins | null;
export function applyMargins(text: string, margins: Margins): string;
```

Strategy (surgical substring replace, not a full LaTeX parse/re-serialize):

1. **Comment-aware scan**: for each line, truncate at the first unescaped `%` before regex-testing, so `%\usepackage{geometry}` is correctly ignored.
2. Find `\usepackage(?:\[[^\]]*\])?\{\s*geometry\s*\}` — only treat the single-package form as authoritative; if `geometry` appears inside a combined list (`\usepackage{a,geometry,b}`), leave that line untouched and manage everything through a standalone `\geometry{...}` call instead, to avoid corrupting a shared usepackage line.
3. Find an existing `\geometry\{([^}]*)\}` call.
4. Update rules:
   - **Geometry call exists**: parse its `key=value,...` tokens into a map, overlay only the keys we manage (`top/bottom/left/right` or a `margin=` shorthand, plus paper size), preserve any unrelated key (`includeheadfoot`, etc.), and if the four sides end up uniform collapse to `margin=<x>` (removing stale `top/bottom/left/right` keys); replace only the matched `\geometry{...}` span via `text.slice`.
   - **`\usepackage{geometry}` exists but no `\geometry{}` call**: insert a new `\geometry{...}` line immediately after the `\usepackage` line, using the file's sniffed EOL style (`\n` vs `\r\n`) and matching indentation.
   - **Neither exists**: insert `\usepackage{geometry}` and `\geometry{...}` right after the first `\documentclass(\[[^\]]*\])?\{[^}]*\}` match; if no `\documentclass` is found at all, insert at the top of the file and surface a warning toast from the webview (malformed/partial document).
5. Unit validation both client-side (webview form: numeric + unit dropdown) and host-side (`/^\d+(\.\d+)?(in|cm|mm|pt)$/`) before writing, rejecting otherwise.
6. Editor application via a single `vscode.WorkspaceEdit` replacing only the changed byte range (`document.positionAt(offset)` on both ends) — never a whole-document replace.
7. Documented out-of-scope edge case: multi-line `\geometry{...}` calls spanning several lines are not handled (assume single-line, the overwhelmingly common real-world form).

## 8. Build/dev tooling

- `tsconfig.json`: Node16 module/moduleResolution, ES2022 target, `types: ["node", "vscode"]`, `rootDir: "src"`, strict.
- `tsconfig.webview.json`: `lib: ["ES2020", "DOM"]`, no `vscode` types, `rootDir: "webview-ui"`.
- `esbuild.js`: one Node-platform bundle for `src/extension.ts` (`external: ['vscode']`, CJS, sourcemaps in dev, minified in `--production`), plus one browser-platform IIFE bundle per `webview-ui/*/index.ts` entry as each phase adds one. A small esbuild plugin logs `[watch] build started`/`[watch] build finished` markers so the VS Code task problem matcher can track background build state.
- ESLint flat config (`eslint.config.mjs`) via the unified `typescript-eslint` package, with a `webview-ui/**` override adding browser globals.
- Tests:
  - vitest for pure logic (`marginPatcher.ts`, `engineSelector.ts`) — table-driven where a module has several documented cases.
  - `@vscode/test-electron` for a thin smoke suite (commands register, preview panel opens for a `.tex` doc, config schema loads). Full PDF-compile end-to-end tests (needing either a real TeX install or the multi-MB wasm core) are explicitly deferred — instead unit-test `localEngine`'s argument-building/log-parsing by mocking `child_process`.

## 9. Marketplace readiness checklist

- `package.json`: `name`, `displayName`, `description`, `version`, `publisher` (must be a real registered id — currently a placeholder, see [ROADMAP.md](ROADMAP.md) Phase 5), `engines.vscode`, `categories`, `keywords`, `icon` (128×128 PNG, added Phase 5), `repository`, `bugs`, `license`.
- `LICENSE` at repo root matching the chosen SPDX id (MIT).
- `README.md`: features, requirements, settings table, known issues, release notes pointer, development section.
- `CHANGELOG.md`: Keep-a-Changelog format.
- `.vscodeignore`: excludes `src/**`, `webview-ui/**`, `wasm-assets/**`, `docs/**`, `.claude/**`, `.vscode-test/**`, `.github/**`, TS configs, `esbuild.js`; keeps `dist/**`, `media/dist/**`, `language-configuration.json`, `LICENSE`, `README.md`, `CHANGELOG.md`.
- `.github/workflows/ci.yml`: lint + typecheck + unit tests + compile on every push/PR.
- `.github/workflows/release.yml` (Phase 5): `workflow_dispatch`-only, `vsce publish` using a `VSCE_PAT` secret — never auto-publish on push.

## 10. Phased build order

See [ROADMAP.md](ROADMAP.md) for the authoritative, checkable phase list (Phase 0 scaffolding is complete; Phases 1–5 are HTML preview, margin editor, local PDF export, WASM PDF fallback, and marketplace polish, in that order). Phase 1 is deliberately done before the margin editor and PDF export because it validates the whole webview/esbuild/CSP pipeline that every later feature reuses.
