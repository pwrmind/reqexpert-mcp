import { RequirementSchema } from '../core/schema.js';
import type { ProjectSnapshot, Requirement } from '../core/schema.js';
import { ConflictError, NotFoundError } from '../core/errors.js';
import { nextRequirementId } from '../core/ids.js';
import type { Store } from '../persistence/store.js';
import type { RequirementEvaluation, RuleEngine } from '../rules/engine.js';
import type { QualityScorer } from '../rules/scoring.js';

export interface CreateRequirementInput {
  title: string;
  type?: Requirement['type'];
  priority?: Requirement['priority'];
  description?: string;
  acceptanceCriteria?: string;
  source?: string;
  dependencies?: string[];
  codeRefs?: string[];
  verifiedBy?: string[];
}

export interface UpdateRequirementInput {
  title?: string;
  type?: Requirement['type'];
  priority?: Requirement['priority'];
  status?: Requirement['status'];
  description?: string;
  acceptanceCriteria?: string;
  source?: string;
  testability?: Requirement['testability'];
  stability?: Requirement['stability'];
  complexity?: Requirement['complexity'];
  dependencies?: string[];
  codeRefs?: string[];
  verifiedBy?: string[];
}

export interface RequirementSearchFilter {
  keyword?: string;
  type?: Requirement['type'];
  priority?: Requirement['priority'];
  status?: Requirement['status'];
  source?: string;
  testability?: Requirement['testability'];
  stability?: Requirement['stability'];
  hasCodeRefs?: boolean;
  hasTests?: boolean;
  limit?: number;
}

export interface RequirementReport {
  requirement: Requirement;
  qualityScore: number;
  evaluation: RequirementEvaluation;
}

export interface RequirementSearchResult {
  total: number;
  returned: number;
  items: Array<{
    id: string;
    title: string;
    type: Requirement['type'];
    priority: Requirement['priority'];
    status: Requirement['status'];
    qualityScore: number;
    codeRefsCount: number;
    testsCount: number;
  }>;
}

export class RequirementService {
  constructor(
    private readonly store: Store,
    private readonly rules: RuleEngine,
    private readonly scorer: QualityScorer,
  ) {}

  async create(input: CreateRequirementInput): Promise<RequirementReport> {
    const snap = await this.store.load();
    const type = input.type ?? 'Функциональное';
    const id = nextRequirementId(snap.requirements, type);

    if (snap.requirements.some((r) => r.id === id)) {
      throw new ConflictError(`Требование ${id} уже существует`);
    }

    const requirement = RequirementSchema.parse({ ...input, id, type });
    const next = [...snap.requirements, requirement];
    await this.store.saveRequirements(next);
    await this.store.appendActivity({
      type: 'requirement.created',
      message: `Добавлено требование ${id}`,
      timestamp: Date.now(),
      requirementId: id,
    });

    return this.buildReport(requirement, { ...snap, requirements: next });
  }

  async get(id: string): Promise<RequirementReport> {
    const snap = await this.store.load();
    const req = snap.requirements.find((r) => r.id === id);
    if (!req) throw new NotFoundError('Требование', id);
    return this.buildReport(req, snap);
  }

  async update(id: string, patch: UpdateRequirementInput): Promise<RequirementReport> {
    const snap = await this.store.load();
    const idx = snap.requirements.findIndex((r) => r.id === id);
    if (idx === -1) throw new NotFoundError('Требование', id);

    const merged = RequirementSchema.parse({ ...snap.requirements[idx], ...patch, id });
    const next = snap.requirements.slice();
    next[idx] = merged;
    await this.store.saveRequirements(next);
    await this.store.appendActivity({
      type: 'requirement.updated',
      message: `Обновлено требование ${id}`,
      timestamp: Date.now(),
      requirementId: id,
    });

    return this.buildReport(merged, { ...snap, requirements: next });
  }

  async remove(
    id: string,
    force = false,
  ): Promise<{ deletedId: string; removedDependenciesFrom: string[]; forced: boolean }> {
    const snap = await this.store.load();
    if (!snap.requirements.some((r) => r.id === id)) {
      throw new NotFoundError('Требование', id);
    }

    const dependents = snap.requirements.filter((r) => r.dependencies.includes(id));
    if (dependents.length > 0 && !force) {
      throw new ConflictError(
        `Невозможно удалить ${id}: используется как зависимость в ${dependents
          .map((r) => r.id)
          .join(', ')}. Передайте force=true для принудительного удаления.`,
      );
    }

    const cleaned = snap.requirements
      .filter((r) => r.id !== id)
      .map((r) =>
        r.dependencies.includes(id)
          ? { ...r, dependencies: r.dependencies.filter((d) => d !== id) }
          : r,
      );

    await this.store.saveRequirements(cleaned);
    await this.store.appendActivity({
      type: 'requirement.deleted',
      message: `Удалено требование ${id}${force && dependents.length ? ' (force)' : ''}`,
      timestamp: Date.now(),
      requirementId: id,
    });

    return {
      deletedId: id,
      removedDependenciesFrom: dependents.map((r) => r.id),
      forced: dependents.length > 0,
    };
  }

  async search(filter: RequirementSearchFilter = {}): Promise<RequirementSearchResult> {
    const snap = await this.store.load();
    const kw = filter.keyword?.trim().toLowerCase();

    const matched = snap.requirements.filter((r) => {
      if (filter.type && r.type !== filter.type) return false;
      if (filter.priority && r.priority !== filter.priority) return false;
      if (filter.status && r.status !== filter.status) return false;
      if (filter.testability && r.testability !== filter.testability) return false;
      if (filter.stability && r.stability !== filter.stability) return false;
      if (filter.source && r.source !== filter.source) return false;
      if (filter.hasCodeRefs !== undefined && (r.codeRefs.length > 0) !== filter.hasCodeRefs) return false;
      if (filter.hasTests !== undefined && (r.verifiedBy.length > 0) !== filter.hasTests) return false;
      if (kw) {
        const hay = [r.id, r.title, r.description, r.acceptanceCriteria, r.source]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });

    const limited = filter.limit && filter.limit > 0 ? matched.slice(0, filter.limit) : matched;

    return {
      total: matched.length,
      returned: limited.length,
      items: limited.map((r) => ({
        id: r.id,
        title: r.title,
        type: r.type,
        priority: r.priority,
        status: r.status,
        qualityScore: this.scorer.score(r),
        codeRefsCount: r.codeRefs.length,
        testsCount: r.verifiedBy.length,
      })),
    };
  }

  private async buildReport(req: Requirement, snap: ProjectSnapshot): Promise<RequirementReport> {
    const evaluation = await this.rules.evaluate(req, snap);
    return { requirement: req, qualityScore: this.scorer.score(req), evaluation };
  }
}
