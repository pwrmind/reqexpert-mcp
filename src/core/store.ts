import fs from 'node:fs/promises';
import path from 'node:path';
import { ProjectState, ProjectStateSchema } from './schema.js';
import { DEFAULT_EXPERT_RULES } from '../domain/presets.js';

export class ProjectStore {
  readonly workspaceDir: string;
  private filePath: string;

  constructor(workspaceDir = process.cwd()) {
    this.workspaceDir = workspaceDir;
    this.filePath = path.join(workspaceDir, '.reqexpert', 'project.json');
  }

  async load(): Promise<ProjectState> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      return ProjectStateSchema.parse(JSON.parse(raw));
    } catch {
      const initial = ProjectStateSchema.parse({
        projectName: path.basename(this.workspaceDir),
        expertRules: DEFAULT_EXPERT_RULES,
      });
      await this.save(initial);
      return initial;
    }
  }

  async save(state: ProjectState): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
    await fs.rename(tmpPath, this.filePath);
  }

  /** Проверка существования файла относительно workspace. */
  async fileExists(relPath: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.workspaceDir, relPath));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Рекурсивный обход подкаталога workspace с фильтром по расширениям.
   * Возвращает пути относительно workspace (forward-slash).
   */
  async walkFiles(subdir: string, extensions: string[], limit: number): Promise<string[]> {
    const root = path.join(this.workspaceDir, subdir);
    const results: string[] = [];
    const skipDirs = new Set([
      'node_modules',
      'dist',
      'build',
      'out',
      'coverage',
      'target',
      '.git',
    ]);

    const walk = async (currentDir: string): Promise<void> => {
      if (results.length >= limit) return;
      let entries;
      try {
        entries = await fs.readdir(currentDir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (results.length >= limit) return;
        const full = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name.startsWith('.') || skipDirs.has(entry.name)) continue;
          await walk(full);
        } else if (entry.isFile()) {
          if (extensions.some((ext) => entry.name.endsWith(ext))) {
            results.push(path.relative(this.workspaceDir, full).replace(/\\/g, '/'));
          }
        }
      }
    };

    await walk(root);
    return results;
  }
}