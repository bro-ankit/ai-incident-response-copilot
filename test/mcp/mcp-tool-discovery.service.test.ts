import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Injectable } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { z } from 'zod';

import { McpTool } from '../../src/mcp/mcp-tool.decorator';
import type { IMcpToolHandler } from '../../src/mcp/mcp-tool.interface';
import { McpToolDiscoveryService } from '../../src/mcp/mcp-tool-discovery.service';

const SEARCH_THING_SCHEMA = { query: z.string() };

@Injectable()
@McpTool({
  name: 'search_thing',
  title: 'Search thing',
  description: 'Searches for a thing.',
  inputSchema: SEARCH_THING_SCHEMA,
})
class DummySearchThingTool implements IMcpToolHandler {
  async execute(args: Record<string, unknown>) {
    return { content: [{ type: 'text' as const, text: `found: ${String(args.query)}` }] };
  }
}

@Injectable()
class UndecoratedProvider {}

describe('McpToolDiscoveryService', () => {
  describe('Given a module with one @McpTool-decorated provider and one undecorated provider', () => {
    describe('When the module initializes', () => {
      let module: TestingModule;
      let sut: McpToolDiscoveryService;

      beforeAll(async () => {
        module = await Test.createTestingModule({
          imports: [DiscoveryModule],
          providers: [McpToolDiscoveryService, DummySearchThingTool, UndecoratedProvider],
        }).compile();

        sut = module.get(McpToolDiscoveryService);
        await module.init();
      });

      afterAll(() => module.close());

      describe('And registerAll is called with an McpServer', () => {
        test('Then it registers only the decorated tool, with its metadata and a handler that delegates execute to the discovered instance', async () => {
          const registerTool = jest.fn();
          const mockServer = { registerTool } as unknown as McpServer;

          sut.registerAll(mockServer);

          expect(registerTool).toHaveBeenCalledTimes(1);
          expect(registerTool).toHaveBeenCalledWith(
            'search_thing',
            { title: 'Search thing', description: 'Searches for a thing.', inputSchema: SEARCH_THING_SCHEMA },
            expect.any(Function),
          );

          const registeredCallback = registerTool.mock.calls[0][2];
          const result = await registeredCallback({ query: 'kafka' });

          expect(result).toEqual({ content: [{ type: 'text', text: 'found: kafka' }] });
        });
      });
    });
  });
});
