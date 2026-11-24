import { StakeholderSchema } from '../core/schema.js';
import type { Stakeholder } from '../core/schema.js';
import { NotFoundError } from '../core/errors.js';
import { nextStakeholderId } from '../core/ids.js';
import type { Store } from '../persistence/store.js';

export interface CreateStakeholderInput {
  name: string;
  role: string;
  involvement?: Stakeholder['involvement'];
}

export interface UpdateStakeholderInput {
  name?: string;
  role?: string;
  involvement?: Stakeholder['involvement'];
}

export interface StakeholderSearchFilter {
  keyword?: string;
  role?: string;
  involvement?: Stakeholder['involvement'];
}

export class StakeholderService {
  constructor(private readonly store: Store) {}

  async create(input: CreateStakeholderInput): Promise<Stakeholder> {
    const snap = await this.store.load();
    const id = nextStakeholderId(snap.stakeholders);
    const stakeholder = StakeholderSchema.parse({ ...input, id });
    await this.store.saveStakeholders([...snap.stakeholders, stakeholder]);
    await this.store.appendActivity({
      type: 'stakeholder.created',
      message: `Добавлен стейкхолдер ${stakeholder.name} (#${id})`,
      timestamp: Date.now(),
      stakeholderId: id,
    });
    return stakeholder;
  }

  async get(id: number): Promise<Stakeholder> {
    const snap = await this.store.load();
    const s = snap.stakeholders.find((x) => x.id === id);
    if (!s) throw new NotFoundError('Стейкхолдер', id);
    return s;
  }

  async update(id: number, patch: UpdateStakeholderInput): Promise<Stakeholder> {
    const snap = await this.store.load();
    const idx = snap.stakeholders.findIndex((s) => s.id === id);
    if (idx === -1) throw new NotFoundError('Стейкхолдер', id);

    const updated = StakeholderSchema.parse({ ...snap.stakeholders[idx], ...patch, id });
    const next = snap.stakeholders.slice();
    next[idx] = updated;
    await this.store.saveStakeholders(next);
    await this.store.appendActivity({
      type: 'stakeholder.updated',
      message: `Обновлён стейкхолдер ${updated.name} (#${id})`,
      timestamp: Date.now(),
      stakeholderId: id,
    });
    return updated;
  }

  async remove(id: number): Promise<{ deletedId: number; deletedName: string }> {
    const snap = await this.store.load();
    const deleted = snap.stakeholders.find((s) => s.id === id);
    if (!deleted) throw new NotFoundError('Стейкхолдер', id);

    await this.store.saveStakeholders(snap.stakeholders.filter((s) => s.id !== id));
    await this.store.appendActivity({
      type: 'stakeholder.deleted',
      message: `Удалён стейкхолдер ${deleted.name} (#${id})`,
      timestamp: Date.now(),
      stakeholderId: id,
    });
    return { deletedId: id, deletedName: deleted.name };
  }

  async search(filter: StakeholderSearchFilter = {}): Promise<{ total: number; items: Stakeholder[] }> {
    const snap = await this.store.load();
    const kw = filter.keyword?.trim().toLowerCase();

    const items = snap.stakeholders.filter((s) => {
      if (filter.role && s.role !== filter.role) return false;
      if (filter.involvement && s.involvement !== filter.involvement) return false;
      if (kw) {
        const hay = `${s.name} ${s.role}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });

    return { total: items.length, items };
  }
}
