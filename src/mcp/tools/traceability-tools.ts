import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { PriorityMoSCoWSchema } from '../../core/schema.js';
import type { TraceabilityService } from '../../services/traceability-service.js';
import type { CoverageService } from '../../services/coverage-service.js';
import type { ImpactService } from '../../services/impact-service.js';
import { runTool } from '../helpers.js';

export interface TraceabilityToolDeps {
  traceability: TraceabilityService;
  coverage: CoverageService;
  impact: ImpactService;
}

export function registerTraceabilityTools(server: McpServer, deps: TraceabilityToolDeps): void {
  server.registerTool(
    'link_code_ref',
    {
      title: 'Привязать файл кода к требованию',
      description:
        'Добавляет путь к файлу реализации в codeRefs. По умолчанию проверяет существование файла в workspace.',
      inputSchema: z.object({
        requirementId: z.string(),
        path: z.string(),
        validate: z.boolean().optional(),
      }),
    },
    async ({ requirementId, path, validate }) =>
      runTool(() => deps.traceability.linkCodeRef(requirementId, path, { validate })),
  );

  server.registerTool(
    'unlink_code_ref',
    {
      title: 'Отвязать файл кода от требования',
      inputSchema: z.object({ requirementId: z.string(), path: z.string() }),
    },
    async ({ requirementId, path }) =>
      runTool(() => deps.traceability.unlinkCodeRef(requirementId, path)),
  );

  server.registerTool(
    'link_test_ref',
    {
      title: 'Привязать тест к требованию',
      inputSchema: z.object({
        requirementId: z.string(),
        testId: z.string(),
      }),
    },
    async ({ requirementId, testId }) =>
      runTool(() => deps.traceability.linkTestRef(requirementId, testId)),
  );

  server.registerTool(
    'unlink_test_ref',
    {
      title: 'Отвязать тест от требования',
      inputSchema: z.object({ requirementId: z.string(), testId: z.string() }),
    },
    async ({ requirementId, testId }) =>
      runTool(() => deps.traceability.unlinkTestRef(requirementId, testId)),
  );

  server.registerTool(
    'coverage_report',
    {
      title: 'Отчёт о покрытии требований',
      description: 'По умолчанию считает Must-требования.',
      inputSchema: z.object({
        priority: z.union([PriorityMoSCoWSchema, z.literal('all')]).optional(),
      }),
    },
    async ({ priority }) => runTool(() => deps.coverage.coverageReport({ priority })),
  );

  server.registerTool(
    'find_orphan_code',
    {
      title: 'Найти файлы кода без привязки к требованиям',
      inputSchema: z.object({
        dir: z.string().optional(),
        extensions: z.array(z.string()).optional(),
        limit: z.number().int().positive().optional(),
      }),
    },
    async (options) => runTool(() => deps.coverage.findOrphanCode(options)),
  );

  server.registerTool(
    'analyze_impact',
    {
      title: 'Анализ влияния изменений',
      inputSchema: z.object({ id: z.string() }),
    },
    async ({ id }) => runTool(() => deps.impact.analyzeImpact(id)),
  );
}
