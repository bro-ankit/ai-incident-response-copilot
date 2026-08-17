import { Injectable } from '@nestjs/common';

import { McpClient, type McpClientSpawnConfig } from './mcp-client';

@Injectable()
export class RunbookSearchMcpClient extends McpClient {
  protected readonly spawnConfig: McpClientSpawnConfig = this.buildSpawnConfig(
    'orchestrator-runbook-search-client',
    'src/mcp/runbook-search/runbook-search.server.ts',
  );
}
