import { Injectable } from '@nestjs/common';

import { LogSearchMcpClient } from '../../mcp/client/log-search-mcp-client';
import { TrackAiUsage } from '../../metrics/track-ai-usage.decorator';
import { Resilient } from '../../resilience';
import type { IncidentSelect } from '../../schema/incidents.schema';
import { ToolCallingAgentRunner } from '../tool-calling-agent-runner.service';

const SYSTEM_PROMPT =
  'You are a Log Analysis agent investigating a production incident. You have access to a ' +
  'search_incident_logs tool. Investigate methodically: start broad (all logs, or ERROR/FATAL level ' +
  "logs for this incident), then narrow with keyword searches based on what you find. Don't stop at the " +
  'first result — if the logs suggest a more specific query would help, run it. When you have enough ' +
  'evidence, respond with a concise summary of the error pattern, timeline, and any root-cause signals ' +
  'you observed, citing specific log lines.';

@Injectable()
export class LogAnalysisAgent {
  constructor(
    private readonly mcpClient: LogSearchMcpClient,
    private readonly runner: ToolCallingAgentRunner,
  ) {}

  @TrackAiUsage('LOG_ANALYSIS')
  @Resilient({ options: { timeoutMs: 60_000, maxAttempts: 1 } })
  async investigate(incident: IncidentSelect): Promise<string> {
    const userMessage =
      `Incident ${incident.id}: "${incident.title}".\n${incident.description}\n\n` +
      'Investigate the logs for this incident and summarize what you find.';

    const result = await this.runner.run({ systemPrompt: SYSTEM_PROMPT, userMessage, mcpClient: this.mcpClient });
    return result.finalText;
  }
}
