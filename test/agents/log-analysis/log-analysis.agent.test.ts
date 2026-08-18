import { TestBed } from '@automock/jest';

import { LogAnalysisAgent } from '../../../src/agents/log-analysis/log-analysis.agent';
import { ToolCallingAgentRunner } from '../../../src/agents/tool-calling-agent-runner.service';
import { LogSearchMcpClient } from '../../../src/mcp/client/log-search-mcp-client';
import { mockIncidentSelect } from '../../__mocks__/incident.mock';

describe('LogAnalysisAgent Unit Test', () => {
  let sut: LogAnalysisAgent;
  let runner: jest.Mocked<ToolCallingAgentRunner>;
  let mcpClient: jest.Mocked<LogSearchMcpClient>;

  const INCIDENT = mockIncidentSelect();

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(LogAnalysisAgent).compile();
    sut = unit;
    runner = unitRef.get(ToolCallingAgentRunner);
    mcpClient = unitRef.get(LogSearchMcpClient);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('Given investigate', () => {
    describe('When the runner reaches a final answer', () => {
      test('Then it runs the LogSearchMcpClient with a user message describing the incident and returns the final text', async () => {
        runner.run.mockResolvedValue({ finalText: 'Found repeated connection pool errors.', transcript: [] });

        const result = await sut.investigate(INCIDENT);

        expect(result).toBe('Found repeated connection pool errors.');

        const [params] = runner.run.mock.calls[0];
        expect(params.mcpClient).toBe(mcpClient);
        expect(params.userMessage).toContain(INCIDENT.id);
        expect(params.userMessage).toContain(INCIDENT.title);
        expect(params.userMessage).toContain(INCIDENT.description);
      });
    });
  });
});
