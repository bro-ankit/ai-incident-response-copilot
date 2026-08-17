import { TestBed } from '@automock/jest';

import { RemediationAgent } from '../../../src/agents/remediation/remediation.agent';
import type { RootCauseHypothesisResponse } from '../../../src/agents/root-cause/root-cause-hypothesis.agent';
import { AI_CLIENT } from '../../../src/ai/ai.constants';
import type { IAiClient } from '../../../src/ai/ai.interface';
import { mockIncidentSelect } from '../../__mocks__/incident.mock';
import { AssertUtils } from '../../utils/assert.utils';

describe('RemediationAgent Unit Test', () => {
  let sut: RemediationAgent;
  let aiClient: jest.Mocked<IAiClient>;

  const INCIDENT = mockIncidentSelect();
  const ROOT_CAUSE: RootCauseHypothesisResponse = {
    hypotheses: [{ rootCause: 'DB connection pool exhaustion', confidence: 0.9, reasoning: 'Matches log pattern.' }],
  };

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(RemediationAgent).compile();
    sut = unit;
    aiClient = unitRef.get(AI_CLIENT);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('Given propose', () => {
    describe('When the AI client returns a well-formed response', () => {
      test('Then it prompts with the incident and the top hypothesis and returns the parsed steps', async () => {
        aiClient.generateStructured.mockResolvedValue({
          steps: [{ action: 'Roll back the deploy', rationale: 'Reverts the missing env var.', riskLevel: 'low' }],
        });

        const result = await sut.propose(INCIDENT, ROOT_CAUSE);

        expect(result).toEqual({
          steps: [{ action: 'Roll back the deploy', rationale: 'Reverts the missing env var.', riskLevel: 'low' }],
        });

        const [prompt] = aiClient.generateStructured.mock.calls[0]!;
        expect(prompt).toContain(INCIDENT.title);
        expect(prompt).toContain(ROOT_CAUSE.hypotheses[0].rootCause);
        expect(prompt).toContain(ROOT_CAUSE.hypotheses[0].reasoning);
      });
    });

    describe('When the AI client returns a response that fails schema validation', () => {
      test('Then it throws InternalServerErrorException', async () => {
        aiClient.generateStructured.mockResolvedValue({ steps: [{ action: 'x', riskLevel: 'extreme' }] });

        await AssertUtils.assertError(
          () => sut.propose(INCIDENT, ROOT_CAUSE),
          'Remediation agent returned a malformed response',
          500,
        );
      });
    });
  });
});
