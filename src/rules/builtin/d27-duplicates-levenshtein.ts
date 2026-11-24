import { z } from 'zod';
import type { Rule, RuleViolation } from '../types.js';

const OptionsSchema = z.object({
  threshold: z.number().min(0).max(1).default(0.85),
  minTitleLength: z.number().int().min(0).default(10),
});
type Options = z.infer<typeof OptionsSchema>;

export const d27DuplicatesLevenshtein: Rule<Options> = {
  id: 'D27',
  name: 'Проверка на дубликаты (Левенштейн)',
  category: 'duplication',
  severity: 'warning',
  description: 'Поиск похожих требований по заголовку через расстояние Левенштейна',
  optionsSchema: OptionsSchema,
  evaluate({ requirement, allRequirements }, options) {
    const current = requirement.title.trim();
    if (current.length < options.minTitleLength) {
      return {
        pass: true,
        message: 'Заголовок слишком короткий для сравнения',
        violations: [],
      };
    }

    const violations: RuleViolation[] = [];
    for (const other of allRequirements) {
      if (other.id === requirement.id) continue;
      const score = similarityLevenshtein(current, other.title);
      if (score >= options.threshold) {
        violations.push({
          message: `Схожесть ${Math.round(score * 100)}% с [${other.id}] "${other.title}"`,
          field: 'title',
          relatedRequirementIds: [other.id],
        });
      }
    }

    return {
      pass: violations.length === 0,
      message: violations.length === 0 ? 'Дубликатов не найдено' : 'Найдены похожие требования',
      violations,
    };
  },
};

function similarityLevenshtein(a: string, b: string): number {
  a = a.toLowerCase().trim();
  b = b.toLowerCase().trim();
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;

  const n = a.length;
  const m = b.length;
  const width = n + 1;
  const matrix = new Int32Array((m + 1) * width);

  for (let j = 0; j <= n; j++) matrix[j] = j;

  for (let i = 1; i <= m; i++) {
    const prevRow = (i - 1) * width;
    const currRow = i * width;
    matrix[currRow] = i;

    for (let j = 1; j <= n; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      const del = matrix[prevRow + j]! + 1;
      const ins = matrix[currRow + j - 1]! + 1;
      const sub = matrix[prevRow + j - 1]! + cost;
      matrix[currRow + j] = Math.min(del, ins, sub);
    }
  }

  return 1 - matrix[m * width + n]! / maxLen;
}