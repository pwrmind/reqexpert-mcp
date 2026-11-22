import vm from 'node:vm';
import { ExpertRule, Requirement, RuleCheckResult } from './schema.js';

export function executeRuleInSandbox(
  rule: ExpertRule,
  requirement: Requirement
): RuleCheckResult {
  try {
    const sandbox = {
      requirement: structuredClone(requirement),
      result: null as unknown,
    };

    const context = vm.createContext(sandbox);
    const wrappedScript = `
      const fn = (${rule.checkLogic});
      result = fn(requirement);
    `;

    vm.runInContext(wrappedScript, context, { timeout: 100 });

    const raw = sandbox.result as {
      pass?: boolean;
      message?: string;
      issues?: string[];
    };

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      pass: Boolean(raw?.pass),
      message: raw?.message ?? '',
      issues: Array.isArray(raw?.issues) ? raw.issues : [],
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      pass: false,
      message: `Ошибка выполнения правила ${rule.id}`,
      issues: [msg],
    };
  }
}