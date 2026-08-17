import type { UUID } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { IncidentsRepository } from '../../incidents/incidents.repository';
import type { IncidentSelect } from '../../schema/incidents.schema';
import { LogAnalysisAgent } from '../log-analysis/log-analysis.agent';
import { RemediationAgent, type RemediationResponse } from '../remediation/remediation.agent';
import { RootCauseHypothesisAgent, type RootCauseHypothesisResponse } from '../root-cause/root-cause-hypothesis.agent';
import { RunbookSearchAgent } from '../runbook-search/runbook-search.agent';

export type IncidentInvestigation = {
  incident: IncidentSelect;
  logFindings: string | null;
  runbookFindings: string | null;
  rootCause: RootCauseHypothesisResponse | null;
  remediation: RemediationResponse | null;
  warnings: string[];
};

type Findings = { logFindings: string | null; runbookFindings: string | null };

// Below this, the top hypothesis isn't trustworthy enough to hand to the Remediation agent
const ROOT_CAUSE_CONFIDENCE_THRESHOLD = 0.5;

@Injectable()
export class OrchestratorService {
  constructor(
    @InjectPinoLogger(OrchestratorService.name) private readonly logger: PinoLogger,
    private readonly incidentsRepository: IncidentsRepository,
    private readonly logAnalysisAgent: LogAnalysisAgent,
    private readonly runbookSearchAgent: RunbookSearchAgent,
    private readonly rootCauseHypothesisAgent: RootCauseHypothesisAgent,
    private readonly remediationAgent: RemediationAgent,
  ) {}

  async investigate(incidentId: UUID): Promise<IncidentInvestigation> {
    const incident = await this.incidentsRepository.findById(incidentId);
    if (!incident) {
      throw new NotFoundException(`Incident ${incidentId} not found`);
    }

    this.logger.info({ incidentId }, 'Starting incident investigation');

    const warnings: string[] = [];
    const { logFindings, runbookFindings } = await this.gatherFindings(incident, warnings);

    if (logFindings === null && runbookFindings === null) {
      warnings.push('No findings available from either sub-agent — cannot synthesize a root cause.');
      this.logger.warn({ incidentId }, 'Investigation could not proceed past evidence gathering');
      return { incident, logFindings, runbookFindings, rootCause: null, remediation: null, warnings };
    }

    const rootCause = await this.synthesizeRootCause(incident, logFindings, runbookFindings, warnings);
    if (!rootCause) {
      return { incident, logFindings, runbookFindings, rootCause: null, remediation: null, warnings };
    }

    if (this.confidenceTooLow(incident, rootCause, warnings)) {
      return { incident, logFindings, runbookFindings, rootCause, remediation: null, warnings };
    }

    const remediation = await this.proposeRemediation(incident, rootCause, warnings);

    this.logger.info({ incidentId, warnings }, 'Incident investigation complete');
    return { incident, logFindings, runbookFindings, rootCause, remediation, warnings };
  }

  private async gatherFindings(incident: IncidentSelect, warnings: string[]): Promise<Findings> {
    const [logResult, runbookResult] = await Promise.allSettled([
      this.logAnalysisAgent.investigate(incident),
      this.runbookSearchAgent.investigate(incident),
    ]);

    return {
      logFindings: this.unwrap(logResult, 'Log analysis', warnings),
      runbookFindings: this.unwrap(runbookResult, 'Runbook search', warnings),
    };
  }

  private async synthesizeRootCause(
    incident: IncidentSelect,
    logFindings: string | null,
    runbookFindings: string | null,
    warnings: string[],
  ): Promise<RootCauseHypothesisResponse | null> {
    try {
      return await this.rootCauseHypothesisAgent.synthesize(
        incident,
        logFindings ?? '(log analysis failed — no findings available)',
        runbookFindings ?? '(runbook search failed — no findings available)',
      );
    } catch (err) {
      warnings.push(`Root-cause synthesis failed: ${this.errorMessage(err)}`);
      this.logger.warn({ incidentId: incident.id, err }, 'Root-cause synthesis failed');
      return null;
    }
  }

  private confidenceTooLow(
    incident: IncidentSelect,
    rootCause: RootCauseHypothesisResponse,
    warnings: string[],
  ): boolean {
    const topConfidence = rootCause.hypotheses[0]!.confidence;
    if (topConfidence >= ROOT_CAUSE_CONFIDENCE_THRESHOLD) return false;

    warnings.push(
      `Top hypothesis confidence (${topConfidence}) is below the ${ROOT_CAUSE_CONFIDENCE_THRESHOLD} ` +
        'threshold — skipping remediation, needs human review.',
    );
    this.logger.warn({ incidentId: incident.id, topConfidence }, 'Root-cause confidence too low, skipping remediation');
    return true;
  }

  private async proposeRemediation(
    incident: IncidentSelect,
    rootCause: RootCauseHypothesisResponse,
    warnings: string[],
  ): Promise<RemediationResponse | null> {
    try {
      return await this.remediationAgent.propose(incident, rootCause);
    } catch (err) {
      warnings.push(`Remediation proposal failed: ${this.errorMessage(err)}`);
      this.logger.warn({ incidentId: incident.id, err }, 'Remediation proposal failed');
      return null;
    }
  }

  private unwrap(result: PromiseSettledResult<string>, label: string, warnings: string[]): string | null {
    if (result.status === 'fulfilled') return result.value;
    warnings.push(`${label} failed: ${this.errorMessage(result.reason)}`);
    this.logger.warn({ err: result.reason }, `${label} failed`);
    return null;
  }

  private errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
