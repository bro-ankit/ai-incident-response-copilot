import { Module } from '@nestjs/common';

import { IncidentsModule } from '../../incidents/incidents.module';
import { McpInfraModule } from '../mcp-infra.module';
import { McpToolDiscoveryModule } from '../mcp-tool-discovery.module';
import { SearchIncidentLogsTool } from './search-incident-logs.tool';

@Module({
  imports: [McpInfraModule, McpToolDiscoveryModule, IncidentsModule],
  providers: [SearchIncidentLogsTool],
})
export class LogSearchMcpModule {}
