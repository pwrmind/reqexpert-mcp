import type { z } from 'zod/v4';
import type { Requirement, ProjectSnapshot } from '../core/schema.js';

export type RuleCategory =
  | 'structure'
  | 'ambiguity'
  | 'completeness'
  | 'traceability'
  | 'duplication'
  | 'consistency';

export type Severity = 'info' | 'warning' | 'error' | 'critical';

export interface RuleContext {
  readonly requirement: Readonly<Requirement>;
  readonly allRequirements: readonly Readonly<Requirement>[];
  readonly project: Readonly<ProjectSnapshot>;
}

export interface RuleViolation {
  message: string;
  field?: keyof Requirement;
  relatedRequirementIds?: string[];
}

export interface RuleResult {
  pass: boolean;
  message: string;
  violations: RuleViolation[];
}

export interface Rule<O = Record<string, never>> {
  readonly id: string;
  readonly name: string;
  readonly category: RuleCategory;
  readonly severity: Severity;
  readonly description: string;
  readonly optionsSchema: z.ZodType<O>;
  readonly appliesTo?: (req: Readonly<Requirement>) => boolean;
  evaluate(ctx: RuleContext, options: O): RuleResult | Promise<RuleResult>;
}
