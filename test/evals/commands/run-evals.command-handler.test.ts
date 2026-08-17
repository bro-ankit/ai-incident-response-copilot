import { TestBed } from '@automock/jest';
import { ConfigService } from '@nestjs/config';

import type { IncidentInvestigation } from '../../../src/agents/orchestrator/orchestrator.service';
import { OrchestratorService } from '../../../src/agents/orchestrator/orchestrator.service';
import { RunEvalsCommand } from '../../../src/evals/commands/run-evals.command';
import { RunEvalsCommandHandler } from '../../../src/evals/commands/run-evals.command-handler';
import { EvalsRepository } from '../../../src/evals/evals.repository';
import { EvalJudgeService } from '../../../src/evals/judge/eval-judge.service';
import { IncidentsRepository } from '../../../src/incidents/incidents.repository';
import { mockEvalRunSelect } from '../../__mocks__/eval-run.mock';
import { mockIncidentSelect } from '../../__mocks__/incident.mock';

describe('RunEvalsCommandHandler Unit Test', () => {
  let sut: RunEvalsCommandHandler;
  let incidentsRepository: jest.Mocked<IncidentsRepository>;
  let orchestratorService: jest.Mocked<OrchestratorService>;
  let evalJudgeService: jest.Mocked<EvalJudgeService>;
  let evalsRepository: jest.Mocked<EvalsRepository>;

  const INCIDENT_A = mockIncidentSelect({ title: 'payments-api OOM', groundTruthRootCause: 'Memory leak' });
  const INCIDENT_B = mockIncidentSelect({ title: 'checkout-service 504s', groundTruthRootCause: 'Pool exhaustion' });

  const investigationWithHypothesis = (rootCause: string): IncidentInvestigation => ({
    incident: INCIDENT_A,
    logFindings: 'log findings',
    runbookFindings: 'runbook findings',
    rootCause: { hypotheses: [{ rootCause, confidence: 0.9, reasoning: 'Matches pattern.' }] },
    remediation: { steps: [{ action: 'Roll back', rationale: 'Reverts change.', riskLevel: 'low' }] },
    warnings: [],
  });

  const DEGRADED_INVESTIGATION: IncidentInvestigation = {
    incident: INCIDENT_B,
    logFindings: null,
    runbookFindings: null,
    rootCause: null,
    remediation: null,
    warnings: ['Log analysis failed: timed out', 'Runbook search failed: timed out'],
  };

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(RunEvalsCommandHandler)
      .mock(ConfigService)
      .using({ get: () => undefined })
      .compile();
    sut = unit;
    incidentsRepository = unitRef.get(IncidentsRepository);
    orchestratorService = unitRef.get(OrchestratorService);
    evalJudgeService = unitRef.get(EvalJudgeService);
    evalsRepository = unitRef.get(EvalsRepository);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('Given execute', () => {
    describe('When every incident produces a hypothesis and scores above the weak threshold', () => {
      test('Then it judges and persists each case and returns a summary with no weak cases', async () => {
        incidentsRepository.findGoldenSet.mockResolvedValue([INCIDENT_A]);
        const investigation = investigationWithHypothesis('Memory leak in idempotency cache');
        orchestratorService.investigate.mockResolvedValue(investigation);
        evalJudgeService.score.mockResolvedValue({ correctness: 0.9, groundedness: 0.85, reasoning: 'Matches.' });
        const storedRun = mockEvalRunSelect({
          incidentId: INCIDENT_A.id,
          incidentTitle: INCIDENT_A.title,
          groundTruthRootCause: INCIDENT_A.groundTruthRootCause,
          hypothesis: 'Memory leak in idempotency cache',
          logFindings: 'log findings',
          runbookFindings: 'runbook findings',
          correctnessScore: 0.9,
          groundednessScore: 0.85,
          reasoning: 'Matches.',
        });
        evalsRepository.insert.mockResolvedValue(storedRun);

        const result = await sut.execute(new RunEvalsCommand());

        expect(orchestratorService.investigate).toHaveBeenCalledWith(INCIDENT_A.id);
        expect(evalJudgeService.score).toHaveBeenCalledWith({
          incident: INCIDENT_A,
          hypothesis: investigation.rootCause!.hypotheses[0],
          logFindings: 'log findings',
          runbookFindings: 'runbook findings',
        });
        expect(evalsRepository.insert).toHaveBeenCalledWith({
          incidentId: INCIDENT_A.id,
          incidentTitle: INCIDENT_A.title,
          groundTruthRootCause: INCIDENT_A.groundTruthRootCause,
          hypothesis: 'Memory leak in idempotency cache',
          logFindings: 'log findings',
          runbookFindings: 'runbook findings',
          correctnessScore: 0.9,
          groundednessScore: 0.85,
          reasoning: 'Matches.',
        });
        expect(result).toEqual({
          totalCases: 1,
          avgCorrectness: 0.9,
          avgGroundedness: 0.85,
          weakCases: [],
          runs: [
            {
              id: storedRun.id,
              incidentId: storedRun.incidentId,
              incidentTitle: storedRun.incidentTitle,
              hypothesis: storedRun.hypothesis,
              correctnessScore: storedRun.correctnessScore,
              groundednessScore: storedRun.groundednessScore,
              reasoning: storedRun.reasoning,
              createdAt: storedRun.createdAt,
            },
          ],
        });
      });
    });

    describe('When the pipeline does not produce a hypothesis for an incident', () => {
      test('Then it skips the judge call and persists a zero-scored case citing the orchestrator warnings', async () => {
        incidentsRepository.findGoldenSet.mockResolvedValue([INCIDENT_B]);
        orchestratorService.investigate.mockResolvedValue(DEGRADED_INVESTIGATION);
        const expectedReasoning =
          'Pipeline did not produce a hypothesis: Log analysis failed: timed out; Runbook search failed: timed out';
        const storedRun = mockEvalRunSelect({
          incidentId: INCIDENT_B.id,
          incidentTitle: INCIDENT_B.title,
          groundTruthRootCause: INCIDENT_B.groundTruthRootCause,
          hypothesis: null,
          logFindings: null,
          runbookFindings: null,
          correctnessScore: 0,
          groundednessScore: 0,
          reasoning: expectedReasoning,
        });
        evalsRepository.insert.mockResolvedValue(storedRun);

        const result = await sut.execute(new RunEvalsCommand());

        expect(evalJudgeService.score).not.toHaveBeenCalled();
        expect(evalsRepository.insert).toHaveBeenCalledWith({
          incidentId: INCIDENT_B.id,
          incidentTitle: INCIDENT_B.title,
          groundTruthRootCause: INCIDENT_B.groundTruthRootCause,
          hypothesis: null,
          logFindings: null,
          runbookFindings: null,
          correctnessScore: 0,
          groundednessScore: 0,
          reasoning: expectedReasoning,
        });
        expect(result.runs).toEqual([
          {
            id: storedRun.id,
            incidentId: storedRun.incidentId,
            incidentTitle: storedRun.incidentTitle,
            hypothesis: null,
            correctnessScore: 0,
            groundednessScore: 0,
            reasoning: expectedReasoning,
            createdAt: storedRun.createdAt,
          },
        ]);
        expect(result.weakCases).toEqual([
          { incidentTitle: INCIDENT_B.title, correctnessScore: 0, groundednessScore: 0 },
        ]);
      });
    });

    describe('When one incident scores below the weak threshold and another above it', () => {
      test('Then only the weak one appears in weakCases', async () => {
        const incidentC = mockIncidentSelect({ title: 'weak case incident' });
        incidentsRepository.findGoldenSet.mockResolvedValue([INCIDENT_A, incidentC]);
        orchestratorService.investigate.mockResolvedValue(investigationWithHypothesis('some cause'));
        evalJudgeService.score
          .mockResolvedValueOnce({ correctness: 0.9, groundedness: 0.9, reasoning: 'Good.' })
          .mockResolvedValueOnce({ correctness: 0.4, groundedness: 0.9, reasoning: 'Wrong cause.' });
        evalsRepository.insert
          .mockResolvedValueOnce(
            mockEvalRunSelect({
              incidentId: INCIDENT_A.id,
              incidentTitle: INCIDENT_A.title,
              correctnessScore: 0.9,
              groundednessScore: 0.9,
              reasoning: 'Good.',
            }),
          )
          .mockResolvedValueOnce(
            mockEvalRunSelect({
              incidentId: incidentC.id,
              incidentTitle: incidentC.title,
              correctnessScore: 0.4,
              groundednessScore: 0.9,
              reasoning: 'Wrong cause.',
            }),
          );

        const result = await sut.execute(new RunEvalsCommand());

        expect(result.totalCases).toBe(2);
        expect(result.weakCases).toEqual([
          { incidentTitle: incidentC.title, correctnessScore: 0.4, groundednessScore: 0.9 },
        ]);
      });
    });

    describe('When an incident throws during investigation', () => {
      test('Then it logs and skips that case, without failing the whole run', async () => {
        incidentsRepository.findGoldenSet.mockResolvedValue([INCIDENT_A]);
        orchestratorService.investigate.mockRejectedValue(new Error('Gemini API call failed'));

        const result = await sut.execute(new RunEvalsCommand());

        expect(evalsRepository.insert).not.toHaveBeenCalled();
        expect(result).toEqual({ totalCases: 0, avgCorrectness: 0, avgGroundedness: 0, weakCases: [], runs: [] });
      });
    });

    describe('When there are no incidents to evaluate', () => {
      test('Then it returns a zeroed summary without calling the orchestrator', async () => {
        incidentsRepository.findGoldenSet.mockResolvedValue([]);

        const result = await sut.execute(new RunEvalsCommand());

        expect(orchestratorService.investigate).not.toHaveBeenCalled();
        expect(result).toEqual({ totalCases: 0, avgCorrectness: 0, avgGroundedness: 0, weakCases: [], runs: [] });
      });
    });
  });
});
