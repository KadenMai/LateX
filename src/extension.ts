import * as vscode from 'vscode';

const COMMANDS = [
  'latex-view.openHtmlPreview',
  'latex-view.openHtmlPreviewToSide',
  'latex-view.exportPdf',
  'latex-view.editMargins',
] as const;

export function activate(context: vscode.ExtensionContext): void {
  for (const command of COMMANDS) {
    context.subscriptions.push(
      vscode.commands.registerCommand(command, () => {
        void vscode.window.showInformationMessage(
          `${command}: not implemented yet — see docs/ROADMAP.md`
        );
      })
    );
  }
}

export function deactivate(): void {}
