import { z } from 'zod';
import type { Rule, RuleViolation } from '../types.js';
import type { Requirement } from '../../core/schema.js';

const OptionsSchema = z.object({
  threshold: z.number().min(0).max(1).default(0.75),
});
type Options = z.infer<typeof OptionsSchema>;

const textOf = (r: Readonly<Requirement>): string =>
  `${r.title} ${r.description}`.toLowerCase().replace(/\s+/g, ' ').trim();

export const d28DuplicatesDice: Rule<Options> = {
  id: 'D28',
  name: 'Проверка смысловых дубликатов (биграммы Дайса)',
  category: 'duplication',
  severity: 'warning',
  description: 'Поиск похожих описаний с учётом перестановки слов',
  optionsSchema: OptionsSchema,
  evaluate({ requirement, allRequirements }, options) {
    const current = textOf(requirement);
    if (current.length < 20) {
      return { pass: true, message: 'Текст слишком короткий', violations: [] };
    }

    const violations: RuleViolation[] = [];
    for (const other of allRequirements) {
      if (other.id === requirement.id) continue;
      const otherText = textOf(other);
      if (!otherText) continue;
      const score = similarityDice(current, otherText);
      if (score >= options.threshold) {
        violations.push({
          message: `Текст на ${Math.round(score * 100)}% совпадает с [${other.id}]`,
          relatedRequirementIds: [other.id],
        });
      }
    }

    return {
      pass: violations.length === 0,
      message: violations.length === 0 ? 'Смысловых дубликатов нет' : 'Обнаружено пересечение описаний',
      violations,
    };
  },
};

function similarityDice(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigrams = (s: string): Map<string, number> => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const p = s.slice(i, i + 2);
      m.set(p, (m.get(p) ?? 0) + 1);
    }
    return m;
  };

  const A = bigrams(a);
  const B = bigrams(b);
  let overlap = 0;
  for (const [p, n] of A) {
    const bn = B.get(p);
    if (bn !== undefined) overlap += Math.min(n, bn);
  }
  return (2 * overlap) / (a.length + b.length - 2);
}
