import { RunbookSearchMcpClient } from '../../../src/mcp/client/runbook-search-mcp-client';
import { McpClientTestEnvironment } from '../../helpers/mcp-client-test-environment';

describe('RunbookSearchMcpClient e2e Test', () => {
  const env = new McpClientTestEnvironment();
  const sut = new RunbookSearchMcpClient();

  beforeAll(async () => await env.start(sut), 60_000);
  afterAll(async () => await env.stop(sut));

  describe('Given onModuleInit', () => {
    describe('When the client connects over stdio to the real runbook-search MCP server subprocess', () => {
      test('Then it spawns the server at the configured path and lists the search_runbooks tool', () => {
        expect(sut.getTools()).toEqual([
          {
            name: 'search_runbooks',
            description:
              'Hybrid (semantic + keyword) search over the runbook/postmortem knowledge base. Returns the top matching ' +
              'runbooks for a natural-language description of symptoms or a suspected root cause.',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string' },
              },
              required: ['query'],
            },
          },
        ]);
      });
    });
  });
});
