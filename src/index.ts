import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { ProjectStore } from './core/store.js';
import { ReqExpertEngine } from './domain/engine.js';
import {
  BusinessRuleSchema,
  ExpertRuleSchema,
  LevelSchema,
  PriorityMoSCoWSchema,
  RequirementStatusSchema,
  RequirementTypeSchema,
} from './core/schema.js';

const store = new ProjectStore(process.env.REQEXPERT_WORKSPACE || process.cwd());
const engine = new ReqExpertEngine(store);

const server = new McpServer({ name: 'reqexpert-mcp', version: '1.1.0' });

// ---------- RESOURCES ----------
server.registerResource(
  'project-state',
  'reqexpert://project/state',
  {
    title: 'Состояние проекта ReqExpert',
    description: 'Полный JSON со всеми требованиями, стейкхолдерами и правилами ЭС',
    mimeType: 'application/json',
  },
  async (uri) => {
    const state = await engine.getFullState();
    return { contents: [{ uri: uri.href, text: JSON.stringify(state, null, 2) }] };
  }
);

server.registerResource(
  'srs-document',
  'reqexpert://artifacts/srs',
  {
    title: 'Спецификация SRS (Markdown)',
    description: 'Сгенерированный документ спецификации требований к ПО',
    mimeType: 'text/markdown',
  },
  async (uri) => ({
    contents: [{ uri: uri.href, text: await engine.generateMarkdownSRS() }],
  })
);

const json = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
});

// ==================== REQUIREMENTS ====================
server.registerTool(
  'add_requirement',
  {
    title: 'Добавить требование',
    description:
      'Создает новое требование, автоматически присваивает ID (FR-XXX/NFR-XXX) и сразу проверяет его по активным правилам ЭС (D25, D26, H78).',
    inputSchema: z.object({
      title: z.string(),
      type: RequirementTypeSchema.optional(),
      priority: PriorityMoSCoWSchema.optional(),
      description: z.string().optional(),
      acceptanceCriteria: z.string().optional(),
      source: z.string().optional(),
      dependencies: z.array(z.string()).optional(),
    }),
  },
  async (args) => json(await engine.addRequirement(args))
);

server.registerTool(
  'get_requirement',
  {
    title: 'Получить требование по ID',
    description: 'Возвращает полное требование с оценкой качества и результатами ЭС-проверок.',
    inputSchema: z.object({ id: z.string() }),
  },
  async ({ id }) => json(await engine.getRequirement(id))
);

server.registerTool(
  'update_requirement',
  {
    title: 'Обновить требование',
    description: 'Обновляет поля существующего требования и повторно запускает экспертную проверку.',
    inputSchema: z.object({
      id: z.string(),
      title: z.string().optional(),
      type: RequirementTypeSchema.optional(),
      priority: PriorityMoSCoWSchema.optional(),
      status: RequirementStatusSchema.optional(),
      description: z.string().optional(),
      acceptanceCriteria: z.string().optional(),
      source: z.string().optional(),
      testability: LevelSchema.optional(),
      stability: LevelSchema.optional(),
      complexity: LevelSchema.optional(),
      dependencies: z.array(z.string()).optional(),
    }),
  },
  async ({ id, ...patch }) => json(await engine.updateRequirement(id, patch))
);

server.registerTool(
  'delete_requirement',
  {
    title: 'Удалить требование',
    description:
      'Удаляет требование по ID. Если на него ссылаются другие требования — вернет ошибку, если не передан force=true.',
    inputSchema: z.object({
      id: z.string(),
      force: z.boolean().optional().describe('Принудительно удалить и очистить ссылки в зависимостях'),
    }),
  },
  async ({ id, force }) => json(await engine.deleteRequirement(id, force))
);

server.registerTool(
  'search_requirements',
  {
    title: 'Поиск требований',
    description:
      'Фильтрация требований по ключевому слову (id/title/description/criteria/source), типу, приоритету MoSCoW, статусу, source, тестируемости, стабильности. Возвращает краткие карточки.',
    inputSchema: z.object({
      keyword: z.string().optional(),
      type: RequirementTypeSchema.optional(),
      priority: PriorityMoSCoWSchema.optional(),
      status: RequirementStatusSchema.optional(),
      source: z.string().optional(),
      testability: LevelSchema.optional(),
      stability: LevelSchema.optional(),
      limit: z.number().int().positive().optional(),
    }),
  },
  async (filter) => json(await engine.searchRequirements(filter))
);

// ==================== STAKEHOLDERS ====================
server.registerTool(
  'add_stakeholder',
  {
    title: 'Добавить заинтересованное лицо',
    description: 'Регистрирует участника проекта в онтологии.',
    inputSchema: z.object({
      name: z.string(),
      role: z.string(),
      involvement: LevelSchema.optional(),
    }),
  },
  async ({ name, role, involvement }) => json(await engine.addStakeholder(name, role, involvement))
);

