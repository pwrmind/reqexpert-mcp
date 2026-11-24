import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import {
  PriorityMoSCoWSchema,
  RequirementStatusSchema,
  RequirementTypeSchema,
  LevelSchema,
} from '../../core/schema.js';
import type { RequirementService } from '../../services/requirement-service.js';
import { runTool } from '../helpers.js';

export function registerRequirementTools(server: McpServer, svc: RequirementService): void {
  server.registerTool(
    'add_requirement',
    {
      title: 'Добавить требование',
      description: 'Создаёт требование, присваивает ID и прогоняет через все правила качества.',
      inputSchema: z.object({
        title: z.string(),
        type: RequirementTypeSchema.optional(),
        priority: PriorityMoSCoWSchema.optional(),
        description: z.string().optional(),
        acceptanceCriteria: z.string().optional(),
        source: z.string().optional(),
        dependencies: z.array(z.string()).optional(),
        codeRefs: z.array(z.string()).optional(),
        verifiedBy: z.array(z.string()).optional(),
      }),
    },
    async (input) => runTool(() => svc.create(input)),
  );

  server.registerTool(
    'get_requirement',
    {
      title: 'Получить требование по ID',
      description: 'Возвращает требование с оценкой качества и результатами всех правил.',
      inputSchema: z.object({ id: z.string() }),
    },
    async ({ id }) => runTool(() => svc.get(id)),
  );

  server.registerTool(
    'update_requirement',
    {
      title: 'Обновить требование',
      description: 'Обновляет поля и повторно запускает правила.',
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
        codeRefs: z.array(z.string()).optional(),
        verifiedBy: z.array(z.string()).optional(),
      }),
    },
    async ({ id, ...patch }) => runTool(() => svc.update(id, patch)),
  );

  server.registerTool(
    'delete_requirement',
    {
      title: 'Удалить требование',
      description:
        'Удаляет требование. Если есть зависимые — вернёт ошибку, если не передан force=true.',
      inputSchema: z.object({
        id: z.string(),
        force: z.boolean().optional(),
      }),
    },
    async ({ id, force }) => runTool(() => svc.remove(id, force)),
  );

  server.registerTool(
    'search_requirements',
    {
      title: 'Поиск требований',
      description:
        'Фильтрация по ключевому слову, типу, приоритету, статусу, source, тестируемости, стабильности, наличию трассировки. Возвращает краткие карточки.',
      inputSchema: z.object({
        keyword: z.string().optional(),
        type: RequirementTypeSchema.optional(),
        priority: PriorityMoSCoWSchema.optional(),
        status: RequirementStatusSchema.optional(),
        source: z.string().optional(),
        testability: LevelSchema.optional(),
        stability: LevelSchema.optional(),
        hasCodeRefs: z.boolean().optional(),
        hasTests: z.boolean().optional(),
        limit: z.number().int().positive().optional(),
      }),
    },
    async (filter) => runTool(() => svc.search(filter)),
  );
}
