import * as vscode from 'vscode';
import * as path from 'path';
import { pascalCase } from 'change-case';
import { FunctionEntry } from './dataLoader';

interface SpecFilePaths {
  absolutePath: string;
  relativePath: string;
  namespace: string;
  functionLeanName: string;
  crateName: string;
  cratePascalCase: string;
}

export function deriveSpecFilePaths(
  entry: FunctionEntry,
  workspaceRoot: string,
  specsBasePath: string
): SpecFilePaths {
  const segments = entry.leanName.split('.');
  const crateName = segments[0];
  const functionLeanName = segments[segments.length - 1];
  const namespace = segments.slice(0, -1).join('.');
  const cratePascalCase = pascalCase(crateName);

  // Middle segments: drop crate (first) and function (last)
  const middleSegments = segments.slice(1, -1);
  const folderParts = middleSegments.map(s => pascalCase(s));
  const fileName = pascalCase(functionLeanName) + '.lean';

  const relativePath = path.join(specsBasePath, ...folderParts, fileName);
  const absolutePath = path.join(workspaceRoot, relativePath);

  return { absolutePath, relativePath, namespace, functionLeanName, crateName, cratePascalCase };
}

function rustDisplayName(rustName: string): string {
  // Show the last two :: segments, e.g. "Scalar52::to_bytes"
  const parts = rustName.split('::');
  if (parts.length >= 2) {
    return parts.slice(-2).join('::');
  }
  return rustName;
}

interface SpecTemplateConfig {
  copyrightHolder: string;
  licenseType: string;
  defaultAuthors: string;
  defaultImports: string[];
  openDeclarations: string;
}

export function generateSpecFileContent(
  entry: FunctionEntry,
  paths: SpecFilePaths,
  config: SpecTemplateConfig
): string {
  const lines: string[] = [];

  // Copyright block (omit if copyrightHolder is empty)
  if (config.copyrightHolder) {
    const year = new Date().getFullYear();
    lines.push('/-');
    lines.push(`Copyright (c) ${year} ${config.copyrightHolder}. All rights reserved.`);
    lines.push(`Released under ${config.licenseType} license as described in the file LICENSE.`);
    if (config.defaultAuthors) {
      lines.push(`Authors: ${config.defaultAuthors}`);
    }
    lines.push('-/');
  }

  // Imports: Aeneas and Funs are always included
  lines.push('import Aeneas');
  lines.push(`import ${paths.cratePascalCase}.Funs`);
  for (const imp of config.defaultImports) {
    lines.push(`import ${paths.cratePascalCase}.${imp}`);
  }

  // Module header
  lines.push('');
  lines.push(`/-! # Spec theorem for \`${rustDisplayName(entry.rustName)}\``);
  lines.push('');
  lines.push(`Source: ${entry.source}`);
  lines.push('-/');

  // Open declarations and namespace
  lines.push('');
  lines.push(`open ${config.openDeclarations}`);
  lines.push(`namespace ${paths.namespace}`);

  // Theorem boilerplate
  lines.push('');
  lines.push(`/-- **Spec theorem for \`${entry.rustName}\`** -/`);
  lines.push('@[progress]');
  lines.push(`theorem ${paths.functionLeanName}_spec {- TODO: Add parameters -} :`);
  lines.push(`    ${paths.functionLeanName} {- TODO: Add arguments -} ⦃ result =>`);
  lines.push('    True {- TODO: Replace with actual specification -} ⦄ := by');
  lines.push('  sorry');

  // Close namespace
  lines.push('');
  lines.push(`end ${paths.namespace}`);
  lines.push('');

  return lines.join('\n');
}

export async function createSpecFile(
  entry: FunctionEntry,
  workspaceRoot: string
): Promise<void> {
  const config = vscode.workspace.getConfiguration('aeneas-verify');
  const specsBasePath = config.get<string>('specsBasePath', 'Specs');
  const copyrightHolder = config.get<string>('copyrightHolder', '');
  const licenseType = config.get<string>('licenseType', 'Apache 2.0');
  const defaultAuthors = config.get<string>('defaultAuthors', '');
  const defaultImports = config.get<string[]>('defaultImports', []);
  const openDeclarations = config.get<string>('openDeclarations', 'Aeneas Aeneas.Std Result Aeneas.Std.WP');

  const paths = deriveSpecFilePaths(entry, workspaceRoot, specsBasePath);
  const fileUri = vscode.Uri.file(paths.absolutePath);

  // Check if file already exists
  try {
    await vscode.workspace.fs.stat(fileUri);
    const choice = await vscode.window.showWarningMessage(
      `Spec file already exists: ${paths.relativePath}`,
      'Open', 'Cancel'
    );
    if (choice === 'Open') {
      await vscode.window.showTextDocument(fileUri);
    }
    return;
  } catch (_) {
    // File does not exist, proceed with creation
  }

  const templateConfig: SpecTemplateConfig = {
    copyrightHolder, licenseType, defaultAuthors, defaultImports, openDeclarations
  };
  const content = generateSpecFileContent(entry, paths, templateConfig);

  // Create directory tree and write file
  const dirUri = vscode.Uri.file(path.dirname(paths.absolutePath));
  await vscode.workspace.fs.createDirectory(dirUri);
  await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf-8'));

  await vscode.window.showTextDocument(fileUri);
}
