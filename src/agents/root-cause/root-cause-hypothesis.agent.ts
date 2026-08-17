import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { z } from 'zod';

import { AI_CLIENT } from '../../ai/ai.constants';
import type { AiResponseSchema, IAiClient } from '../../ai/ai.interface';
import { TrackAiUsage } from '../../metrics/track-ai-usage.decorator';
import { Resilient } from '../../resilience';
import type { IncidentSelect } from '../../schema/incidents.schema';

const ROOT_CAUSE_SCHEMA: AiResponseSchema = {
  type: 'object',
  properties: {
    hypotheses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          rootCause: { type: 'string' },
          confidence: { type: 'number' },
          reasoning: { type: 'string' },
        },
        required: ['rootCause', 'confidence', 'reasoning'],
      },
    },
  },
  required: ['hypotheses'],
};

const ROOT_CAUSE_HYPOTHESIS_RESPONSE_SCHEMA = z.object({
  hypotheses: z
    .array(
      z.object({
        rootCause: z.string(),
        confidence: z.number().min(0).max(1),
        reasoning: z.string(),
      }),
    )
    .min(1),
});

export type RootCauseHypothesisResponse = z.infer<typeof ROOT_CAUSE_HYPOTHESIS_RESPONSE_SCHEMA>;

const SYSTEM_PROMPT =
  'You are a Root-Cause Hypothesis agent. You are given log analysis findings and runbook search ' +
  'findings for a production incident, already gathered by other agents — you do not have tools of ' +
  'your own. Synthesize them into a ranked list of probable root causes, most likely first, each with ' +
  'a confidence between 0 and 1 and a reasoning grounded in the findings you were given. Do not invent ' +
  "details that aren't supported by the findings.";

@Injectable()
export class RootCauseHypothesisAgent {
  constructor(@Inject(AI_CLIENT) private readonly aiClient: IAiClient) {}

  @TrackAiUsage('ROOT_CAUSE')
  @Resilient({ options: { timeoutMs: 30_000 } })
  async synthesize(
    incident: IncidentSelect,
    logFindings: string,
    runbookFindings: string,
  ): Promise<RootCauseHypothesisResponse> {
    const prompt =
      `${SYSTEM_PROMPT}\n\n` +
      `Incident: "${incident.title}". ${incident.description}\n\n` +
      `Log analysis findings:\n${logFindings}\n\n` +
      `Runbook search findings:\n${runbookFindings}`;

    const raw = await this.aiClient.generateStructured(prompt, ROOT_CAUSE_SCHEMA);

    try {
      return ROOT_CAUSE_HYPOTHESIS_RESPONSE_SCHEMA.parse(raw);
    } catch (err) {
      throw new InternalServerErrorException('Root-Cause Hypothesis agent returned a malformed response', {
        cause: err,
      });
    }
  }
}
