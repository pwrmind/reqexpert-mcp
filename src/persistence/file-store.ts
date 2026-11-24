import fs from 'node:fs/promises';
import path from 'node:path';
import {
  ActivityEventSchema,
  BusinessRuleSchema,
  ProjectMetaSchema,
  RequirementSchema,
  StakeholderSchema,
} from '../core/schema.js';
import type {
  ActivityEvent,
  BusinessRule,
  ProjectMeta,
  ProjectSnapshot,
  Requirement,
  Stakeholder,
} from '../core/schema.js';
import type { Store } from './store.js';
import { WorkspaceError } from '../core/errors.js';
import { isInsideWorkspace, normalizePath } from '../core/paths.js';

const DEFAULT_SCHEMA_VERSION = 2;
const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', 'out', 'coverage', 'target', '.git', '.reqexpert',
]);

export class FileStore implements Store {
  readonly workspaceDir: string;
  readonly activityLimit: number;
  private readonly rootDir: string;
  private readonly paths: {
    meta: string;
    requirements: string;
    stakeholders: string;
    businessRules: string;
    activities: string;
  };

  constructor(workspaceDir: string, activityLimit = 50) {
    this.workspaceDir = path.resolve(workspaceDir);
    this.activityLimit = activityLimit;
    this.rootDir = path.join(this.workspaceDir, '.reqexpert');
    this.paths = {
      meta: path.join(this.rootDir, 'project.json'),
      requirements: path.join(this.rootDir, 'requirements.json'),
      stakeholders: path.join(this.rootDir, 'stakeholders.json'),
      businessRules: path.join(this.rootDir, 'business-rules.json'),
      activities: path.join(this.rootDir, 'activities.jsonl'),
    };
  }

  async load(): Promise<ProjectSnapshot> {
    await this.ensureInitialized();
    const [meta, requirements, stakeholders, businessRules, activities] = await Promise.all([
      this.readJson(this.paths.meta, ProjectMetaSchema),
      this.readJson(this.paths.requirements, RequirementSchema.array()),
      this.readJson(this.paths.stakeholders, StakeholderSchema.array()),
      this.readJson(this.paths.businessRules, BusinessRuleSchema.array()),
      this.readActivities(),
    ]);
    return { meta, requirements, stakeholders, businessRules, activities };
  }

  async saveMeta(meta: ProjectMeta): Promise<void> {
    await this.writeJson(this.paths.meta, meta);
  }

  async saveRequirements(reqs: readonly Requirement[]): Promise<void> {
    await this.writeJson(this.paths.requirements, reqs);
  }

  async saveStakeholders(stakeholders: readonly Stakeholder[]): Promise<void> {
    await this.writeJson(this.paths.stakeholders, stakeholders);
  }

  async saveBusinessRules(rules: readonly BusinessRule[]): Promise<void> {
    await this.writeJson(this.paths.businessRules, rules);
  }

  async appendActivity(event: ActivityEvent): Promise<void> {
    await fs.mkdir(this.rootDir, { recursive: true });
    await fs.appendFile(this.paths.activities, JSON.stringify(event) + '\n', 'utf-8');
  }

  async fileExists(relPath: string): Promise<boolean> {
    if (!isInsideWorkspace(this.workspaceDir, relPath)) return false;
    try {
      await fs.access(path.join(this.workspaceDir, relPath));
      return true;
    } catch {
      return false;
    }
  }

  async walkFiles(subdir: string, extensions: readonly string[], limit: number): Promise<string[]> {
    if (!isInsideWorkspace(this.workspaceDir, subdir)) {
      throw new WorkspaceError(`Путь "${subdir}" выходит за пределы workspace`);
    }
    const root = path.resolve(this.workspaceDir, subdir);
    const results: string[] = [];

    const walk = async (current: string): Promise<void> => {
      if (results.length >= limit) return;
      let entries;
      try {
        entries = await fs.readdir(current, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (results.length >= limit) return;
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
          await walk(full);
        } else if (entry.isFile()) {
          if (extensions.some((ext) => entry.name.endsWith(ext))) {
            results.push(normalizePath(path.relative(this.workspaceDir, full)));
          }
        }
      }
    };

    await walk(root);
    return results;
  }

  // ----- private -----

  private async ensureInitialized(): Promise<void> {
    await fs.mkdir(this.rootDir, { recursive: true });

    if (!(await this.exists(this.paths.meta))) {
      const meta: ProjectMeta = {
        schemaVersion: DEFAULT_SCHEMA_VERSION,
        projectName: path.basename(this.workspaceDir),
        settings: { rules: {} },
      };
      await this.writeJson(this.paths.meta, meta);
    }
    for (const p of [this.paths.requirements, this.paths.stakeholders, this.paths.businessRules]) {
      if (!(await this.exists(p))) await this.writeJson(p, []);
    }
    if (!(await this.exists(this.paths.activities))) {
      await fs.writeFile(this.paths.activities, '', 'utf-8');
    }
  }

  private async exists(absPath: string): Promise<boolean> {
    try {
      await fs.access(absPath);
      return true;
    } catch {
      return false;
    }
  }

  private async readJson<T>(filePath: string, schema: { parse(v: unknown): T }): Promise<T> {
    const raw = await fs.readFile(filePath, 'utf-8');
    return schema.parse(JSON.parse(raw));
  }

  private async writeJson(filePath: string, data: unknown): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tmp, filePath);
  }

  private async readActivities(): Promise<ActivityEvent[]> {
    try {
      const raw = await fs.readFile(this.paths.activities, 'utf-8');
      const lines = raw.split('\n').filter((l) => l.trim().length > 0);
      const tail = lines.slice(-this.activityLimit);
      const events: ActivityEvent[] = [];
      for (const line of tail) {
        try {
          events.push(ActivityEventSchema.parse(JSON.parse(line)));
        } catch {
          /* пропускаем повреждённые строки */
        }
      }
      return events;
    } catch {
      return [];
    }
  }
}
