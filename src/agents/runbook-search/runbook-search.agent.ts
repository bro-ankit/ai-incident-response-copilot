import { Injectable } from '@nestjs/common';

import { RunbookSearchMcpClient } from '../../mcp/client/runbook-search-mcp-client';
import { TrackAiUsage } from '../../metrics/track-ai-usage.decorator';
import { Resilient } from '../../resilience';
import type { IncidentSelect } from '../../schema/incidents.schema';
import { ToolCallingAgentRunner } from '../tool-calling-agent-runner.service';

const SYSTEM_PROMPT =
  'You are a Runbook Search agent. You have access to a search_runbooks tool over a knowledge base of ' +
  'runbooks and postmortems. Search using a query that captures the symptoms and likely failure mode of ' +
  'the incident, not just its title verbatim. If the results look like a weak match, try reformulating ' +
  'the query once before giving up. When you have a good match (or are confident there is none), respond ' +
  'with the best matching runbook — its title and how it applies here — or say plainly that no relevant ' +
  'runbook was found.';

@Injectable()
export class RunbookSearchAgent {
  constructor(
    private readonly mcpClient: RunbookSearchMcpClient,
    private readonly runner: ToolCallingAgentRunner,
  ) {}

  @TrackAiUsage('RUNBOOK_SEARCH')
  @Resilient({ options: { timeoutMs: 60_000, maxAttempts: 1 } })
  async investigate(incident: IncidentSelect): Promise<string> {
    const userMessage =
      `Incident: "${incident.title}". ${incident.description}\n\n` +
      'Search the runbook knowledge base for a matching runbook.';

    const result = await this.runner.run({ systemPrompt: SYSTEM_PROMPT, userMessage, mcpClient: this.mcpClient });
    return result.finalText;
  }
}
