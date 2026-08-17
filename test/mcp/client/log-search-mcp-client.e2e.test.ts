import { LogSearchMcpClient } from '../../../src/mcp/client/log-search-mcp-client';
import { McpClientTestEnvironment } from '../../helpers/mcp-client-test-environment';

describe('LogSearchMcpClient e2e Test', () => {
  const env = new McpClientTestEnvironment();
  const sut = new LogSearchMcpClient();

  beforeAll(async () => await env.start(sut), 60_000);
  afterAll(async () => await env.stop(sut));

  describe('Given onModuleInit', () => {
    describe('When the client connects over stdio to the real log-search MCP server subprocess', () => {
      test('Then it spawns the server at the configured path and lists the search_incident_logs tool', () => {
        expect(sut.getTools()).toEqual([
          {
            name: 'search_incident_logs',
            description:
              'Search the log lines captured for a specific incident. Supports filtering by keyword and log level, ' +
              'and returns results ordered oldest-first so timing/sequence around the incident window is preserved.',
            parameters: {
              type: 'object',
              properties: {
                incidentId: { type: 'string' },
                query: { type: 'string' },
                level: { type: 'string' },
                limit: { type: 'number' },
              },
              required: ['incidentId'],
            },
          },
        ]);
      });
    });
  });
});
