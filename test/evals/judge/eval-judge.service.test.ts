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
        expect(prompt).toContain(INCIDENT.title);
        expect(prompt).toContain(INCIDENT.groundTruthRootCause);
        expect(prompt).toContain(INCIDENT.groundTruthExplanation);
        expect(prompt).toContain(LOG_FINDINGS);
        expect(prompt).toContain(RUNBOOK_FINDINGS);
        expect(prompt).toContain(HYPOTHESIS.rootCause);
        expect(prompt).toContain(HYPOTHESIS.reasoning);
      });
    });

    describe('When findings are null', () => {
      test('Then it substitutes an unavailable-findings placeholder in the prompt', async () => {
        aiClient.generateStructured.mockResolvedValue({ correctness: 0.5, groundedness: 0.5, reasoning: 'Unsure.' });

        await sut.score({ incident: INCIDENT, hypothesis: HYPOTHESIS, logFindings: null, runbookFindings: null });

        const [prompt] = aiClient.generateStructured.mock.calls[0];
        expect(prompt).toContain('(none — log analysis failed or was unavailable)');
        expect(prompt).toContain('(none — runbook search failed or was unavailable)');
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
