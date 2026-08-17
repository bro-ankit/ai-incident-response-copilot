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
  logFindings: string;
  runbookFindings: string;
  rootCause: RootCauseHypothesisResponse;
  remediation: RemediationResponse;
};

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

    const [logFindings, runbookFindings] = await Promise.all([
      this.logAnalysisAgent.investigate(incident),
      this.runbookSearchAgent.investigate(incident),
    ]);

    const rootCause = await this.rootCauseHypothesisAgent.synthesize(incident, logFindings, runbookFindings);
    const remediation = await this.remediationAgent.propose(incident, rootCause);

    this.logger.info({ incidentId }, 'Incident investigation complete');

    return { incident, logFindings, runbookFindings, rootCause, remediation };
  }
}
