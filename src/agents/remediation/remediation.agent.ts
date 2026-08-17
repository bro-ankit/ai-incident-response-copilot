import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { z } from 'zod';

import { AI_CLIENT } from '../../ai/ai.constants';
import type { AiResponseSchema, IAiClient } from '../../ai/ai.interface';
import { TrackAiUsage } from '../../metrics/track-ai-usage.decorator';
import type { IncidentSelect } from '../../schema/incidents.schema';
import type { RootCauseHypothesisResponse } from '../root-cause/root-cause-hypothesis.agent';

const REMEDIATION_SCHEMA: AiResponseSchema = {
  type: 'object',
  properties: {
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          action: { type: 'string' },
          rationale: { type: 'string' },
          riskLevel: { type: 'string' },
        },
        required: ['action', 'rationale', 'riskLevel'],
      },
    },
  },
  required: ['steps'],
};

const REMEDIATION_RESPONSE_SCHEMA = z.object({
  steps: z
    .array(
      z.object({
        action: z.string(),
        rationale: z.string(),
        riskLevel: z.enum(['low', 'medium', 'high']),
      }),
    )
    .min(1),
});

export type RemediationResponse = z.infer<typeof REMEDIATION_RESPONSE_SCHEMA>;

const SYSTEM_PROMPT =
  'You are a Remediation agent. You are given the top root-cause hypothesis for a production incident. ' +
  'Propose concrete remediation steps (e.g. rollback, scale up, restart, config change), each with a ' +
  'rationale and a risk level of low, medium, or high. You are propose-only: you never execute anything ' +
  'yourself, and every step you propose requires explicit human approval before it can be carried out. ' +
  'Order steps from lowest-risk/fastest-to-try to highest-risk.';

@Injectable()
export class RemediationAgent {
  constructor(@Inject(AI_CLIENT) private readonly aiClient: IAiClient) {}

  @TrackAiUsage('REMEDIATION')
  async propose(incident: IncidentSelect, rootCause: RootCauseHypothesisResponse): Promise<RemediationResponse> {
    const topHypothesis = rootCause.hypotheses[0]!;
    const prompt =
      `${SYSTEM_PROMPT}\n\n` +
      `Incident: "${incident.title}". ${incident.description}\n\n` +
      `Top root-cause hypothesis: ${topHypothesis.rootCause} (confidence: ${topHypothesis.confidence})\n` +
      `Reasoning: ${topHypothesis.reasoning}`;

    const raw = await this.aiClient.generateStructured(prompt, REMEDIATION_SCHEMA);

    try {
      return REMEDIATION_RESPONSE_SCHEMA.parse(raw);
    } catch (err) {
      throw new InternalServerErrorException('Remediation agent returned a malformed response', { cause: err });
    }
  }
}
