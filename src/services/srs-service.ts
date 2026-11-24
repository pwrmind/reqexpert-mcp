import type { Store } from '../persistence/store.js';
import type { QualityScorer } from '../rules/scoring.js';

export class SrsService {
  constructor(
    private readonly store: Store,
    private readonly scorer: QualityScorer,
  ) {}

  async generateMarkdown(): Promise<string> {
    const snap = await this.store.load();
    const lines: string[] = [
      `# Спецификация требований к ПО (SRS): ${snap.meta.projectName}`,
      `Дата генерации: ${new Date().toISOString().split('T')[0]}`,
      '',
      `## 1. Заинтересованные лица (${snap.stakeholders.length})`,
    ];

    if (snap.stakeholders.length === 0) lines.push('_не заданы_');
    for (const s of snap.stakeholders) {
      lines.push(`- **${s.name}** — ${s.role} (вовлечённость: ${s.involvement})`);
    }

    if (snap.businessRules.length > 0) {
      lines.push('', `## 2. Бизнес-правила (${snap.businessRules.length})`);
      for (const br of snap.businessRules) {
        lines.push(
          `- **[${br.id}]** ${br.name || br.type}${br.active ? '' : ' _(неактивно)_'}: ${br.description}`,
        );
      }
    }

    lines.push('', `## 3. Требования (${snap.requirements.length})`);
    if (snap.requirements.length === 0) lines.push('_требования отсутствуют_');

    for (const r of snap.requirements) {
      const trace: string[] = [];
      if (r.codeRefs.length > 0) trace.push(`code: ${r.codeRefs.join(', ')}`);
      if (r.verifiedBy.length > 0) trace.push(`tests: ${r.verifiedBy.join(', ')}`);

      lines.push(
        `### [${r.id}] ${r.title}`,
        `- **Тип:** ${r.type} | **Приоритет:** ${r.priority} | **Статус:** ${r.status} | **Качество:** ${this.scorer.score(r)}%`,
        `- **Описание:** ${r.description || '—'}`,
        `- **Критерии приёмки:** ${r.acceptanceCriteria || '—'}`,
        ...(trace.length > 0 ? [`- **Трассировка:** ${trace.join(' | ')}`] : []),
        '',
      );
    }

    return lines.join('\n');
  }
}
