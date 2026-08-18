import { TestBed } from '@automock/jest';

import { LogAnalysisAgent } from '../../../src/agents/log-analysis/log-analysis.agent';
import { ToolCallingAgentRunner } from '../../../src/agents/tool-calling-agent-runner.service';
import { LogSearchMcpClient } from '../../../src/mcp/client/log-search-mcp-client';
import { mockIncidentSelect } from '../../__mocks__/incident.mock';

const SYSTEM_PROMPT =
  'You are a Log Analysis agent investigating a production incident. You have access to a ' +
  'search_incident_logs tool. Investigate methodically: start broad (all logs, or ERROR/FATAL level ' +
  "logs for this incident), then narrow with keyword searches based on what you find. Don't stop at the " +
  'first result — if the logs suggest a more specific query would help, run it. When you have enough ' +
  'evidence, respond with a concise summary of the error pattern, timeline, and any root-cause signals ' +
  'you observed, citing specific log lines.';

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
        expect(params).toEqual({
          systemPrompt: SYSTEM_PROMPT,
          userMessage:
            `Incident ${INCIDENT.id}: "${INCIDENT.title}".\n${INCIDENT.description}\n\n` +
            'Investigate the logs for this incident and summarize what you find.',
          mcpClient,
        });
      });
    });
  });
});
