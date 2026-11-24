import { z } from 'zod';

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
  codeRefs: z.array(z.string()).default([]),
  verifiedBy: z.array(z.string()).default([]),
});

export const StakeholderSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  role: z.string(),
  involvement: LevelSchema.default('Средняя'),
});

export const BusinessRuleSchema = z.object({
  id: z.string(),
  name: z.string().default(''),
  type: z.string().default('Бизнес-правило'),
  description: z.string().min(1),
  source: z.string().default(''),
  active: z.boolean().default(true),
  relatedRequirements: z.array(z.string()).default([]),
});

export const ActivityEventSchema = z.object({
  type: z.string(),
  message: z.string(),
  timestamp: z.number(),
  requirementId: z.string().optional(),
  stakeholderId: z.number().optional(),
  businessRuleId: z.string().optional(),
});

export const RuleConfigSchema = z.object({
  enabled: z.boolean().default(true),
  options: z.record(z.string(), z.unknown()).optional(),
});

export const ProjectSettingsSchema = z.object({
  rules: z.record(z.string(), RuleConfigSchema).default({}),
});

export const ProjectMetaSchema = z.object({
  schemaVersion: z.number().int().positive().default(2),
  projectName: z.string().default('Новый проект'),
  settings: ProjectSettingsSchema.default({ rules: {} }),
});

export type Requirement = z.infer<typeof RequirementSchema>;
export type Stakeholder = z.infer<typeof StakeholderSchema>;
export type BusinessRule = z.infer<typeof BusinessRuleSchema>;
export type ActivityEvent = z.infer<typeof ActivityEventSchema>;
export type ProjectMeta = z.infer<typeof ProjectMetaSchema>;
export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;
export type RuleConfig = z.infer<typeof RuleConfigSchema>;

export interface ProjectSnapshot {
  readonly meta: ProjectMeta;
  readonly requirements: readonly Requirement[];
  readonly stakeholders: readonly Stakeholder[];
  readonly businessRules: readonly BusinessRule[];
  readonly activities: readonly ActivityEvent[];
}
