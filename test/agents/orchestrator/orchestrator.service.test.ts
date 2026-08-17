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
  const HIGH_CONFIDENCE_ROOT_CAUSE = {
    hypotheses: [{ rootCause: 'DB connection pool exhaustion', confidence: 0.9, reasoning: 'Matches log pattern.' }],
  };
  const LOW_CONFIDENCE_ROOT_CAUSE = {
    hypotheses: [{ rootCause: 'Unclear — several plausible causes', confidence: 0.3, reasoning: 'Evidence is thin.' }],
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

    describe('When every sub-agent succeeds and confidence is at or above the threshold', () => {
      test('Then it dispatches log analysis and runbook search, synthesizes a root cause, proposes remediation, and returns the combined investigation with no warnings', async () => {
        incidentsRepository.findById.mockResolvedValue(INCIDENT);
        logAnalysisAgent.investigate.mockResolvedValue(LOG_FINDINGS);
        runbookSearchAgent.investigate.mockResolvedValue(RUNBOOK_FINDINGS);
        rootCauseHypothesisAgent.synthesize.mockResolvedValue(HIGH_CONFIDENCE_ROOT_CAUSE);
        remediationAgent.propose.mockResolvedValue(REMEDIATION);

        const result = await sut.investigate(INCIDENT.id);

        expect(result).toEqual({
          incident: INCIDENT,
          logFindings: LOG_FINDINGS,
          runbookFindings: RUNBOOK_FINDINGS,
          rootCause: HIGH_CONFIDENCE_ROOT_CAUSE,
          remediation: REMEDIATION,
          warnings: [],
        });

        expect(incidentsRepository.findById).toHaveBeenCalledWith(INCIDENT.id);
        expect(logAnalysisAgent.investigate).toHaveBeenCalledWith(INCIDENT);
        expect(runbookSearchAgent.investigate).toHaveBeenCalledWith(INCIDENT);
        expect(rootCauseHypothesisAgent.synthesize).toHaveBeenCalledWith(INCIDENT, LOG_FINDINGS, RUNBOOK_FINDINGS);
        expect(remediationAgent.propose).toHaveBeenCalledWith(INCIDENT, HIGH_CONFIDENCE_ROOT_CAUSE);
      });
    });

    describe('When log analysis fails but runbook search succeeds', () => {
      test('Then it still synthesizes a root cause from the available findings and records a warning about the failure', async () => {
        incidentsRepository.findById.mockResolvedValue(INCIDENT);
        logAnalysisAgent.investigate.mockRejectedValue(new Error('log source unreachable'));
        runbookSearchAgent.investigate.mockResolvedValue(RUNBOOK_FINDINGS);
        rootCauseHypothesisAgent.synthesize.mockResolvedValue(HIGH_CONFIDENCE_ROOT_CAUSE);
        remediationAgent.propose.mockResolvedValue(REMEDIATION);

        const result = await sut.investigate(INCIDENT.id);

        expect(result).toEqual({
          incident: INCIDENT,
          logFindings: null,
          runbookFindings: RUNBOOK_FINDINGS,
          rootCause: HIGH_CONFIDENCE_ROOT_CAUSE,
          remediation: REMEDIATION,
          warnings: ['Log analysis failed: log source unreachable'],
        });
        expect(rootCauseHypothesisAgent.synthesize).toHaveBeenCalledWith(
          INCIDENT,
          '(log analysis failed — no findings available)',
          RUNBOOK_FINDINGS,
        );
      });
    });

    describe('When runbook search fails but log analysis succeeds', () => {
      test('Then it still synthesizes a root cause from the available findings and records a warning about the failure', async () => {
        incidentsRepository.findById.mockResolvedValue(INCIDENT);
        logAnalysisAgent.investigate.mockResolvedValue(LOG_FINDINGS);
        runbookSearchAgent.investigate.mockRejectedValue(new Error('runbook MCP server timed out'));
        rootCauseHypothesisAgent.synthesize.mockResolvedValue(HIGH_CONFIDENCE_ROOT_CAUSE);
        remediationAgent.propose.mockResolvedValue(REMEDIATION);

        const result = await sut.investigate(INCIDENT.id);

        expect(result).toEqual({
          incident: INCIDENT,
          logFindings: LOG_FINDINGS,
          runbookFindings: null,
          rootCause: HIGH_CONFIDENCE_ROOT_CAUSE,
          remediation: REMEDIATION,
          warnings: ['Runbook search failed: runbook MCP server timed out'],
        });
        expect(rootCauseHypothesisAgent.synthesize).toHaveBeenCalledWith(
          INCIDENT,
          LOG_FINDINGS,
          '(runbook search failed — no findings available)',
        );
      });
    });

    describe('When both log analysis and runbook search fail', () => {
      test('Then it returns null findings/rootCause/remediation with warnings for both failures, without calling the synthesis or remediation agents', async () => {
        incidentsRepository.findById.mockResolvedValue(INCIDENT);
        logAnalysisAgent.investigate.mockRejectedValue(new Error('log source unreachable'));
        runbookSearchAgent.investigate.mockRejectedValue(new Error('runbook MCP server timed out'));

        const result = await sut.investigate(INCIDENT.id);

        expect(result).toEqual({
          incident: INCIDENT,
          logFindings: null,
          runbookFindings: null,
          rootCause: null,
          remediation: null,
          warnings: [
            'Log analysis failed: log source unreachable',
            'Runbook search failed: runbook MCP server timed out',
            'No findings available from either sub-agent — cannot synthesize a root cause.',
          ],
        });
        expect(rootCauseHypothesisAgent.synthesize).not.toHaveBeenCalled();
        expect(remediationAgent.propose).not.toHaveBeenCalled();
      });
    });

    describe('When root-cause synthesis fails', () => {
      test('Then it returns a null rootCause/remediation with a warning, without calling the remediation agent', async () => {
        incidentsRepository.findById.mockResolvedValue(INCIDENT);
        logAnalysisAgent.investigate.mockResolvedValue(LOG_FINDINGS);
        runbookSearchAgent.investigate.mockResolvedValue(RUNBOOK_FINDINGS);
        rootCauseHypothesisAgent.synthesize.mockRejectedValue(new Error('Gemini API call failed'));

        const result = await sut.investigate(INCIDENT.id);

        expect(result).toEqual({
          incident: INCIDENT,
          logFindings: LOG_FINDINGS,
          runbookFindings: RUNBOOK_FINDINGS,
          rootCause: null,
          remediation: null,
          warnings: ['Root-cause synthesis failed: Gemini API call failed'],
        });
        expect(remediationAgent.propose).not.toHaveBeenCalled();
      });
    });

    describe('When the top root-cause hypothesis confidence is below the threshold', () => {
      test('Then it skips remediation and records a warning that human review is needed', async () => {
        incidentsRepository.findById.mockResolvedValue(INCIDENT);
        logAnalysisAgent.investigate.mockResolvedValue(LOG_FINDINGS);
        runbookSearchAgent.investigate.mockResolvedValue(RUNBOOK_FINDINGS);
        rootCauseHypothesisAgent.synthesize.mockResolvedValue(LOW_CONFIDENCE_ROOT_CAUSE);

        const result = await sut.investigate(INCIDENT.id);

        expect(result).toEqual({
          incident: INCIDENT,
          logFindings: LOG_FINDINGS,
          runbookFindings: RUNBOOK_FINDINGS,
          rootCause: LOW_CONFIDENCE_ROOT_CAUSE,
          remediation: null,
          warnings: [
            'Top hypothesis confidence (0.3) is below the 0.5 threshold — skipping remediation, needs human review.',
          ],
        });
        expect(remediationAgent.propose).not.toHaveBeenCalled();
      });
    });

    describe('When remediation proposal fails', () => {
      test('Then it returns the root cause with a null remediation and a warning about the failure', async () => {
        incidentsRepository.findById.mockResolvedValue(INCIDENT);
        logAnalysisAgent.investigate.mockResolvedValue(LOG_FINDINGS);
        runbookSearchAgent.investigate.mockResolvedValue(RUNBOOK_FINDINGS);
        rootCauseHypothesisAgent.synthesize.mockResolvedValue(HIGH_CONFIDENCE_ROOT_CAUSE);
        remediationAgent.propose.mockRejectedValue(new Error('Gemini API call failed'));

        const result = await sut.investigate(INCIDENT.id);

        expect(result).toEqual({
          incident: INCIDENT,
          logFindings: LOG_FINDINGS,
          runbookFindings: RUNBOOK_FINDINGS,
          rootCause: HIGH_CONFIDENCE_ROOT_CAUSE,
          remediation: null,
          warnings: ['Remediation proposal failed: Gemini API call failed'],
        });
      });
    });
  });
});
