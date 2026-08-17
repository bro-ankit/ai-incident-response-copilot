import { TestBed } from '@automock/jest';

import { RunbookSearchAgent } from '../../../src/agents/runbook-search/runbook-search.agent';
import { ToolCallingAgentRunner } from '../../../src/agents/tool-calling-agent-runner.service';
import { RunbookSearchMcpClient } from '../../../src/mcp/client/runbook-search-mcp-client';
import { mockIncidentSelect } from '../../__mocks__/incident.mock';

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

        const [params] = runner.run.mock.calls[0]!;
        expect(params.mcpClient).toBe(mcpClient);
        expect(params.userMessage).toContain(INCIDENT.title);
        expect(params.userMessage).toContain(INCIDENT.description);
      });
    });
  });
});
