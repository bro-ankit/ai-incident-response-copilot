import { TestBed } from '@automock/jest';

import { AI_CLIENT } from '../../../src/ai/ai.constants';
import type { IAiClient } from '../../../src/ai/ai.interface';
import { EvalJudgeService } from '../../../src/evals/judge/eval-judge.service';
import { mockIncidentSelect } from '../../__mocks__/incident.mock';
import { AssertUtils } from '../../utils/assert.utils';

describe('EvalJudgeService Unit Test', () => {
  let sut: EvalJudgeService;
  let aiClient: jest.Mocked<IAiClient>;

  const INCIDENT = mockIncidentSelect();
  const HYPOTHESIS = { rootCause: 'DB connection pool exhaustion', confidence: 0.9, reasoning: 'Matches log pattern.' };
  const LOG_FINDINGS = 'Found repeated "connection pool exhausted" errors starting at 14:03 UTC.';
  const RUNBOOK_FINDINGS = 'Matched runbook: DB connection pool exhaustion under load.';

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(EvalJudgeService).compile();
    sut = unit;
    aiClient = unitRef.get(AI_CLIENT);
  });

  const buildExpectedPrompt = (logFindings: string, runbookFindings: string): string =>
    [
      "You are an expert evaluator judging an AI incident-response system's root-cause hypothesis.",
      '',
      `INCIDENT: "${INCIDENT.title}". ${INCIDENT.description}`,
      '',
      `GROUND TRUTH ROOT CAUSE: ${INCIDENT.groundTruthRootCause}`,
      `GROUND TRUTH EXPLANATION: ${INCIDENT.groundTruthExplanation}`,
      '',
      'LOG ANALYSIS FINDINGS USED TO GENERATE THE HYPOTHESIS:',
      logFindings,
      '',
      'RUNBOOK SEARCH FINDINGS USED TO GENERATE THE HYPOTHESIS:',
      runbookFindings,
      '',
      "SYSTEM'S TOP HYPOTHESIS:",
      `Root cause: ${HYPOTHESIS.rootCause}`,
      `Confidence: ${HYPOTHESIS.confidence}`,
      `Reasoning: ${HYPOTHESIS.reasoning}`,
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

  beforeEach(() => jest.clearAllMocks());

  describe('Given score', () => {
    describe('When the AI client returns a well-formed response', () => {
      test('Then it prompts with the incident, ground truth, findings and hypothesis, and returns the parsed scores', async () => {
        aiClient.generateStructured.mockResolvedValue({
          correctness: 0.9,
          groundedness: 0.85,
          reasoning: 'Matches ground truth and is grounded in the findings.',
        });

        const result = await sut.score({
          incident: INCIDENT,
          hypothesis: HYPOTHESIS,
          logFindings: LOG_FINDINGS,
          runbookFindings: RUNBOOK_FINDINGS,
        });

        expect(result).toEqual({
          correctness: 0.9,
          groundedness: 0.85,
          reasoning: 'Matches ground truth and is grounded in the findings.',
        });

        const [prompt] = aiClient.generateStructured.mock.calls[0];
        expect(prompt).toBe(buildExpectedPrompt(LOG_FINDINGS, RUNBOOK_FINDINGS));
      });
    });

    describe('When findings are null', () => {
      test('Then it substitutes an unavailable-findings placeholder in the prompt', async () => {
        aiClient.generateStructured.mockResolvedValue({ correctness: 0.5, groundedness: 0.5, reasoning: 'Unsure.' });

        await sut.score({ incident: INCIDENT, hypothesis: HYPOTHESIS, logFindings: null, runbookFindings: null });

        const [prompt] = aiClient.generateStructured.mock.calls[0];
        expect(prompt).toBe(
          buildExpectedPrompt(
            '(none — log analysis failed or was unavailable)',
            '(none — runbook search failed or was unavailable)',
          ),
        );
      });
    });

    describe('When the AI client returns a response that fails schema validation', () => {
      test('Then it throws InternalServerErrorException', async () => {
        aiClient.generateStructured.mockResolvedValue({ correctness: 1.5, groundedness: 0.5 });

        await AssertUtils.assertError(
          () =>
            sut.score({
              incident: INCIDENT,
              hypothesis: HYPOTHESIS,
              logFindings: LOG_FINDINGS,
              runbookFindings: RUNBOOK_FINDINGS,
            }),
          'Eval judge returned an invalid scoring schema',
          500,
        );
      });
    });
  });
});
