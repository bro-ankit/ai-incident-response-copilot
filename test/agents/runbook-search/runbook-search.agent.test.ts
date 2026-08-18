import { TestBed } from '@automock/jest';

import { RunbookSearchAgent } from '../../../src/agents/runbook-search/runbook-search.agent';
import { ToolCallingAgentRunner } from '../../../src/agents/tool-calling-agent-runner.service';
import { RunbookSearchMcpClient } from '../../../src/mcp/client/runbook-search-mcp-client';
import { mockIncidentSelect } from '../../__mocks__/incident.mock';

const SYSTEM_PROMPT =
  'You are a Runbook Search agent. You have access to a search_runbooks tool over a knowledge base of ' +
  'runbooks and postmortems. Search using a query that captures the symptoms and likely failure mode of ' +
  'the incident, not just its title verbatim. If the results look like a weak match, try reformulating ' +
  'the query once before giving up. When you have a good match (or are confident there is none), respond ' +
  'with the best matching runbook — its title and how it applies here — or say plainly that no relevant ' +
  'runbook was found.';

describe('RunbookSearchAgent Unit Test', () => {
  let sut: RunbookSearchAgent;
  let runner: jest.Mocked<ToolCallingAgentRunner>;
  let mcpClient: jest.Mocked<RunbookSearchMcpClient>;

  const INCIDENT = mockIncidentSelect();

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(RunbookSearchAgent).compile();
    sut = unit;
    runner = unitRef.get(ToolCallingAgentRunner);
    mcpClient = unitRef.get(RunbookSearchMcpClient);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('Given investigate', () => {
    describe('When the runner reaches a final answer', () => {
      test('Then it runs the RunbookSearchMcpClient with a user message describing the incident and returns the final text', async () => {
        runner.run.mockResolvedValue({ finalText: 'Matched runbook: DB connection pool exhaustion.', transcript: [] });

        const result = await sut.investigate(INCIDENT);

        expect(result).toBe('Matched runbook: DB connection pool exhaustion.');

        const [params] = runner.run.mock.calls[0];
        expect(params).toEqual({
          systemPrompt: SYSTEM_PROMPT,
          userMessage:
            `Incident: "${INCIDENT.title}". ${INCIDENT.description}\n\n` +
            'Search the runbook knowledge base for a matching runbook.',
          mcpClient,
        });
      });
    });
  });
});
