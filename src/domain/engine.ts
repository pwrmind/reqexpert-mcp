import {
  BusinessRule,
  BusinessRuleSchema,
  ExpertRule,
  ExpertRuleSchema,
  ProjectState,
  Requirement,
  RequirementSchema,
  RuleCheckResult,
  Stakeholder,
  StakeholderSchema,
} from '../core/schema.js';
import { ProjectStore } from '../core/store.js';
import { executeRuleInSandbox } from '../core/rule-sandbox.js';

export interface RequirementSearchFilter {
  keyword?: string;
  type?: Requirement['type'];
  priority?: Requirement['priority'];
  status?: Requirement['status'];
  source?: string;
  testability?: Requirement['testability'];
  stability?: Requirement['stability'];
  limit?: number;
}

export interface StakeholderSearchFilter {
  keyword?: string;
  role?: string;
  involvement?: Stakeholder['involvement'];
}

export interface BusinessRuleSearchFilter {
  keyword?: string;
  type?: string;
  active?: boolean;
}

export interface ExpertRuleSearchFilter {
  keyword?: string;
  type?: string;
  category?: string;
  active?: boolean;
}

export class ReqExpertEngine {
  constructor(private store: ProjectStore) {}

  private logActivity(state: ProjectState, type: string, message: string) {
    state.activities.unshift({ type, message, timestamp: Date.now() });
    if (state.activities.length > 50) state.activities.length = 50;
  }

