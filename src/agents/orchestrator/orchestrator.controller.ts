import type { UUID } from 'node:crypto';

import { Controller, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { InvestigateIncidentParamsDto } from '../dto/investigate-incident-params.dto';
import { InvestigationResultDto } from '../dto/investigation-result.dto';
import { InvestigateIncidentCommand } from './investigate-incident.command';

@ApiTags('orchestrator')
@Controller('incidents')
export class OrchestratorController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post(':incidentId/investigate')
  @ApiOperation({
    summary:
      'Run the multi-agent investigation pipeline for an incident: log analysis + runbook search, ' +
      'then root-cause synthesis, then a propose-only remediation plan',
  })
  @ApiOkResponse({ type: InvestigationResultDto })
  investigate(@Param() params: InvestigateIncidentParamsDto): Promise<InvestigationResultDto> {
    return this.commandBus.execute(new InvestigateIncidentCommand(params.incidentId as UUID));
  }
}
