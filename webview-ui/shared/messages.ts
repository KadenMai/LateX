// Phase 0 placeholder. Phase 1 replaces this with the full HostToWebview /
// WebviewToHost discriminated unions documented in docs/ARCHITECTURE.md §3.
// This file must stay free of `vscode` and DOM-only types so it can be
// imported by both src/** (Node) and webview-ui/** (browser) code.

export interface ExtensionToWebviewMessage {
  type: string;
}

export interface WebviewToExtensionMessage {
  type: string;
}
