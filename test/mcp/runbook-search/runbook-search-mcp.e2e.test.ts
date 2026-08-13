import { RunbookSearchMcpModule } from '../../../src/mcp/runbook-search/runbook-search-mcp.module';
import { SearchService } from '../../../src/runbooks/search/search.service';
import { mockRunbookSelect } from '../../__mocks__/runbook.mock';
import { McpToolTestEnvironment } from '../../helpers/mcp-tool-test-environment';

describe('RunbookSearchMcpModule Protocol e2e Test', () => {
  const env = new McpToolTestEnvironment();
  let searchService: jest.Mocked<SearchService>;

  beforeAll(async () => {
    await env.start(RunbookSearchMcpModule, [{ provide: SearchService, useValue: { search: jest.fn() } }], {
      name: 'runbook-search',
      version: '1.0.0',
    });
    searchService = env.module.get(SearchService);
  });

  afterAll(() => env.stop());

  describe('Given the search_runbooks tool registered on a real McpServer', () => {
    describe('When a real MCP Client calls it over an in-memory transport', () => {
      test('Then it delegates to SearchService.search with the query and returns id/title/content/services as a JSON text content block', async () => {
        const runbook = mockRunbookSelect({
          title: 'Runbook: Service OOMKilled / CrashLoopBackOff after a deploy',
          content: 'Symptoms: pods restart every few minutes after a deploy.',
          services: ['payments-api'],
        });
        searchService.search.mockResolvedValue([runbook]);

        const result = await env.client.callTool({
          name: 'search_runbooks',
          arguments: { query: 'OOMKilled after a deploy' },
        });

        expect(searchService.search).toHaveBeenCalledWith('OOMKilled after a deploy');
        expect(result).toEqual({
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                [{ id: runbook.id, title: runbook.title, content: runbook.content, services: runbook.services }],
                null,
                2,
              ),
            },
          ],
        });
      });
    });
  });
});
