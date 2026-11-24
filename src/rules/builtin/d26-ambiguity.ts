import { z } from 'zod';
import type { Rule, RuleViolation } from '../types.js';

const TERMS: { term: string; suggestion: string }[] = [
  { term: 'быстро',     suggestion: 'Укажите точное время отклика (например, "< 2 сек")' },
  { term: 'быстрый',    suggestion: 'Укажите измеримую величину' },
  { term: 'удобно',     suggestion: 'Укажите метрику UX (например, "не более 3 кликов")' },
  { term: 'иногда',     suggestion: 'Укажите точную частоту или условие' },
  { term: 'часто',      suggestion: 'Укажите количественный порог' },
  { term: 'простой',    suggestion: 'Опишите конкретные шаги сценария' },
  { term: 'легко',      suggestion: 'Укажите измеримый критерий освоения' },
  { term: 'надёжно',    suggestion: 'Укажите SLA / допустимый процент ошибок' },
  { term: 'надежно',    suggestion: 'Укажите SLA / допустимый процент ошибок' },
  { term: 'эффективно', suggestion: 'Укажите измеримый критерий эффективности' },
];

const OptionsSchema = z.object({
  extraTerms: z.array(z.object({ term: z.string(), suggestion: z.string() })).default([]),
});
type Options = z.infer<typeof OptionsSchema>;

export const d26Ambiguity: Rule<Options> = {
  id: 'D26',
  name: 'Проверка неоднозначных терминов',
  category: 'ambiguity',
  severity: 'warning',
  description: 'Поиск субъективных и неизмеримых терминов',
  optionsSchema: OptionsSchema,
  evaluate({ requirement }, options) {
    const violations: RuleViolation[] = [];
    const terms = [...TERMS, ...options.extraTerms];

    const check = (field: 'title' | 'description', text: string) => {
      const lower = text.toLowerCase();
      for (const { term, suggestion } of terms) {
        if (lower.includes(term)) {
          violations.push({
            message: `Неоднозначный термин "${term}". ${suggestion}`,
            field,
          });
        }
      }
    };

    check('title', requirement.title);
    check('description', requirement.description);

    return {
      pass: violations.length === 0,
      message:
        violations.length === 0
          ? 'Неоднозначностей не найдено'
          : `Найдено проблем: ${violations.length}`,
      violations,
    };
  },
};
