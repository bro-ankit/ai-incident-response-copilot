import { Module } from '@nestjs/common';

import { RunbooksModule } from '../../runbooks/runbooks.module';
import { McpInfraModule } from '../mcp-infra.module';
import { McpToolDiscoveryModule } from '../mcp-tool-discovery.module';
import { SearchRunbooksTool } from './search-runbooks.tool';

@Module({
  imports: [McpInfraModule, McpToolDiscoveryModule, RunbooksModule],
  providers: [SearchRunbooksTool],
})
export class RunbookSearchMcpModule {}
