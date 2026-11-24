import { BusinessRuleSchema } from '../core/schema.js';
import type { BusinessRule } from '../core/schema.js';
import { ConflictError, NotFoundError } from '../core/errors.js';
import { nextBusinessRuleId } from '../core/ids.js';
import type { Store } from '../persistence/store.js';

export interface CreateBusinessRuleInput {
  description: string;
  name?: string;
  type?: string;
  source?: string;
  relatedRequirements?: string[];
  active?: boolean;
}

export interface UpdateBusinessRuleInput {
  name?: string;
  type?: string;
  description?: string;
  source?: string;
  active?: boolean;
  relatedRequirements?: string[];
}

export interface BusinessRuleSearchFilter {
  keyword?: string;
  type?: string;
  active?: boolean;
}

export class BusinessRuleService {
  constructor(private readonly store: Store) {}

  async create(input: CreateBusinessRuleInput): Promise<BusinessRule> {
    const snap = await this.store.load();
    const id = nextBusinessRuleId(snap.businessRules);
    if (snap.businessRules.some((r) => r.id === id)) {
      throw new ConflictError(`Бизнес-правило ${id} уже существует`);
    }
    const rule = BusinessRuleSchema.parse({ ...input, id });
    await this.store.saveBusinessRules([...snap.businessRules, rule]);
    await this.store.appendActivity({
      type: 'businessRule.created',
      message: `Добавлено бизнес-правило ${id}`,
      timestamp: Date.now(),
      businessRuleId: id,
    });
    return rule;
  }

  async get(id: string): Promise<BusinessRule> {
    const snap = await this.store.load();
    const rule = snap.businessRules.find((r) => r.id === id);
    if (!rule) throw new NotFoundError('Бизнес-правило', id);
    return rule;
  }

  async update(id: string, patch: UpdateBusinessRuleInput): Promise<BusinessRule> {
    const snap = await this.store.load();
    const idx = snap.businessRules.findIndex((r) => r.id === id);
    if (idx === -1) throw new NotFoundError('Бизнес-правило', id);

    const merged = BusinessRuleSchema.parse({ ...snap.businessRules[idx], ...patch, id });
    const next = snap.businessRules.slice();
    next[idx] = merged;
    await this.store.saveBusinessRules(next);
    await this.store.appendActivity({
      type: 'businessRule.updated',
      message: `Обновлено бизнес-правило ${id}`,
      timestamp: Date.now(),
      businessRuleId: id,
    });
    return merged;
  }

  async remove(id: string): Promise<{ deletedId: string }> {
    const snap = await this.store.load();
    if (!snap.businessRules.some((r) => r.id === id)) {
      throw new NotFoundError('Бизнес-правило', id);
    }
    await this.store.saveBusinessRules(snap.businessRules.filter((r) => r.id !== id));
    await this.store.appendActivity({
      type: 'businessRule.deleted',
      message: `Удалено бизнес-правило ${id}`,
      timestamp: Date.now(),
      businessRuleId: id,
    });
    return { deletedId: id };
  }

  async search(filter: BusinessRuleSearchFilter = {}): Promise<{ total: number; items: BusinessRule[] }> {
    const snap = await this.store.load();
    const kw = filter.keyword?.trim().toLowerCase();

    const items = snap.businessRules.filter((r) => {
      if (filter.type && r.type !== filter.type) return false;
      if (filter.active !== undefined && r.active !== filter.active) return false;
      if (kw) {
        const hay = [r.id, r.name, r.type, r.description, r.source].join(' ').toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
    return { total: items.length, items };
  }
}
