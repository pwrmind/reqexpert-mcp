import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { RequirementSchema, PriorityMoSCoWSchema } from '../../core/schema.js';
import type { RuleEngine } from '../../rules/engine.js';
import type { Store } from '../../persistence/store.js';
import { runTool } from '../helpers.js';

export interface MetaToolDeps {
  rules: RuleEngine;
  store: Store;
}

export function registerMetaTools(server: McpServer, deps: MetaToolDeps): void {
  server.registerTool(
    'preview_validation',
    {
      title: 'Проверить текст как требование без сохранения',
      description: 'Прогоняет все активные правила на виртуальном требовании.',
      inputSchema: z.object({
        title: z.string(),
        description: z.string().optional(),
        acceptanceCriteria: z.string().optional(),
        priority: PriorityMoSCoWSchema.optional(),
      }),
    },
    async (input) =>
      runTool(async () => {
        const snap = await deps.store.load();
        const virtual = RequirementSchema.parse({
          id: 'VIRTUAL',
          title: input.title,
          description: input.description ?? '',
          acceptanceCriteria: input.acceptanceCriteria ?? '',
          priority: input.priority ?? 'Must',
        });
        const evaluation = await deps.rules.evaluate(virtual, snap);
        return { requirement: virtual, evaluation };
      }),
  );

  server.registerTool(
    'list_rules',
    {
      title: 'Список правил проверки',
      description: 'Возвращает все зарегистрированные правила с их категориями и настройками.',
      inputSchema: z.object({}),
    },
    async () =>
      runTool(async () => {
        const snap = await deps.store.load();
        return deps.rules.list().map((r) => ({
          id: r.id,
          name: r.name,
          category: r.category,
          severity: r.severity,
          description: r.description,
          settings: snap.meta.settings.rules[r.id] ?? { enabled: true },
        }));
      }),
  );
}
