import path from 'node:path';

export function normalizePath(raw: string): string {
  return raw.trim().replace(/\\/g, '/');
}

export function isInsideWorkspace(workspace: string, rel: string): boolean {
  const resolved = path.resolve(workspace, rel);
  const root = path.resolve(workspace) + path.sep;
  return resolved === path.resolve(workspace) || resolved.startsWith(root);
}