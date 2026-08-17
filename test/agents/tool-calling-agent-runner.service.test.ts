import { TestBed } from '@automock/jest';

import { ToolCallingAgentRunner } from '../../src/agents/tool-calling-agent-runner.service';
import { AI_CLIENT } from '../../src/ai/ai.constants';
import type { AgentTool, IAiClient } from '../../src/ai/ai.interface';
import type { McpClient } from '../../src/mcp/client/mcp-client';
import { AssertUtils } from '../utils/assert.utils';

describe('ToolCallingAgentRunner Unit Test', () => {
  let sut: ToolCallingAgentRunner;
  let aiClient: jest.Mocked<IAiClient>;

  const SYSTEM_PROMPT = 'You are a test agent.';
  const USER_MESSAGE = 'Investigate the incident.';
  const TOOLS: AgentTool[] = [
    { name: 'search', description: 'search something', parameters: { type: 'object', properties: {}, required: [] } },
  ];

  const mockMcpClient = (): jest.Mocked<McpClient> =>
    ({
      getTools: jest.fn().mockReturnValue(TOOLS),
      callTool: jest.fn(),
    }) as unknown as jest.Mocked<McpClient>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(ToolCallingAgentRunner).compile();
    sut = unit;
    aiClient = unitRef.get(AI_CLIENT);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('Given run', () => {
    describe('When the model answers immediately without calling a tool', () => {
      test('Then it returns the final text with a transcript containing only the user message', async () => {
        aiClient.generateWithTools.mockResolvedValue({ type: 'final_answer', text: 'No investigation needed.' });
        const mcpClient = mockMcpClient();

        const result = await sut.run({ systemPrompt: SYSTEM_PROMPT, userMessage: USER_MESSAGE, mcpClient });

        expect(result).toEqual({
          finalText: 'No investigation needed.',
          transcript: [{ role: 'user', text: USER_MESSAGE }],
        });
        expect(aiClient.generateWithTools).toHaveBeenCalledWith(
          SYSTEM_PROMPT,
          [{ role: 'user', text: USER_MESSAGE }],
          TOOLS,
        );
        expect(mcpClient.callTool).not.toHaveBeenCalled();
      });
    });

    describe('When the model calls a tool once before answering', () => {
      test('Then it executes the tool via the MCP client, appends the call and result to the transcript, and returns the final answer', async () => {
        aiClient.generateWithTools
          .mockResolvedValueOnce({ type: 'tool_call', toolName: 'search', args: { q: 'OOMKilled' } })
          .mockResolvedValueOnce({ type: 'final_answer', text: 'Found the OOMKilled error.' });
        const mcpClient = mockMcpClient();
        mcpClient.callTool.mockResolvedValue([{ line: 'OOMKilled at 14:03' }]);

        const result = await sut.run({ systemPrompt: SYSTEM_PROMPT, userMessage: USER_MESSAGE, mcpClient });

        expect(result).toEqual({
          finalText: 'Found the OOMKilled error.',
          transcript: [
            { role: 'user', text: USER_MESSAGE },
            { role: 'tool_call', toolName: 'search', args: { q: 'OOMKilled' }, thoughtSignature: undefined },
            { role: 'tool_result', toolName: 'search', result: [{ line: 'OOMKilled at 14:03' }] },
          ],
        });
        expect(mcpClient.callTool).toHaveBeenCalledWith('search', { q: 'OOMKilled' });
      });
    });

    describe('When the model never reaches a final answer within maxTurns', () => {
      test('Then it throws InternalServerErrorException without exceeding maxTurns calls', async () => {
        aiClient.generateWithTools.mockResolvedValue({ type: 'tool_call', toolName: 'search', args: {} });
        const mcpClient = mockMcpClient();
        mcpClient.callTool.mockResolvedValue([]);

        await AssertUtils.assertError(
          () => sut.run({ systemPrompt: SYSTEM_PROMPT, userMessage: USER_MESSAGE, mcpClient, maxTurns: 2 }),
          'Tool-calling agent did not reach a final answer within 2 turns',
          500,
        );

        expect(aiClient.generateWithTools).toHaveBeenCalledTimes(2);
      });
    });
  });
});
