import { randomUUID } from 'node:crypto';

import { IncidentLogsRepository } from '../../../src/incidents/incident-logs.repository';
import { LogSearchMcpModule } from '../../../src/mcp/log-search/log-search-mcp.module';
import { McpToolTestEnvironment } from '../../helpers/mcp-tool-test-environment';

describe('LogSearchMcpModule Protocol e2e Test', () => {
  const env = new McpToolTestEnvironment();
  let incidentLogsRepository: jest.Mocked<IncidentLogsRepository>;

  beforeAll(async () => {
    await env.start(LogSearchMcpModule, [{ provide: IncidentLogsRepository, useValue: { search: jest.fn() } }], {
      name: 'incident-log-search',
      version: '1.0.0',
    });
    incidentLogsRepository = env.module.get(IncidentLogsRepository);
  });

  afterAll(() => env.stop());

  describe('Given the search_incident_logs tool registered on a real McpServer', () => {
    describe('When a real MCP Client calls it over an in-memory transport', () => {
      test('Then it delegates to IncidentLogsRepository.search with the call arguments and returns its result as a JSON text content block', async () => {
        const incidentId = randomUUID();
        const logRow = {
          id: randomUUID(),
          incidentId,
          timestamp: new Date('2026-08-05T14:15:00Z'),
          level: 'FATAL' as const,
          service: 'kubelet',
          message: 'pod payments-api-7f9c6b8-x2j4l OOMKilled (exit code 137)',
          createdAt: new Date('2026-08-05T14:15:00Z'),
        };
        incidentLogsRepository.search.mockResolvedValue([logRow]);

        const result = await env.client.callTool({
          name: 'search_incident_logs',
          arguments: { incidentId, query: 'OOMKilled' },
        });

        expect(incidentLogsRepository.search).toHaveBeenCalledWith({
          incidentId,
          query: 'OOMKilled',
          level: undefined,
          limit: undefined,
        });
        expect(result).toEqual({ content: [{ type: 'text', text: JSON.stringify([logRow], null, 2) }] });
      });
    });
  });
});
