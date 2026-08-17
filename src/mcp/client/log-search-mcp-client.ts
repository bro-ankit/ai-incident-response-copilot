import { Injectable } from '@nestjs/common';

import { McpClient, type McpClientSpawnConfig } from './mcp-client';

@Injectable()
export class LogSearchMcpClient extends McpClient {
  protected readonly spawnConfig: McpClientSpawnConfig = this.buildSpawnConfig(
    'orchestrator-log-search-client',
    'src/mcp/log-search/log-search.server.ts',
  );
}
