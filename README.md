# LaTeX View

View and edit LaTeX documents in VS Code, with a live HTML preview, one-click PDF export, and an editable margins UI.

> **Status:** early scaffolding (Phase 0). See [docs/ROADMAP.md](docs/ROADMAP.md) for what's implemented so far.

## Features

- **View & edit `.tex` files** — basic LaTeX language support (comments, bracket matching).
- **HTML preview** — a live, side-by-side HTML rendering of your document as you type, powered by LaTeX.js and KaTeX. No local LaTeX installation required.
- **PDF export** — compile to PDF using your local TeX distribution (TeX Live / MiKTeX) when available, or a bundled WebAssembly engine when it isn't.
- **Editable margins** — adjust page margins through a form UI; changes are written back into your document's `\geometry` settings.

## Requirements

None required. A local TeX distribution (TeX Live or MiKTeX with `latexmk`/`pdflatex`) is optional but recommended for the most accurate and fastest PDF exports; without one, PDF export falls back to a bundled WebAssembly engine.

## Extension Settings

| Setting | Default | Description |
|---|---|---|
| `latex-view.pdf.engine.preference` | `auto` | `auto` \| `local` \| `wasm` — which PDF backend to use. |
| `latex-view.pdf.engine.localCommand` | `latexmk` | Preferred local TeX command. |
| `latex-view.pdf.localTexPath` | `""` | Extra directory to search for a local TeX distribution. |
| `latex-view.pdf.outputDirectory` | `""` | Output directory for compiled PDFs. |
| `latex-view.pdf.cleanAuxFiles` | `true` | Remove `.aux`/`.log`/etc. after a successful export. |
| `latex-view.pdf.compileTimeoutMs` | `60000` | Compile timeout in milliseconds. |
| `latex-view.preview.debounceMs` | `300` | HTML preview re-render debounce. |
| `latex-view.margins.default.*` | `1in` / `a4paper` | Default margins and paper size for new documents. |
| `latex-view.wasm.engine` | `pdftex` | Which bundled WASM engine to use. |

## Known Issues

None tracked yet — this is a Phase 0 scaffold. See [docs/ROADMAP.md](docs/ROADMAP.md).

## Release Notes

See [CHANGELOG.md](CHANGELOG.md).

## Development

```
npm install
npm run watch
```

Press F5 to launch an Extension Development Host. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow.
