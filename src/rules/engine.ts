import type { ProjectSnapshot, Requirement } from '../core/schema.js';
import type { Rule, RuleContext, RuleResult, RuleCategory, Severity } from './types.js';

export interface RuleEvaluation {
  ruleId: string;
  ruleName: string;
  category: RuleCategory;
  severity: Severity;
  result: RuleResult;
}

export interface RequirementEvaluation {
  passed: boolean;
  evaluations: RuleEvaluation[];
  failedRules: RuleEvaluation[];
}

export class RuleEngine {
  private readonly rules: readonly Rule<any>[];
  private readonly byId: Map<string, Rule<any>>;

  constructor(rules: readonly Rule<any>[]) {
    this.rules = rules;
    this.byId = new Map(rules.map((r) => [r.id, r]));
  }

  list(): readonly Rule<any>[] {
    return this.rules;
  }

  find(id: string): Rule<any> | undefined {
    return this.byId.get(id);
  }

  async evaluate(
    requirement: Requirement,
    snapshot: ProjectSnapshot,
  ): Promise<RequirementEvaluation> {
    const ruleSettings = snapshot.meta.settings.rules ?? {};
    const ctx: RuleContext = {
      requirement,
      allRequirements: snapshot.requirements,
      project: snapshot,
    };

    const evaluations: RuleEvaluation[] = [];

    for (const rule of this.rules) {
      const cfg = ruleSettings[rule.id];
      if (cfg?.enabled === false) continue;
      if (rule.appliesTo && !rule.appliesTo(requirement)) continue;

      let options: unknown;
      try {
        options = rule.optionsSchema.parse(cfg?.options ?? {});
      } catch (err) {
        evaluations.push({
          ruleId: rule.id,
          ruleName: rule.name,
          category: rule.category,
          severity: rule.severity,
          result: {
            pass: false,
            message: `Некорректные опции правила ${rule.id}`,
            violations: [{ message: err instanceof Error ? err.message : String(err) }],
          },
        });
        continue;
      }

      try {
        const result = await rule.evaluate(ctx, options as any);
        evaluations.push({
          ruleId: rule.id,
          ruleName: rule.name,
          category: rule.category,
          severity: rule.severity,
          result,
        });
      } catch (err) {
        evaluations.push({
          ruleId: rule.id,
          ruleName: rule.name,
          category: rule.category,
          severity: rule.severity,
          result: {
            pass: false,
            message: `Ошибка выполнения правила ${rule.id}`,
            violations: [{ message: err instanceof Error ? err.message : String(err) }],
          },
        });
      }
    }

    const failedRules = evaluations.filter((e) => !e.result.pass);
    return { passed: failedRules.length === 0, evaluations, failedRules };
  }
}
