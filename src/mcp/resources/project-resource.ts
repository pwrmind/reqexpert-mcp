import type { McpServer } from '@modelcontextprotocol/server';
import type { Store } from '../../persistence/store.js';

export function registerProjectResource(server: McpServer, store: Store): void {
  server.registerResource(
    'project-state',
    'reqexpert://project/state',
    {
      title: 'Состояние проекта ReqExpert',
      description:
        'Полный снимок проекта: требования, стейкхолдеры, бизнес-правила, настройки и последние события.',
      mimeType: 'application/json',
    },
    async (uri) => {
      const snap = await store.load();
      return { contents: [{ uri: uri.href, text: JSON.stringify(snap, null, 2) }] };
    },
  );
}