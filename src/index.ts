import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { ProjectStore } from './core/store.js';
import { ReqExpertEngine } from './domain/engine.js';
import {
  ExpertRuleSchema,
  LevelSchema,
  PriorityMoSCoWSchema,
  RequirementStatusSchema,
  RequirementTypeSchema,
} from './core/schema.js';

const store = new ProjectStore(process.env.REQEXPERT_WORKSPACE || process.cwd());
const engine = new ReqExpertEngine(store);

const server = new McpServer({
  name: 'reqexpert-mcp',
  version: '1.0.0',
});

// 1. РЕСУРСЫ
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
    return {
      contents: [{ uri: uri.href, text: JSON.stringify(state, null, 2) }],
    };
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

// 2. ИНСТРУМЕНТЫ
const addRequirementInput = z.object({
  title: z.string().describe('Краткая формулировка требования'),
  type: RequirementTypeSchema.optional(),
  priority: PriorityMoSCoWSchema.optional(),
  description: z.string().optional(),
  acceptanceCriteria: z.string().optional().describe('Измеримые критерии приемки'),
  source: z.string().optional(),
  dependencies: z.array(z.string()).optional().describe('ID связанных требований'),
});

server.registerTool(
  'add_requirement',
  {
    title: 'Добавить требование',
    description:
      'Создает новое требование, автоматически присваивает ID (FR-XXX/NFR-XXX) и сразу проверяет его по активным правилам экспертной системы (D25, D26, H78).',
    inputSchema: addRequirementInput,
  },
  async (args) => {
    const result = await engine.addRequirement(args);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

const updateRequirementInput = z.object({
  id: z.string().describe('ID требования, например FR-001'),
  title: z.string().optional(),
  priority: PriorityMoSCoWSchema.optional(),
  status: RequirementStatusSchema.optional(),
  description: z.string().optional(),
  acceptanceCriteria: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
});

server.registerTool(
  'update_requirement',
  {
    title: 'Обновить требование',
    description: 'Обновляет поля существующего требования и повторно запускает экспертную проверку.',
    inputSchema: updateRequirementInput,
  },
  async ({ id, ...patch }) => {
    const result = await engine.updateRequirement(id, patch);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.registerTool(
  'check_ambiguity',
  {
    title: 'Проверить текст на неоднозначность (Правило D26)',
    description: 'Анализирует произвольный текст требования на наличие субъективных слов («быстро», «удобно» и т.д.).',
    inputSchema: z.object({
      text: z.string().describe('Текст требования для проверки'),
    }),
  },
  async ({ text }) => {
    const res = await engine.checkTextAmbiguity(text);
    return {
      content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
    };
  }
);

server.registerTool(
  'analyze_impact',
  {
    title: 'Анализ влияния изменений',
    description: 'Определяет зависимые требования и оценивает риск при изменении указанного требования.',
    inputSchema: z.object({
      id: z.string().describe('ID требования'),
    }),
  },
  async ({ id }) => {
    const report = await engine.analyzeImpact(id);
    return {
      content: [{ type: 'text', text: JSON.stringify(report, null, 2) }],
    };
  }
);

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
  async ({ name, role, involvement }) => {
    const s = await engine.addStakeholder(name, role, involvement);
    return {
      content: [{ type: 'text', text: JSON.stringify(s, null, 2) }],
    };
  }
);

server.registerTool(
  'add_expert_rule',
  {
    title: 'Добавить правило экспертной системы',
    description: 'Добавляет новое JS-правило проверки качества требований в базу знаний проекта.',
    inputSchema: ExpertRuleSchema,
  },
  async (rule) => {
    const created = await engine.addExpertRule(rule);
    return {
      content: [{ type: 'text', text: JSON.stringify(created, null, 2) }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);