import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { loadConfig } from './config.js';
import { FileStore } from './persistence/file-store.js';
import { RuleEngine } from './rules/engine.js';
import { QualityScorer } from './rules/scoring.js';
import { BUILTIN_RULES } from './rules/builtin/index.js';
import { RequirementService } from './services/requirement-service.js';
import { StakeholderService } from './services/stakeholder-service.js';
import { BusinessRuleService } from './services/business-rule-service.js';
import { TraceabilityService } from './services/traceability-service.js';
import { CoverageService } from './services/coverage-service.js';
import { ImpactService } from './services/impact-service.js';
import { SrsService } from './services/srs-service.js';
import { buildMcpServer } from './mcp/server.js';
import type { Rule } from './rules/types.js';

async function loadCustomRules(path?: string): Promise<Rule<any>[]> {
  if (!path) return [];
  try {
    const mod = await import(new URL(path, `file://${process.cwd()}/`).href);
    const rules = mod.default ?? mod.customRules ?? [];
    if (!Array.isArray(rules)) {
      console.warn('[reqexpert] customRules: ожидается default-экспорт массива Rule[]');
      return [];
    }
    return rules as Rule<any>[];
  } catch (err) {
    console.warn(
      '[reqexpert] не удалось загрузить custom rules:',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

async function main() {
  const config = loadConfig();
  const store = new FileStore(config.workspace, config.activityLimit);
  const customRules = await loadCustomRules(config.customRulesPath);
  const rules = new RuleEngine([...BUILTIN_RULES, ...customRules]);
  const scorer = new QualityScorer();

  const services = {
    requirements: new RequirementService(store, rules, scorer),
    stakeholders: new StakeholderService(store),
    businessRules: new BusinessRuleService(store),
    traceability: new TraceabilityService(store),
    coverage: new CoverageService(store),
    impact: new ImpactService(store),
    srs: new SrsService(store, scorer),
  };

  const server = buildMcpServer({ services, rules, store });
  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  console.error('[reqexpert] fatal:', err);
  process.exit(1);
});
