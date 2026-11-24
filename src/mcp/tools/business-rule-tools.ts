import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { BusinessRuleService } from '../../services/business-rule-service.js';
import { runTool } from '../helpers.js';

export function registerBusinessRuleTools(server: McpServer, svc: BusinessRuleService): void {
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
    async (input) => runTool(() => svc.create(input)),
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
    async ({ id, ...patch }) => runTool(() => svc.update(id, patch)),
  );

  server.registerTool(
    'delete_business_rule',
    {
      title: 'Удалить бизнес-правило',
      inputSchema: z.object({ id: z.string() }),
    },
    async ({ id }) => runTool(() => svc.remove(id)),
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
    async (filter) => runTool(() => svc.search(filter)),
  );
}
