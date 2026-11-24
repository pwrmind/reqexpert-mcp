import type {
  ActivityEvent,
  BusinessRule,
  ProjectMeta,
  ProjectSnapshot,
  Requirement,
  Stakeholder,
} from '../core/schema.js';

export interface Store {
  load(): Promise<ProjectSnapshot>;
  saveMeta(meta: ProjectMeta): Promise<void>;
  saveRequirements(reqs: readonly Requirement[]): Promise<void>;
  saveStakeholders(stakeholders: readonly Stakeholder[]): Promise<void>;
  saveBusinessRules(rules: readonly BusinessRule[]): Promise<void>;
  appendActivity(event: ActivityEvent): Promise<void>;
  fileExists(relPath: string): Promise<boolean>;
  walkFiles(subdir: string, extensions: readonly string[], limit: number): Promise<string[]>;
}