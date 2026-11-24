import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { LevelSchema } from '../../core/schema.js';
import type { StakeholderService } from '../../services/stakeholder-service.js';
import { runTool } from '../helpers.js';

export function registerStakeholderTools(server: McpServer, svc: StakeholderService): void {
  server.registerTool(
    'add_stakeholder',
    {
      title: 'Добавить стейкхолдера',
      description: 'Регистрирует участника проекта.',
      inputSchema: z.object({
        name: z.string(),
        role: z.string(),
        involvement: LevelSchema.optional(),
      }),
    },
    async (input) => runTool(() => svc.create(input)),
  );

  server.registerTool(
    'update_stakeholder',
    {
      title: 'Обновить стейкхолдера',
      inputSchema: z.object({
        id: z.number().int().positive(),
        name: z.string().optional(),
        role: z.string().optional(),
        involvement: LevelSchema.optional(),
      }),
    },
    async ({ id, ...patch }) => runTool(() => svc.update(id, patch)),
  );

  server.registerTool(
    'delete_stakeholder',
    {
      title: 'Удалить стейкхолдера',
      inputSchema: z.object({ id: z.number().int().positive() }),
    },
    async ({ id }) => runTool(() => svc.remove(id)),
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
    async (filter) => runTool(() => svc.search(filter)),
  );
}
