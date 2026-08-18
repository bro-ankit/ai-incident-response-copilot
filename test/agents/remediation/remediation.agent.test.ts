import { TestBed } from '@automock/jest';

import { RemediationAgent } from '../../../src/agents/remediation/remediation.agent';
import type { RootCauseHypothesisResponse } from '../../../src/agents/root-cause/root-cause-hypothesis.agent';
import { AI_CLIENT } from '../../../src/ai/ai.constants';
import type { IAiClient } from '../../../src/ai/ai.interface';
import { GraphRepository } from '../../../src/graph/graph.repository';
import { mockIncidentSelect } from '../../__mocks__/incident.mock';
import { AssertUtils } from '../../utils/assert.utils';

describe('RemediationAgent Unit Test', () => {
  let sut: RemediationAgent;
  let aiClient: jest.Mocked<IAiClient>;
  let graphRepository: jest.Mocked<GraphRepository>;

  const INCIDENT = mockIncidentSelect();
  const ROOT_CAUSE: RootCauseHypothesisResponse = {
    hypotheses: [{ rootCause: 'DB connection pool exhaustion', confidence: 0.9, reasoning: 'Matches log pattern.' }],
  };

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(RemediationAgent).compile();
    sut = unit;
    aiClient = unitRef.get(AI_CLIENT);
    graphRepository = unitRef.get(GraphRepository);
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

        const [prompt] = aiClient.generateStructured.mock.calls[0];
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

    describe('When the graph repository returns affected services', () => {
      test('Then the prompt includes each affected service and its criticality', async () => {
        graphRepository.blastRadius.mockResolvedValue([
          { name: 'checkout-service', criticality: 'hard' },
          { name: 'notifications-service', criticality: 'soft' },
        ]);
        aiClient.generateStructured.mockResolvedValue({
          steps: [{ action: 'Roll back the deploy', rationale: 'Reverts the missing env var.', riskLevel: 'low' }],
        });

        await sut.propose(INCIDENT, ROOT_CAUSE);

        expect(graphRepository.blastRadius).toHaveBeenCalledWith(INCIDENT.service);
        const [prompt] = aiClient.generateStructured.mock.calls[0];
        expect(prompt).toContain('checkout-service (hard)');
        expect(prompt).toContain('notifications-service (soft)');
      });
    });

    describe('When the graph repository lookup fails', () => {
      test('Then it proceeds without a blast radius section instead of failing the whole proposal', async () => {
        graphRepository.blastRadius.mockRejectedValue(new Error('neo4j unreachable'));
        aiClient.generateStructured.mockResolvedValue({
          steps: [{ action: 'Roll back the deploy', rationale: 'Reverts the missing env var.', riskLevel: 'low' }],
        });

        const result = await sut.propose(INCIDENT, ROOT_CAUSE);

        expect(result).toEqual({
          steps: [{ action: 'Roll back the deploy', rationale: 'Reverts the missing env var.', riskLevel: 'low' }],
        });
        const [prompt] = aiClient.generateStructured.mock.calls[0];
        expect(prompt).not.toContain('Blast radius');
      });
    });
  });
});
