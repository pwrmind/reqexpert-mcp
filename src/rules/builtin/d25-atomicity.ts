import { z } from 'zod';
import type { Rule, RuleViolation } from '../types.js';

const CONJUNCTIONS = [
  ' и ', ', а также ', ', также ', ', кроме ', ', плюс ',
  ' and ', ', and ', ', as well as ', ' as well as ',
  ', also ', ', plus ', ' plus ', ', besides ',
  ', in addition to ', ', along with ', ' along with ',
];

const OptionsSchema = z.object({
  maxSentences: z.number().int().positive().default(3),
});
type Options = z.infer<typeof OptionsSchema>;

export const d25Atomicity: Rule<Options> = {
  id: 'D25',
  name: 'Проверка атомарности требований',
  category: 'structure',
  severity: 'error',
  description: 'Требование должно описывать одну функциональность, а не набор',
  optionsSchema: OptionsSchema,
  evaluate({ requirement }, options) {
    const violations: RuleViolation[] = [];

    for (const c of CONJUNCTIONS) {
      if (requirement.title.includes(c)) {
        violations.push({
          message: `Заголовок содержит составную конструкцию "${c.trim()}".`,
          field: 'title',
        });
      }
      if (requirement.description.includes(c)) {
        violations.push({
          message: `Описание содержит составную конструкцию "${c.trim()}".`,
          field: 'description',
        });
      }
    }

    const sentences = requirement.description
      .split('.')
      .map((s) => s.trim())
      .filter(Boolean);

    if (sentences.length > options.maxSentences) {
      violations.push({
        message: `Описание содержит ${sentences.length} предложений (порог: ${options.maxSentences}).`,
        field: 'description',
      });
    }

    return {
      pass: violations.length === 0,
      message: violations.length === 0 ? 'Требование атомарно' : 'Нарушена атомарность',
      violations,
    };
  },
};
