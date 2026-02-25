import * as vscode from 'vscode';
import * as path from 'path';
import { loadFunctions, findEntriesForFile, FileIndex } from './dataLoader';
import { createDecorationTypes, updateDecorations, DecorationTypes } from './decorationProvider';
import { SpecHoverProvider } from './hoverProvider';

let fileIndex: FileIndex = new Map();
let decorationTypes: DecorationTypes;

function getJsonAbsPath(workspaceRoot: string): string {
  const config = vscode.workspace.getConfiguration('aeneas-verify');
  const jsonRelPath = config.get<string>('jsonPath', 'functions.json');
  return path.join(workspaceRoot, jsonRelPath);
}

export function activate(context: vscode.ExtensionContext) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return;
  }
  const workspaceRoot = workspaceFolder.uri.fsPath;

  // Load data
  fileIndex = loadFunctions(getJsonAbsPath(workspaceRoot));

  // Create gutter decorations
  decorationTypes = createDecorationTypes(context);
  context.subscriptions.push(
    decorationTypes.verified,
    decorationTypes.specified,
    decorationTypes.extracted
  );

  // Register hover provider
  const hoverProvider = new SpecHoverProvider(() => fileIndex, workspaceRoot);
  context.subscriptions.push(
    vscode.languages.registerHoverProvider('rust', hoverProvider)
  );

  // Register command: open spec file
  context.subscriptions.push(
    vscode.commands.registerCommand('aeneas-verify.openSpecFile', (specFile: string) => {
      const absPath = path.join(workspaceRoot, specFile);
      const uri = vscode.Uri.file(absPath);
      vscode.window.showTextDocument(uri);
    })
  );

  // Register command: manual reload
  context.subscriptions.push(
    vscode.commands.registerCommand('aeneas-verify.reload', () => {
      fileIndex = loadFunctions(getJsonAbsPath(workspaceRoot));
      refreshAllEditors();
      vscode.window.showInformationMessage('Aeneas Verify: Reloaded verification data');
    })
  );

  // Watch for JSON changes
  const jsonRelPath = vscode.workspace.getConfiguration('aeneas-verify')
    .get<string>('jsonPath', 'functions.json')!;
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(workspaceFolder, jsonRelPath)
  );
  watcher.onDidChange(() => {
    fileIndex = loadFunctions(getJsonAbsPath(workspaceRoot));
    refreshAllEditors();
  });
  watcher.onDidCreate(() => {
    fileIndex = loadFunctions(getJsonAbsPath(workspaceRoot));
    refreshAllEditors();
  });
  context.subscriptions.push(watcher);

  // React to editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        decorateEditor(editor, workspaceRoot);
      }
    })
  );

  // React to configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('aeneas-verify')) {
        fileIndex = loadFunctions(getJsonAbsPath(workspaceRoot));
        refreshAllEditors();
      }
    })
  );

  // Decorate the currently active editor on startup
  if (vscode.window.activeTextEditor) {
    decorateEditor(vscode.window.activeTextEditor, workspaceRoot);
  }

  // Also decorate when visible editors change (e.g. split views)
  context.subscriptions.push(
    vscode.window.onDidChangeVisibleTextEditors(editors => {
      for (const editor of editors) {
        decorateEditor(editor, workspaceRoot);
      }
    })
  );

  function refreshAllEditors() {
    for (const editor of vscode.window.visibleTextEditors) {
      decorateEditor(editor, workspaceRoot);
    }
  }

  function decorateEditor(editor: vscode.TextEditor, wsRoot: string) {
    if (editor.document.languageId !== 'rust') {
      return;
    }

    const showExtracted = vscode.workspace
      .getConfiguration('aeneas-verify')
      .get<boolean>('showExtracted', true);

    const entries = findEntriesForFile(fileIndex, editor.document.uri, wsRoot);
    updateDecorations(editor, entries, decorationTypes, showExtracted);
  }
}

export function deactivate() {}

