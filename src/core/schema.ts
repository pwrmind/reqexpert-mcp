import * as z from 'zod/v4';

export const RequirementTypeSchema = z.enum([
  'Функциональное',
  'Нефункциональное',
  'Бизнес-требование',
  'Пользовательское',
]);

export const PriorityMoSCoWSchema = z.enum(['Must', 'Should', 'Could', 'Wont']);

export const RequirementStatusSchema = z.enum([
  'Предложено',
  'Утверждено',
  'В работе',
  'Реализовано',
]);

export const LevelSchema = z.enum(['Высокая', 'Средняя', 'Низкая']);

export const RequirementSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  type: RequirementTypeSchema.default('Функциональное'),
  priority: PriorityMoSCoWSchema.default('Must'),
  status: RequirementStatusSchema.default('Предложено'),
  source: z.string().default(''),
  acceptanceCriteria: z.string().default(''),
  testability: LevelSchema.default('Высокая'),
  stability: LevelSchema.default('Высокая'),
  complexity: LevelSchema.default('Средняя'),
  description: z.string().default(''),
  dependencies: z.array(z.string()).default([]),
  // v1.2: трассировка
  codeRefs: z
    .array(z.string())
    .default([])
    .describe('Пути к файлам реализации относительно workspace'),
  verifiedBy: z
    .array(z.string())
    .default([])
    .describe('ID тест-кейсов / тестов, верифицирующих требование'),
});

export const StakeholderSchema = z.object({
  id: z.number(),
  name: z.string().min(1),
  role: z.string(),
  involvement: LevelSchema.default('Средняя'),
});

export const BusinessRuleSchema = z.object({
  id: z.string(),
  name: z.string().default(''),
  type: z.string().default('Бизнес-правило'),
  description: z.string(),
  source: z.string().default(''),
  active: z.boolean().default(true),
  relatedRequirements: z.array(z.string()).default([]),
});

export const ExpertRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  description: z.string(),
  checkLogic: z.string(),
  example: z.string().default(''),
  strictness: z.enum(['low', 'medium', 'high']).default('medium'),
  category: z.string().default('Качество требований'),
  active: z.boolean().default(true),
});

export const ProjectStateSchema = z.object({
  projectName: z.string().default('Новый проект'),
  requirements: z.array(RequirementSchema).default([]),
  stakeholders: z.array(StakeholderSchema).default([]),
  businessRules: z.array(BusinessRuleSchema).default([]),
  expertRules: z.array(ExpertRuleSchema).default([]),
  activities: z
    .array(
      z.object({
        type: z.string(),
        message: z.string(),
        timestamp: z.number(),
      })
    )
    .default([]),
});

export type Requirement = z.infer<typeof RequirementSchema>;
export type Stakeholder = z.infer<typeof StakeholderSchema>;
export type BusinessRule = z.infer<typeof BusinessRuleSchema>;
export type ExpertRule = z.infer<typeof ExpertRuleSchema>;
export type ProjectState = z.infer<typeof ProjectStateSchema>;

export interface RuleCheckResult {
  ruleId: string;
  ruleName: string;
  pass: boolean;
  message: string;
  issues: string[];
}