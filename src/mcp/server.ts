import { McpServer } from '@modelcontextprotocol/server';
import type { RequirementService } from '../services/requirement-service.js';
import type { StakeholderService } from '../services/stakeholder-service.js';
import type { BusinessRuleService } from '../services/business-rule-service.js';
import type { TraceabilityService } from '../services/traceability-service.js';
import type { CoverageService } from '../services/coverage-service.js';
import type { ImpactService } from '../services/impact-service.js';
import type { SrsService } from '../services/srs-service.js';
import type { RuleEngine } from '../rules/engine.js';
import type { Store } from '../persistence/store.js';
import { registerRequirementTools } from './tools/requirement-tools.js';
import { registerStakeholderTools } from './tools/stakeholder-tools.js';
import { registerBusinessRuleTools } from './tools/business-rule-tools.js';
import { registerTraceabilityTools } from './tools/traceability-tools.js';
import { registerMetaTools } from './tools/meta-tools.js';
import { registerProjectResource } from './resources/project-resource.js';
import { registerSrsResource } from './resources/srs-resource.js';

export interface McpServices {
  requirements: RequirementService;
  stakeholders: StakeholderService;
  businessRules: BusinessRuleService;
  traceability: TraceabilityService;
  coverage: CoverageService;
  impact: ImpactService;
  srs: SrsService;
}

export interface McpDeps {
  services: McpServices;
  rules: RuleEngine;
  store: Store;
}

export function buildMcpServer(deps: McpDeps): McpServer {
  const server = new McpServer({ name: 'reqexpert-mcp', version: '2.0.0' });

  registerRequirementTools(server, deps.services.requirements);
  registerStakeholderTools(server, deps.services.stakeholders);
  registerBusinessRuleTools(server, deps.services.businessRules);
  registerTraceabilityTools(server, {
    traceability: deps.services.traceability,
    coverage: deps.services.coverage,
    impact: deps.services.impact,
  });
  registerMetaTools(server, { rules: deps.rules, store: deps.store });

  registerProjectResource(server, deps.store);
  registerSrsResource(server, deps.services.srs);

  return server;
}
