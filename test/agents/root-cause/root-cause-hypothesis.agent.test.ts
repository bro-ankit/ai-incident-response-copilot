import { TestBed } from '@automock/jest';

import { RootCauseHypothesisAgent } from '../../../src/agents/root-cause/root-cause-hypothesis.agent';
import { AI_CLIENT } from '../../../src/ai/ai.constants';
import type { IAiClient } from '../../../src/ai/ai.interface';
import { mockIncidentSelect } from '../../__mocks__/incident.mock';
import { AssertUtils } from '../../utils/assert.utils';

describe('RootCauseHypothesisAgent Unit Test', () => {
  let sut: RootCauseHypothesisAgent;
  let aiClient: jest.Mocked<IAiClient>;

  const INCIDENT = mockIncidentSelect();
  const LOG_FINDINGS = 'Found repeated "connection pool exhausted" errors starting at 14:03 UTC.';
  const RUNBOOK_FINDINGS = 'Matched runbook: DB connection pool exhaustion under load.';

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(RootCauseHypothesisAgent).compile();
    sut = unit;
    aiClient = unitRef.get(AI_CLIENT);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('Given synthesize', () => {
    describe('When the AI client returns a well-formed response', () => {
      test('Then it prompts with the incident and both findings and returns the parsed hypotheses', async () => {
        aiClient.generateStructured.mockResolvedValue({
          hypotheses: [
            { rootCause: 'DB connection pool exhaustion', confidence: 0.9, reasoning: 'Matches log pattern.' },
          ],
        });

        const result = await sut.synthesize(INCIDENT, LOG_FINDINGS, RUNBOOK_FINDINGS);

        expect(result).toEqual({
          hypotheses: [
            { rootCause: 'DB connection pool exhaustion', confidence: 0.9, reasoning: 'Matches log pattern.' },
          ],
        });

        const [prompt] = aiClient.generateStructured.mock.calls[0];
        expect(prompt).toContain(INCIDENT.title);
        expect(prompt).toContain(LOG_FINDINGS);
        expect(prompt).toContain(RUNBOOK_FINDINGS);
      });
    });

    describe('When the AI client returns a response that fails schema validation', () => {
      test('Then it throws InternalServerErrorException', async () => {
        aiClient.generateStructured.mockResolvedValue({ hypotheses: [{ rootCause: 'x' }] });

        await AssertUtils.assertError(
          () => sut.synthesize(INCIDENT, LOG_FINDINGS, RUNBOOK_FINDINGS),
          'Root-Cause Hypothesis agent returned a malformed response',
          500,
        );
      });
    });
  });
});
