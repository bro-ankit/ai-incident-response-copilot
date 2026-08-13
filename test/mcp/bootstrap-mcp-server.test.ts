import type { Type } from '@nestjs/common';

const mockRegisterAll = jest.fn();
const mockGet = jest.fn(() => ({ registerAll: mockRegisterAll }));
const mockClose = jest.fn().mockResolvedValue(undefined);
const mockAppContext = { get: mockGet, close: mockClose };
const mockCreateApplicationContext = jest.fn().mockResolvedValue(mockAppContext);

const mockConnect = jest.fn().mockResolvedValue(undefined);
const MockMcpServer = jest.fn().mockImplementation(() => ({ connect: mockConnect }));
const MockStdioServerTransport = jest.fn().mockImplementation(() => ({}));

jest.mock('@nestjs/core', () => ({ NestFactory: { createApplicationContext: mockCreateApplicationContext } }));
jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({ McpServer: MockMcpServer }));
jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({ StdioServerTransport: MockStdioServerTransport }));

import { bootstrapMcpServer } from '../../src/mcp/bootstrap-mcp-server';
import { McpToolDiscoveryService } from '../../src/mcp/mcp-tool-discovery.service';

class DummyModule {}

describe('Given bootstrapMcpServer', () => {
  describe('When called with a module, name and version', () => {
    test('Then it boots the module with Nest logging disabled, builds an McpServer with that name/version, registers all discovered tools from the context, connects over stdio, and wires SIGINT/SIGTERM to close the context and exit 0', async () => {
      jest.clearAllMocks();
      const registeredHandlers: Record<string, () => void> = {};
      const processOnSpy = jest
        .spyOn(process, 'on')
        .mockImplementation((event: string | symbol, handler: () => void) => {
          registeredHandlers[String(event)] = handler;
          return process;
        });
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      await bootstrapMcpServer({
        module: DummyModule as unknown as Type<unknown>,
        name: 'my-server',
        version: '1.0.0',
      });

      expect(mockCreateApplicationContext).toHaveBeenCalledWith(DummyModule, { logger: false });
      expect(MockMcpServer).toHaveBeenCalledWith({ name: 'my-server', version: '1.0.0' });
      expect(mockGet).toHaveBeenCalledWith(McpToolDiscoveryService);
      expect(mockRegisterAll).toHaveBeenCalledTimes(1);
      expect(MockStdioServerTransport).toHaveBeenCalledTimes(1);
      expect(mockConnect).toHaveBeenCalledTimes(1);
      expect(Object.keys(registeredHandlers).sort()).toEqual(['SIGINT', 'SIGTERM']);

      registeredHandlers['SIGINT']!();
      await Promise.resolve();
      await Promise.resolve();

      expect(mockClose).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(0);

      processOnSpy.mockRestore();
      processExitSpy.mockRestore();
    });
  });
});
