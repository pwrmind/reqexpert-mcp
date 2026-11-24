import { z } from 'zod';
import type { Rule, RuleViolation } from '../types.js';

const OptionsSchema = z.object({
  minLength: z.number().int().positive().default(20),
});
type Options = z.infer<typeof OptionsSchema>;

export const h78AcceptanceCriteria: Rule<Options> = {
  id: 'H78',
  name: 'Обязательность критериев приёмки',
  category: 'completeness',
  severity: 'error',
  description: 'Требование должно содержать детализированные критерии приёмки',
  optionsSchema: OptionsSchema,
  evaluate({ requirement }, options) {
    const violations: RuleViolation[] = [];
    const ac = requirement.acceptanceCriteria.trim();

    if (!ac) {
      violations.push({
        message: 'Отсутствуют критерии приёмки (acceptanceCriteria)',
        field: 'acceptanceCriteria',
      });
    } else if (ac.length < options.minLength) {
      violations.push({
        message: `Критерии приёмки слишком кратки (< ${options.minLength} символов).`,
        field: 'acceptanceCriteria',
      });
    }

    return {
      pass: violations.length === 0,
      message: violations.length === 0 ? 'Критерии приёмки корректны' : 'Проблемы с критериями приёмки',
      violations,
    };
  },
};
