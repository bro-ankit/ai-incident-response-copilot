import type { UUID } from 'node:crypto';

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { IncidentLogsRepository } from '../../incidents/incident-logs.repository';
import { LOG_LEVELS } from '../../schema/incident-logs.schema';
import { McpTool } from '../mcp-tool.decorator';
import type { IMcpToolHandler } from '../mcp-tool.interface';

const inputSchema = {
  incidentId: z.uuid().describe('The incident to search logs for'),
  query: z.string().optional().describe('Optional keyword to filter log messages by (case-insensitive)'),
  level: z.enum(LOG_LEVELS).optional().describe('Optional log level to filter by'),
  limit: z.number().int().positive().max(200).optional().describe('Max log lines to return (default 50)'),
};

type SearchIncidentLogsArgs = {
  incidentId: UUID;
  query?: string;
  level?: (typeof LOG_LEVELS)[number];
  limit?: number;
};

@Injectable()
@McpTool({
  name: 'search_incident_logs',
  title: 'Search incident logs',
  description:
    'Search the log lines captured for a specific incident. Supports filtering by keyword and log level, ' +
    'and returns results ordered oldest-first so timing/sequence around the incident window is preserved.',
  inputSchema,
})
export class SearchIncidentLogsTool implements IMcpToolHandler {
  constructor(private readonly incidentLogsRepository: IncidentLogsRepository) {}

  async execute(args: Record<string, unknown>): Promise<CallToolResult> {
    const { incidentId, query, level, limit } = args as SearchIncidentLogsArgs;

    const logs = await this.incidentLogsRepository.search({
      incidentId,
      query,
      level,
      limit,
    });

    return { content: [{ type: 'text', text: JSON.stringify(logs, null, 2) }] };
  }
}
