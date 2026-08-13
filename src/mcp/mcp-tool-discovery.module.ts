import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { McpToolDiscoveryService } from './mcp-tool-discovery.service';

@Module({
  imports: [DiscoveryModule],
  providers: [McpToolDiscoveryService],
  exports: [McpToolDiscoveryService],
})
export class McpToolDiscoveryModule {}
