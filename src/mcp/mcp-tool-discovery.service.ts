import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';

import { MCP_TOOL_KEY, type McpToolMetadata } from './mcp-tool.decorator';
import type { IMcpToolHandler } from './mcp-tool.interface';

type DiscoveredMcpTool = {
  metadata: McpToolMetadata;
  handler: IMcpToolHandler;
};

@Injectable()
export class McpToolDiscoveryService implements OnModuleInit {
  private readonly tools: DiscoveredMcpTool[] = [];

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit(): void {
    for (const wrapper of this.discovery.getProviders()) {
      const { instance } = wrapper;
      if (!instance || typeof instance !== 'object') continue;

      const metadata = this.reflector.get<McpToolMetadata>(MCP_TOOL_KEY, instance.constructor);
      if (!metadata) continue;

      this.tools.push({ metadata, handler: instance as IMcpToolHandler });
    }
  }

  registerAll(server: McpServer): void {
    for (const { metadata, handler } of this.tools) {
      server.registerTool(
        metadata.name,
        { title: metadata.title, description: metadata.description, inputSchema: metadata.inputSchema },
        (args: Record<string, unknown>) => handler.execute(args),
      );
    }
  }
}
