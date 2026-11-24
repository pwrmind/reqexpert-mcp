import type { Requirement } from './schema.js';

export function nextRequirementId(
  requirements: readonly Requirement[],
  type: Requirement['type'],
): string {
  const prefix =
    type === 'Функциональное' ? 'FR' :
    type === 'Нефункциональное' ? 'NFR' :
    'REQ';

  const max = requirements
    .filter((r) => r.id.startsWith(`${prefix}-`))
    .map((r) => parseInt(r.id.slice(prefix.length + 1), 10))
    .filter((n) => Number.isFinite(n))
    .reduce((m, n) => Math.max(m, n), 0);

  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

export function nextBusinessRuleId(rules: readonly { id: string }[]): string {
  const max = rules
    .map((r) => /^BR-(\d+)$/.exec(r.id))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => parseInt(m[1] ?? '0', 10))
    .reduce((m, n) => Math.max(m, n), 0);

  return `BR-${String(max + 1).padStart(3, '0')}`;
}

export function nextStakeholderId(stakeholders: readonly { id: number }[]): number {
  return stakeholders.reduce((m, s) => Math.max(m, s.id), 0) + 1;
}
