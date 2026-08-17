import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { IncidentsModule } from '../incidents/incidents.module';
import { LogAnalysisAgent } from './log-analysis/log-analysis.agent';
import { ORCHESTRATOR_COMMAND_HANDLERS } from './orchestrator';
import { OrchestratorController } from './orchestrator/orchestrator.controller';
import { OrchestratorService } from './orchestrator/orchestrator.service';
import { RemediationAgent } from './remediation/remediation.agent';
import { RootCauseHypothesisAgent } from './root-cause/root-cause-hypothesis.agent';
import { RunbookSearchAgent } from './runbook-search/runbook-search.agent';
import { ToolCallingAgentRunner } from './tool-calling-agent-runner.service';

@Module({
  imports: [CqrsModule, IncidentsModule],
  providers: [
    ToolCallingAgentRunner,
    LogAnalysisAgent,
    RunbookSearchAgent,
    RootCauseHypothesisAgent,
    RemediationAgent,
    OrchestratorService,
    ...ORCHESTRATOR_COMMAND_HANDLERS,
  ],
  controllers: [OrchestratorController],
  exports: [OrchestratorService],
})
export class AgentsModule {}
