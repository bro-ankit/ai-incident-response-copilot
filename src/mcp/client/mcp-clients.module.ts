import { Global, Module } from '@nestjs/common';

import { LogSearchMcpClient } from './log-search-mcp-client';
import { RunbookSearchMcpClient } from './runbook-search-mcp-client';

@Global()
@Module({
  providers: [LogSearchMcpClient, RunbookSearchMcpClient],
  exports: [LogSearchMcpClient, RunbookSearchMcpClient],
})
export class McpClientsModule {}
