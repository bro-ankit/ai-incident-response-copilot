import { TestBed } from '@automock/jest';

import { LogAnalysisAgent } from '../../../src/agents/log-analysis/log-analysis.agent';
import { OrchestratorService } from '../../../src/agents/orchestrator/orchestrator.service';
import { RemediationAgent } from '../../../src/agents/remediation/remediation.agent';
import { RootCauseHypothesisAgent } from '../../../src/agents/root-cause/root-cause-hypothesis.agent';
import { RunbookSearchAgent } from '../../../src/agents/runbook-search/runbook-search.agent';
import { IncidentsRepository } from '../../../src/incidents/incidents.repository';
import { mockIncidentSelect } from '../../__mocks__/incident.mock';
import { AssertUtils } from '../../utils/assert.utils';

describe('OrchestratorService Unit Test', () => {
  let sut: OrchestratorService;
  let incidentsRepository: jest.Mocked<IncidentsRepository>;
  let logAnalysisAgent: jest.Mocked<LogAnalysisAgent>;
  let runbookSearchAgent: jest.Mocked<RunbookSearchAgent>;
  let rootCauseHypothesisAgent: jest.Mocked<RootCauseHypothesisAgent>;
  let remediationAgent: jest.Mocked<RemediationAgent>;

  const INCIDENT = mockIncidentSelect();
  const LOG_FINDINGS = 'Found repeated "connection pool exhausted" errors starting at 14:03 UTC.';
  const RUNBOOK_FINDINGS = 'Matched runbook: DB connection pool exhaustion under load.';
  const ROOT_CAUSE = {
    hypotheses: [{ rootCause: 'DB connection pool exhaustion', confidence: 0.9, reasoning: 'Matches log pattern.' }],
  };
  const REMEDIATION = {
    steps: [{ action: 'Roll back the deploy', rationale: 'Reverts the missing env var.', riskLevel: 'low' as const }],
  };

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(OrchestratorService).compile();
    sut = unit;
    incidentsRepository = unitRef.get(IncidentsRepository);
    logAnalysisAgent = unitRef.get(LogAnalysisAgent);
    runbookSearchAgent = unitRef.get(RunbookSearchAgent);
    rootCauseHypothesisAgent = unitRef.get(RootCauseHypothesisAgent);
    remediationAgent = unitRef.get(RemediationAgent);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('Given investigate', () => {
    describe('When the incident exists', () => {
      test('Then it dispatches log analysis and runbook search, synthesizes a root cause, proposes remediation, and returns the combined investigation', async () => {
        incidentsRepository.findById.mockResolvedValue(INCIDENT);
        logAnalysisAgent.investigate.mockResolvedValue(LOG_FINDINGS);
        runbookSearchAgent.investigate.mockResolvedValue(RUNBOOK_FINDINGS);
        rootCauseHypothesisAgent.synthesize.mockResolvedValue(ROOT_CAUSE);
        remediationAgent.propose.mockResolvedValue(REMEDIATION);

        const result = await sut.investigate(INCIDENT.id);

        expect(result).toEqual({
          incident: INCIDENT,
          logFindings: LOG_FINDINGS,
          runbookFindings: RUNBOOK_FINDINGS,
          rootCause: ROOT_CAUSE,
          remediation: REMEDIATION,
        });

        expect(incidentsRepository.findById).toHaveBeenCalledWith(INCIDENT.id);
        expect(logAnalysisAgent.investigate).toHaveBeenCalledWith(INCIDENT);
        expect(runbookSearchAgent.investigate).toHaveBeenCalledWith(INCIDENT);
        expect(rootCauseHypothesisAgent.synthesize).toHaveBeenCalledWith(INCIDENT, LOG_FINDINGS, RUNBOOK_FINDINGS);
        expect(remediationAgent.propose).toHaveBeenCalledWith(INCIDENT, ROOT_CAUSE);
      });
    });

    describe('When the incident does not exist', () => {
      test('Then it throws NotFoundException without dispatching any agent', async () => {
        incidentsRepository.findById.mockResolvedValue(undefined);

        await AssertUtils.assertError(() => sut.investigate(INCIDENT.id), `Incident ${INCIDENT.id} not found`, 404);

        expect(logAnalysisAgent.investigate).not.toHaveBeenCalled();
        expect(runbookSearchAgent.investigate).not.toHaveBeenCalled();
        expect(rootCauseHypothesisAgent.synthesize).not.toHaveBeenCalled();
        expect(remediationAgent.propose).not.toHaveBeenCalled();
      });
    });
  });
});
