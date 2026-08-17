import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { z } from 'zod';

import { AI_CLIENT } from '../../ai/ai.constants';
import type { AiResponseSchema, IAiClient } from '../../ai/ai.interface';
import { TrackAiUsage } from '../../metrics/track-ai-usage.decorator';
import type { EvalJudgeInput, EvalJudgeResult } from '../evals.types';

const JUDGE_AI_SCHEMA: AiResponseSchema = {
  type: 'object',
  properties: {
    correctness: { type: 'number' },
    groundedness: { type: 'number' },
    reasoning: { type: 'string' },
  },
  required: ['correctness', 'groundedness', 'reasoning'],
};

const EVAL_JUDGE_RESULT_SCHEMA = z.object({
  correctness: z.number().min(0).max(1),
  groundedness: z.number().min(0).max(1),
  reasoning: z.string(),
});

@Injectable()
export class EvalJudgeService {
  constructor(
    @InjectPinoLogger(EvalJudgeService.name) private readonly logger: PinoLogger,
    @Inject(AI_CLIENT) private readonly aiClient: IAiClient,
  ) {}

  @TrackAiUsage('EVAL_JUDGE')
  async score(input: EvalJudgeInput): Promise<EvalJudgeResult> {
    const prompt = this.buildJudgePrompt(input);
    this.logger.debug({ incidentId: input.incident.id }, 'Scoring eval case with LLM judge');

    const raw = await this.aiClient.generateStructured(prompt, JUDGE_AI_SCHEMA);

    const parsed = EVAL_JUDGE_RESULT_SCHEMA.safeParse(raw);
    if (!parsed.success) {
      this.logger.error({ issues: parsed.error.issues, raw }, 'Judge returned invalid schema');
      throw new InternalServerErrorException('Eval judge returned an invalid scoring schema');
    }

    return parsed.data;
  }

  private buildJudgePrompt(input: EvalJudgeInput): string {
    return [
      "You are an expert evaluator judging an AI incident-response system's root-cause hypothesis.",
      '',
      `INCIDENT: "${input.incident.title}". ${input.incident.description}`,
      '',
      `GROUND TRUTH ROOT CAUSE: ${input.incident.groundTruthRootCause}`,
      `GROUND TRUTH EXPLANATION: ${input.incident.groundTruthExplanation}`,
      '',
      'LOG ANALYSIS FINDINGS USED TO GENERATE THE HYPOTHESIS:',
      input.logFindings ?? '(none — log analysis failed or was unavailable)',
      '',
      'RUNBOOK SEARCH FINDINGS USED TO GENERATE THE HYPOTHESIS:',
      input.runbookFindings ?? '(none — runbook search failed or was unavailable)',
      '',
      "SYSTEM'S TOP HYPOTHESIS:",
      `Root cause: ${input.hypothesis.rootCause}`,
      `Confidence: ${input.hypothesis.confidence}`,
      `Reasoning: ${input.hypothesis.reasoning}`,
      '',
      'Score this hypothesis on two dimensions:',
      '- correctness (0.0–1.0): Does the hypothesis identify the same underlying root cause as the ground ' +
        'truth, allowing for different phrasing? 1.0 = same cause, 0.0 = unrelated or wrong cause.',
      "- groundedness (0.0–1.0): Is the hypothesis's reasoning actually supported by the log analysis and " +
        "runbook findings it was given, without inventing details those findings don't contain? " +
        '1.0 = fully grounded, 0.0 = hallucinated.',
      '',
      'Return strict JSON only.',
    ].join('\n');
  }
}
