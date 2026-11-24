import type { McpServer } from '@modelcontextprotocol/server';
import type { SrsService } from '../../services/srs-service.js';

export function registerSrsResource(server: McpServer, srs: SrsService): void {
  server.registerResource(
    'srs-document',
    'reqexpert://artifacts/srs',
    {
      title: 'Спецификация SRS (Markdown)',
      description: 'Сгенерированный документ SRS',
      mimeType: 'text/markdown',
    },
    async (uri) => ({
      contents: [{ uri: uri.href, text: await srs.generateMarkdown() }],
    }),
  );
}