import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { SearchService } from '../../runbooks/search/search.service';
import { McpTool } from '../mcp-tool.decorator';
import type { IMcpToolHandler } from '../mcp-tool.interface';

const inputSchema = {
  query: z.string().min(1).describe('Natural language description of the symptoms or incident'),
};

type SearchRunbooksArgs = {
  query: string;
};

@Injectable()
@McpTool({
  name: 'search_runbooks',
  title: 'Search runbooks and postmortems',
  description:
    'Hybrid (semantic + keyword) search over the runbook/postmortem knowledge base. Returns the top matching ' +
    'runbooks for a natural-language description of symptoms or a suspected root cause.',
  inputSchema,
})
export class SearchRunbooksTool implements IMcpToolHandler {
  constructor(private readonly searchService: SearchService) {}

  async execute(args: Record<string, unknown>): Promise<CallToolResult> {
    const { query } = args as SearchRunbooksArgs;

    const runbooks = await this.searchService.search(query);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            runbooks.map((r) => ({ id: r.id, title: r.title, content: r.content, services: r.services })),
            null,
            2,
          ),
        },
      ],
    };
  }
}
