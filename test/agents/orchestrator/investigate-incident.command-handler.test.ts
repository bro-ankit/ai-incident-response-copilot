import { TestBed } from '@automock/jest';

import { InvestigateIncidentCommand } from '../../../src/agents/orchestrator/investigate-incident.command';
import { InvestigateIncidentHandler } from '../../../src/agents/orchestrator/investigate-incident.command-handler';
import { OrchestratorService } from '../../../src/agents/orchestrator/orchestrator.service';
import { mockIncidentSelect } from '../../__mocks__/incident.mock';

describe('InvestigateIncidentHandler Unit Test', () => {
  let sut: InvestigateIncidentHandler;
  let orchestratorService: jest.Mocked<OrchestratorService>;

  const INCIDENT = mockIncidentSelect();
  const INVESTIGATION = {
    incident: INCIDENT,
    logFindings: 'Found repeated "connection pool exhausted" errors.',
    runbookFindings: 'Matched runbook: DB connection pool exhaustion under load.',
    rootCause: {
      hypotheses: [{ rootCause: 'DB connection pool exhaustion', confidence: 0.9, reasoning: 'Matches log pattern.' }],
    },
    remediation: {
      steps: [{ action: 'Roll back the deploy', rationale: 'Reverts the missing env var.', riskLevel: 'low' as const }],
    },
  };

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(InvestigateIncidentHandler).compile();
    sut = unit;
    orchestratorService = unitRef.get(OrchestratorService);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('Given execute', () => {
    describe('When the investigation succeeds', () => {
      test('Then it delegates the incident id to OrchestratorService and returns an InvestigationResultDto mapped from the result', async () => {
        orchestratorService.investigate.mockResolvedValue(INVESTIGATION);

        const result = await sut.execute(new InvestigateIncidentCommand(INCIDENT.id));

        expect(orchestratorService.investigate).toHaveBeenCalledWith(INCIDENT.id);
        expect(result).toEqual({
          incidentId: INCIDENT.id,
          logFindings: INVESTIGATION.logFindings,
          runbookFindings: INVESTIGATION.runbookFindings,
          hypotheses: INVESTIGATION.rootCause.hypotheses,
          remediationSteps: INVESTIGATION.remediation.steps,
        });
      });
    });
  });
});