  private nextRequirementId(state: ProjectState, type: Requirement['type']): string {
    const prefix =
      type === 'Функциональное' ? 'FR' : type === 'Нефункциональное' ? 'NFR' : 'REQ';
    const maxNum = state.requirements
      .filter((r) => r.id.startsWith(`${prefix}-`))
      .map((r) => parseInt(r.id.split('-')[1] || '0', 10))
      .reduce((max, n) => (Number.isNaN(n) ? max : Math.max(max, n)), 0);
    return `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
  }

  private nextBusinessRuleId(state: ProjectState): string {
    const maxNum = state.businessRules
      .map((r) => parseInt(r.id.replace(/^BR-/, ''), 10))
      .filter((n) => !Number.isNaN(n))
      .reduce((m, n) => Math.max(m, n), 0);
    return `BR-${String(maxNum + 1).padStart(3, '0')}`;
  }

  calculateScore(req: Requirement): number {
    let score = 0;
    if (req.acceptanceCriteria.trim().length > 0) score += 40;
    if (req.source.trim().length > 0) score += 20;
    if (req.testability === 'Высокая') score += 20;
    else if (req.testability === 'Средняя') score += 10;
    if (req.stability === 'Высокая') score += 10;
    else if (req.stability === 'Средняя') score += 5;
    if (req.description.trim().length > 0) score += 10;
    return Math.min(100, score);
  }

  validateRequirementObject(state: ProjectState, req: Requirement): RuleCheckResult[] {
    return state.expertRules
      .filter((r) => r.active)
      .map((rule) => executeRuleInSandbox(rule, req));
  }

  // ======================= REQUIREMENTS =======================

  async getRequirement(id: string) {
    const state = await this.store.load();
    const req = state.requirements.find((r) => r.id === id);
    if (!req) throw new Error(`Требование ${id} не найдено`);
    const checks = this.validateRequirementObject(state, req);
    return {
      requirement: req,
      qualityScore: this.calculateScore(req),
      validationPassed: checks.every((c) => c.pass),
      violations: checks.filter((c) => !c.pass),
    };
  }

  async addRequirement(input: Partial<Requirement> & { title: string }) {
    const state = await this.store.load();
    const type = input.type ?? 'Функциональное';
    const id = input.id ?? this.nextRequirementId(state, type);

    if (state.requirements.some((r) => r.id === id)) {
      throw new Error(`Требование с ID ${id} уже существует`);
    }

    const req = RequirementSchema.parse({ ...input, id, type });
    state.requirements.push(req);
    this.logActivity(state, 'requirement', `Добавлено требование ${req.id}`);
    await this.store.save(state);

    const checks = this.validateRequirementObject(state, req);
    return {
      requirement: req,
      qualityScore: this.calculateScore(req),
      validationPassed: checks.every((c) => c.pass),
      violations: checks.filter((c) => !c.pass),
    };
  }

  async updateRequirement(id: string, patch: Partial<Requirement>) {
    const state = await this.store.load();
    const idx = state.requirements.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`Требование ${id} не найдено`);

    const updated = RequirementSchema.parse({ ...state.requirements[idx], ...patch, id });
    state.requirements[idx] = updated;
    this.logActivity(state, 'requirement', `Обновлено требование ${id}`);
    await this.store.save(state);

    const checks = this.validateRequirementObject(state, updated);
    return {
      requirement: updated,
      qualityScore: this.calculateScore(updated),
      validationPassed: checks.every((c) => c.pass),
      violations: checks.filter((c) => !c.pass),
    };
  }

  async deleteRequirement(id: string, force = false) {
    const state = await this.store.load();
    const idx = state.requirements.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`Требование ${id} не найдено`);

    const dependents = state.requirements.filter((r) => r.dependencies.includes(id));
    if (dependents.length > 0 && !force) {
      throw new Error(
        `Невозможно удалить ${id}: используется как зависимость в ${dependents
          .map((r) => r.id)
          .join(', ')}. Передайте force=true для принудительного удаления.`
      );
    }

    for (const r of state.requirements) {
      if (r.dependencies.includes(id)) {
        r.dependencies = r.dependencies.filter((d) => d !== id);
      }
    }

    state.requirements.splice(idx, 1);
    this.logActivity(state, 'requirement', `Удалено требование ${id}`);
    await this.store.save(state);

    return {
      deletedId: id,
      removedDependenciesFrom: dependents.map((r) => r.id),
      forced: dependents.length > 0,
    };
  }

  async searchRequirements(filter: RequirementSearchFilter = {}) {
    const state = await this.store.load();
    const kw = filter.keyword?.trim().toLowerCase();

    const matched = state.requirements.filter((r) => {
      if (filter.type && r.type !== filter.type) return false;
      if (filter.priority && r.priority !== filter.priority) return false;
      if (filter.status && r.status !== filter.status) return false;
      if (filter.testability && r.testability !== filter.testability) return false;
      if (filter.stability && r.stability !== filter.stability) return false;
      if (filter.source && r.source !== filter.source) return false;
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
        qualityScore: this.calculateScore(r),
      })),
    };
  }

  // ======================= STAKEHOLDERS =======================

  async addStakeholder(
    name: string,
    role: string,
    involvement: Stakeholder['involvement'] = 'Средняя'
  ) {
    const state = await this.store.load();
    const nextId = state.stakeholders.reduce((m, s) => Math.max(m, s.id), 0) + 1;
    const stakeholder: Stakeholder = { id: nextId, name, role, involvement };
    state.stakeholders.push(stakeholder);
    this.logActivity(state, 'stakeholder', `Добавлено заинтересованное лицо: ${name}`);
    await this.store.save(state);
    return stakeholder;
  }

  async updateStakeholder(id: number, patch: Partial<Omit<Stakeholder, 'id'>>) {
    const state = await this.store.load();
    const idx = state.stakeholders.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error(`Стейкхолдер ${id} не найден`);

    const updated = StakeholderSchema.parse({ ...state.stakeholders[idx], ...patch, id });
    state.stakeholders[idx] = updated;
    this.logActivity(state, 'stakeholder', `Обновлен стейкхолдер ${updated.name}`);
    await this.store.save(state);
    return updated;
  }

  async deleteStakeholder(id: number) {
    const state = await this.store.load();
    const idx = state.stakeholders.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error(`Стейкхолдер ${id} не найден`);

    const [deleted] = state.stakeholders.splice(idx, 1);
    this.logActivity(state, 'stakeholder', `Удален стейкхолдер ${deleted.name}`);
    await this.store.save(state);
    return { deletedId: id, deletedName: deleted.name };
  }

  async searchStakeholders(filter: StakeholderSearchFilter = {}) {
    const state = await this.store.load();
    const kw = filter.keyword?.trim().toLowerCase();

    const items = state.stakeholders.filter((s) => {
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

  // ======================= BUSINESS RULES =======================

  async addBusinessRule(input: Partial<BusinessRule> & { description: string }) {
    const state = await this.store.load();
    const id = input.id ?? this.nextBusinessRuleId(state);

    if (state.businessRules.some((r) => r.id === id)) {
      throw new Error(`Бизнес-правило ${id} уже существует`);
    }

    const rule = BusinessRuleSchema.parse({ ...input, id });
    state.businessRules.push(rule);
    this.logActivity(state, 'businessRule', `Добавлено бизнес-правило ${rule.id}`);
    await this.store.save(state);
    return rule;
  }

  async updateBusinessRule(id: string, patch: Partial<BusinessRule>) {
    const state = await this.store.load();
    const idx = state.businessRules.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`Бизнес-правило ${id} не найдено`);

    const updated = BusinessRuleSchema.parse({ ...state.businessRules[idx], ...patch, id });
    state.businessRules[idx] = updated;
    this.logActivity(state, 'businessRule', `Обновлено бизнес-правило ${id}`);
    await this.store.save(state);
    return updated;
  }

  async deleteBusinessRule(id: string) {
    const state = await this.store.load();
    const idx = state.businessRules.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`Бизнес-правило ${id} не найдено`);

    state.businessRules.splice(idx, 1);
    this.logActivity(state, 'businessRule', `Удалено бизнес-правило ${id}`);
    await this.store.save(state);
    return { deletedId: id };
  }

  async searchBusinessRules(filter: BusinessRuleSearchFilter = {}) {
    const state = await this.store.load();
    const kw = filter.keyword?.trim().toLowerCase();

    const items = state.businessRules.filter((r) => {
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

  // ======================= EXPERT RULES =======================

  async addExpertRule(rule: ExpertRule) {
    const state = await this.store.load();
    if (state.expertRules.some((r) => r.id === rule.id)) {
      throw new Error(`Правило ЭС ${rule.id} уже существует`);
    }
    state.expertRules.push(rule);
    this.logActivity(state, 'expertRule', `Добавлено правило ЭС ${rule.id}`);
    await this.store.save(state);
    return rule;
  }

  async updateExpertRule(id: string, patch: Partial<ExpertRule>) {
    const state = await this.store.load();
    const idx = state.expertRules.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`Правило ЭС ${id} не найдено`);

    const updated = ExpertRuleSchema.parse({ ...state.expertRules[idx], ...patch, id });
    state.expertRules[idx] = updated;
    this.logActivity(state, 'expertRule', `Обновлено правило ЭС ${id}`);
    await this.store.save(state);
    return updated;
  }

  async deleteExpertRule(id: string) {
    const state = await this.store.load();
    const idx = state.expertRules.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`Правило ЭС ${id} не найдено`);

    state.expertRules.splice(idx, 1);
    this.logActivity(state, 'expertRule', `Удалено правило ЭС ${id}`);
    await this.store.save(state);
    return { deletedId: id };
  }

  async toggleExpertRule(id: string, active?: boolean) {
    const state = await this.store.load();
    const rule = state.expertRules.find((r) => r.id === id);
    if (!rule) throw new Error(`Правило ЭС ${id} не найдено`);

    rule.active = active === undefined ? !rule.active : active;
    this.logActivity(
      state,
      'expertRule',
      `Правило ЭС ${id} ${rule.active ? 'активировано' : 'деактивировано'}`
    );
    await this.store.save(state);
    return rule;
  }

  async searchExpertRules(filter: ExpertRuleSearchFilter = {}) {
    const state = await this.store.load();
    const kw = filter.keyword?.trim().toLowerCase();

    const items = state.expertRules.filter((r) => {
      if (filter.type && r.type !== filter.type) return false;
      if (filter.category && r.category !== filter.category) return false;
      if (filter.active !== undefined && r.active !== filter.active) return false;
      if (kw) {
        const hay = [r.id, r.name, r.description, r.category].join(' ').toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });

    return { total: items.length, items };
  }

  // ======================= MISC =======================

  async checkTextAmbiguity(text: string) {
    const state = await this.store.load();
    const ruleD26 = state.expertRules.find((r) => r.id === 'D26' && r.active);
    if (!ruleD26) {
      return {
        pass: true,
        issues: [],
        message: 'Правило D26 отсутствует или неактивно',
      };
    }

    const mockReq = RequirementSchema.parse({ id: 'TMP', title: text });
    return executeRuleInSandbox(ruleD26, mockReq);
  }

  async analyzeImpact(id: string) {
    const state = await this.store.load();
    const target = state.requirements.find((r) => r.id === id);
    if (!target) throw new Error(`Требование ${id} не найдено`);

    const directDependents = state.requirements.filter((r) => r.dependencies.includes(id));
    const sameSource = target.source
      ? state.requirements.filter((r) => r.id !== id && r.source === target.source)
      : [];

    const risk =
      target.priority === 'Must' || directDependents.length >= 3
        ? 'Высокий'
        : directDependents.length > 0
          ? 'Средний'
          : 'Низкий';

    return {
      requirementId: id,
      priority: target.priority,
      directDependents: directDependents.map((r) => ({ id: r.id, title: r.title })),
      relatedBySource: sameSource.map((r) => ({ id: r.id, title: r.title })),
      risk,
    };
  }

  async getFullState(): Promise<ProjectState> {
    return this.store.load();
  }

  async generateMarkdownSRS(): Promise<string> {
    const state = await this.store.load();
    const lines = [
      `# Спецификация требований к ПО (SRS): ${state.projectName}`,
      `Дата генерации: ${new Date().toISOString().split('T')[0]}`,
      ``,
      `## 1. Заинтересованные лица (${state.stakeholders.length})`,
      ...state.stakeholders.map(
        (s) => `- **${s.name}** — ${s.role} (вовлеченность: ${s.involvement})`
      ),
    ];

    if (state.businessRules.length > 0) {
      lines.push(``, `## 2. Бизнес-правила (${state.businessRules.length})`);
      for (const br of state.businessRules) {
        lines.push(
          `- **[${br.id}]** ${br.name || br.type}${br.active ? '' : ' _(неактивно)_'}: ${br.description}`
        );
      }
    }

    lines.push(
      ``,
      `## 3. Требования (${state.requirements.length})`,
      ...state.requirements.map(
        (r) =>
          `### [${r.id}] ${r.title}\n` +
          `- **Тип:** ${r.type} | **Приоритет:** ${r.priority} | **Статус:** ${r.status} | **Качество:** ${this.calculateScore(r)}%\n` +
          `- **Описание:** ${r.description || '—'}\n` +
          `- **Критерии приемки:**\n${r.acceptanceCriteria || 'Не указаны'}\n`
      )
    );

    return lines.join('\n');
  }
}