import { z } from 'zod';
import type { Rule, RuleViolation } from '../types.js';

const OptionsSchema = z.object({
  priorities: z.array(z.enum(['Must', 'Should', 'Could', 'Wont'])).default(['Must']),
});
type Options = z.infer<typeof OptionsSchema>;

export const t01Traceability: Rule<Options> = {
  id: 'T01',
  name: 'Трассируемость критичных требований',
  category: 'traceability',
  severity: 'error',
  description: 'Критичные требования должны иметь привязку к коду реализации',
  optionsSchema: OptionsSchema,
  evaluate({ requirement }, options) {
    if (!options.priorities.includes(requirement.priority)) {
      return { pass: true, message: 'Правило неприменимо для этого приоритета', violations: [] };
    }

    const violations: RuleViolation[] = [];
    if (requirement.codeRefs.length === 0) {
      violations.push({
        message: `${requirement.priority}-требование не имеет codeRefs. Укажите файл реализации через link_code_ref.`,
        field: 'codeRefs',
      });
    }

    return {
      pass: violations.length === 0,
      message: violations.length === 0 ? 'Трассируемость в порядке' : 'Нарушена трассируемость',
      violations,
    };
  },
};
