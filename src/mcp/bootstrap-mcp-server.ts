import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { DynamicModule, ForwardReference, INestApplicationContext, Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { McpToolDiscoveryService } from './mcp-tool-discovery.service';

export type BootstrapMcpServerOptions = {
  module: Type<unknown> | DynamicModule | ForwardReference;
  name: string;
  version: string;
};

export async function bootstrapMcpServer(options: BootstrapMcpServerOptions): Promise<void> {
  let appContext: INestApplicationContext | undefined;

  try {
    appContext = await NestFactory.createApplicationContext(options.module, { logger: false });

    const server = new McpServer({ name: options.name, version: options.version });
    appContext.get(McpToolDiscoveryService).registerAll(server);

    const transport = new StdioServerTransport();
    await server.connect(transport);

    const context = appContext;
    const shutdown = () => void context.close().finally(() => process.exit(0));
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    if (appContext) {
      appContext.get(Logger).error(error, `${options.name} MCP server failed to start`);
    } else {
      // eslint-disable-next-line no-console
      console.error(`${options.name} MCP server failed to start:`, error);
    }
    process.exit(1);
  }
}
