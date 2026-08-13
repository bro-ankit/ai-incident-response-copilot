import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ModuleMetadata } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';

import { McpToolDiscoveryService } from '../../src/mcp/mcp-tool-discovery.service';

// Test-only types local to McpToolTestEnvironment — not meant to be reused from src/.
export type McpToolTestProviderOverride = { provide: unknown; useValue: unknown };

export type McpToolTestServerInfo = { name: string; version: string };

export class McpToolTestEnvironment {
  module!: TestingModule;
  client!: Client;

  async start(
    mcpModule: NonNullable<ModuleMetadata['imports']>[number],
    overrides: McpToolTestProviderOverride[],
    serverInfo: McpToolTestServerInfo,
  ): Promise<void> {
    let builder = Test.createTestingModule({ imports: [mcpModule] });
    for (const override of overrides) {
      builder = builder.overrideProvider(override.provide).useValue(override.useValue);
    }
    this.module = await builder.compile();
    await this.module.init();

    const server = new McpServer(serverInfo);
    this.module.get(McpToolDiscoveryService).registerAll(server);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    this.client = new Client({ name: 'test-client', version: '1.0.0' });
    await this.client.connect(clientTransport);
  }

  async stop(): Promise<void> {
    await this.client.close();
    await this.module.close();
  }
}
