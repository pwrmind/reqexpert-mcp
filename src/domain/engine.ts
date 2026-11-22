import {
  ExpertRule,
  ProjectState,
  Requirement,
  RequirementSchema,
  RuleCheckResult,
  Stakeholder,
} from '../core/schema.js';
import { ProjectStore } from '../core/store.js';
import { executeRuleInSandbox } from '../core/rule-sandbox.js';

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

  async checkTextAmbiguity(text: string) {
    const state = await this.store.load();
    const ruleD26 = state.expertRules.find((r) => r.id === 'D26');
    if (!ruleD26) return { pass: true, issues: [] };

    const mockReq = RequirementSchema.parse({ id: 'TMP', title: text });
    return executeRuleInSandbox(ruleD26, mockReq);
  }

  async analyzeImpact(id: string) {
    const state = await this.store.load();
    const target = state.requirements.find((r) => r.id === id);
    if (!target) throw new Error(`Требование ${id} не найдено`);

    const directDependents = state.requirements.filter((r) =>
      r.dependencies.includes(id)
    );
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

  async getFullState(): Promise<ProjectState> {
    return this.store.load();
  }

  async generateMarkdownSRS(): Promise<string> {
    const state = await this.store.load();
    const lines = [
      `# Спецификация требований к ПО (SRS): ${state.projectName}`,
      `Дата генерации: ${new Date().toISOString().split('T')[0]}`,
      ``,
      `## 1. Заинтересованные лица`,
      ...state.stakeholders.map((s) => `- **${s.name}** — ${s.role} (вовлеченность: ${s.involvement})`),
      ``,
      `## 2. Требования (${state.requirements.length})`,
      ...state.requirements.map(
        (r) =>
          `### [${r.id}] ${r.title}\n` +
          `- **Тип:** ${r.type} | **Приоритет:** ${r.priority} | **Статус:** ${r.status} | **Качество:** ${this.calculateScore(r)}%\n` +
          `- **Описание:** ${r.description || '—'}\n` +
          `- **Критерии приемки:**\n${r.acceptanceCriteria || 'Не указаны'}\n`
      ),
    ];
    return lines.join('\n');
  }
}