server.registerTool(
  'update_stakeholder',
  {
    title: 'Обновить стейкхолдера',
    inputSchema: z.object({
      id: z.number().int(),
      name: z.string().optional(),
      role: z.string().optional(),
      involvement: LevelSchema.optional(),
    }),
  },
  async ({ id, ...patch }) => json(await engine.updateStakeholder(id, patch))
);

server.registerTool(
  'delete_stakeholder',
  {
    title: 'Удалить стейкхолдера',
    inputSchema: z.object({ id: z.number().int() }),
  },
  async ({ id }) => json(await engine.deleteStakeholder(id))
);

server.registerTool(
  'search_stakeholders',
  {
    title: 'Поиск стейкхолдеров',
    inputSchema: z.object({
      keyword: z.string().optional(),
      role: z.string().optional(),
      involvement: LevelSchema.optional(),
    }),
  },
  async (filter) => json(await engine.searchStakeholders(filter))
);

// ==================== BUSINESS RULES ====================
server.registerTool(
  'add_business_rule',
  {
    title: 'Добавить бизнес-правило',
    description: 'Регистрирует бизнес-правило (BR-XXX).',
    inputSchema: z.object({
      description: z.string(),
      name: z.string().optional(),
      type: z.string().optional(),
      source: z.string().optional(),
      relatedRequirements: z.array(z.string()).optional(),
      active: z.boolean().optional(),
    }),
  },
  async (args) => json(await engine.addBusinessRule(args))
);

server.registerTool(
  'update_business_rule',
  {
    title: 'Обновить бизнес-правило',
    inputSchema: z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.string().optional(),
      description: z.string().optional(),
      source: z.string().optional(),
      active: z.boolean().optional(),
      relatedRequirements: z.array(z.string()).optional(),
    }),
  },
  async ({ id, ...patch }) => json(await engine.updateBusinessRule(id, patch))
);

server.registerTool(
  'delete_business_rule',
  { title: 'Удалить бизнес-правило', inputSchema: z.object({ id: z.string() }) },
  async ({ id }) => json(await engine.deleteBusinessRule(id))
);

server.registerTool(
  'search_business_rules',
  {
    title: 'Поиск бизнес-правил',
    inputSchema: z.object({
      keyword: z.string().optional(),
      type: z.string().optional(),
      active: z.boolean().optional(),
    }),
  },
  async (filter) => json(await engine.searchBusinessRules(filter))
);

// ==================== EXPERT RULES ====================
server.registerTool(
  'add_expert_rule',
  {
    title: 'Добавить правило экспертной системы',
    inputSchema: ExpertRuleSchema,
  },
  async (rule) => json(await engine.addExpertRule(rule))
);

server.registerTool(
  'update_expert_rule',
  {
    title: 'Обновить правило ЭС',
    inputSchema: z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.string().optional(),
      description: z.string().optional(),
      checkLogic: z.string().optional(),
      example: z.string().optional(),
      strictness: z.enum(['low', 'medium', 'high']).optional(),
      category: z.string().optional(),
      active: z.boolean().optional(),
    }),
  },
  async ({ id, ...patch }) => json(await engine.updateExpertRule(id, patch))
);

server.registerTool(
  'delete_expert_rule',
  { title: 'Удалить правило ЭС', inputSchema: z.object({ id: z.string() }) },
  async ({ id }) => json(await engine.deleteExpertRule(id))
);

server.registerTool(
  'toggle_expert_rule',
  {
    title: 'Включить/выключить правило ЭС',
    description: 'Если active не передан — инвертирует текущее состояние.',
    inputSchema: z.object({ id: z.string(), active: z.boolean().optional() }),
  },
  async ({ id, active }) => json(await engine.toggleExpertRule(id, active))
);

server.registerTool(
  'search_expert_rules',
  {
    title: 'Поиск правил ЭС',
    inputSchema: z.object({
      keyword: z.string().optional(),
      type: z.string().optional(),
      category: z.string().optional(),
      active: z.boolean().optional(),
    }),
  },
  async (filter) => json(await engine.searchExpertRules(filter))
);

// ==================== MISC ====================
server.registerTool(
  'check_ambiguity',
  {
    title: 'Проверить текст на неоднозначность (Правило D26)',
    inputSchema: z.object({ text: z.string() }),
  },
  async ({ text }) => json(await engine.checkTextAmbiguity(text))
);

server.registerTool(
  'analyze_impact',
  {
    title: 'Анализ влияния изменений',
    inputSchema: z.object({ id: z.string() }),
  },
  async ({ id }) => json(await engine.analyzeImpact(id))
);

// ---------- START ----------
const transport = new StdioServerTransport();
await server.connect(transport);