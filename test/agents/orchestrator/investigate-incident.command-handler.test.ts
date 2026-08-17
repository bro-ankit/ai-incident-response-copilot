import { TestBed } from '@automock/jest';

import { InvestigateIncidentCommand } from '../../../src/agents/orchestrator/investigate-incident.command';
import { InvestigateIncidentHandler } from '../../../src/agents/orchestrator/investigate-incident.command-handler';
import type { IncidentInvestigation } from '../../../src/agents/orchestrator/orchestrator.service';
import { OrchestratorService } from '../../../src/agents/orchestrator/orchestrator.service';
import { mockIncidentSelect } from '../../__mocks__/incident.mock';

describe('InvestigateIncidentHandler Unit Test', () => {
  let sut: InvestigateIncidentHandler;
  let orchestratorService: jest.Mocked<OrchestratorService>;

  const INCIDENT = mockIncidentSelect();
  const FULL_INVESTIGATION: IncidentInvestigation = {
    incident: INCIDENT,
    logFindings: 'Found repeated "connection pool exhausted" errors.',
    runbookFindings: 'Matched runbook: DB connection pool exhaustion under load.',
    rootCause: {
      hypotheses: [{ rootCause: 'DB connection pool exhaustion', confidence: 0.9, reasoning: 'Matches log pattern.' }],
    },
    remediation: {
      steps: [{ action: 'Roll back the deploy', rationale: 'Reverts the missing env var.', riskLevel: 'low' as const }],
    },
    warnings: [],
  };

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(InvestigateIncidentHandler).compile();
    sut = unit;
    orchestratorService = unitRef.get(OrchestratorService);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('Given execute', () => {
    describe('When the investigation fully succeeds', () => {
      test('Then it delegates the incident id to OrchestratorService and returns an InvestigationResultDto mapped from the result', async () => {
        orchestratorService.investigate.mockResolvedValue(FULL_INVESTIGATION);

        const result = await sut.execute(new InvestigateIncidentCommand(INCIDENT.id));

        expect(orchestratorService.investigate).toHaveBeenCalledWith(INCIDENT.id);
        expect(result).toEqual({
          incidentId: INCIDENT.id,
          logFindings: FULL_INVESTIGATION.logFindings,
          runbookFindings: FULL_INVESTIGATION.runbookFindings,
          hypotheses: FULL_INVESTIGATION.rootCause!.hypotheses,
          remediationSteps: FULL_INVESTIGATION.remediation!.steps,
          warnings: [],
        });
      });
    });

    describe('When the investigation degraded and has no root cause or remediation', () => {
      test('Then it maps hypotheses and remediationSteps to null and passes the warnings through', async () => {
        const degraded: IncidentInvestigation = {
          incident: INCIDENT,
          logFindings: null,
          runbookFindings: null,
          rootCause: null,
          remediation: null,
          warnings: ['Log analysis failed: log source unreachable', 'Runbook search failed: timed out'],
        };
        orchestratorService.investigate.mockResolvedValue(degraded);

        const result = await sut.execute(new InvestigateIncidentCommand(INCIDENT.id));

        expect(result).toEqual({
          incidentId: INCIDENT.id,
          logFindings: null,
          runbookFindings: null,
          hypotheses: null,
          remediationSteps: null,
          warnings: degraded.warnings,
        });
      });
    });
  });
});
