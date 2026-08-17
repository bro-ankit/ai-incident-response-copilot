import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { AI_CLIENT } from '../ai/ai.constants';
import type { AgentMessage, IAiClient } from '../ai/ai.interface';
import type { McpClient } from '../mcp/client/mcp-client';

export type ToolCallingAgentParams = {
  systemPrompt: string;
  userMessage: string;
  mcpClient: McpClient;
  maxTurns?: number;
};

export type ToolCallingAgentResult = {
  finalText: string;
  transcript: AgentMessage[];
};

const DEFAULT_MAX_TURNS = 6;

@Injectable()
export class ToolCallingAgentRunner {
  constructor(
    @InjectPinoLogger(ToolCallingAgentRunner.name) private readonly logger: PinoLogger,
    @Inject(AI_CLIENT) private readonly aiClient: IAiClient,
  ) {}

  async run(params: ToolCallingAgentParams): Promise<ToolCallingAgentResult> {
    const maxTurns = params.maxTurns ?? DEFAULT_MAX_TURNS;
    const tools = params.mcpClient.getTools();
    const history: AgentMessage[] = [{ role: 'user', text: params.userMessage }];

    for (let turn = 0; turn < maxTurns; turn++) {
      const result = await this.aiClient.generateWithTools(params.systemPrompt, history, tools);

      if (result.type === 'final_answer') {
        return { finalText: result.text, transcript: history };
      }

      this.logger.info({ turn, toolName: result.toolName, args: result.args }, 'Tool-calling agent tool call');
      history.push({
        role: 'tool_call',
        toolName: result.toolName,
        args: result.args,
        thoughtSignature: result.thoughtSignature,
      });

      const toolResult = await params.mcpClient.callTool(result.toolName, result.args);
      history.push({ role: 'tool_result', toolName: result.toolName, result: toolResult });
    }

    throw new InternalServerErrorException(`Tool-calling agent did not reach a final answer within ${maxTurns} turns`);
  }
}
