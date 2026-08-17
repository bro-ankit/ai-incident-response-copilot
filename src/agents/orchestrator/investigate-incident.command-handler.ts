import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { plainToInstance } from 'class-transformer';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { InvestigationResultDto } from '../dto/investigation-result.dto';
import { InvestigateIncidentCommand } from './investigate-incident.command';
import { OrchestratorService } from './orchestrator.service';

@CommandHandler(InvestigateIncidentCommand)
export class InvestigateIncidentHandler implements ICommandHandler<InvestigateIncidentCommand, InvestigationResultDto> {
  constructor(
    @InjectPinoLogger(InvestigateIncidentHandler.name) private readonly logger: PinoLogger,
    private readonly orchestratorService: OrchestratorService,
  ) {}

  async execute(command: InvestigateIncidentCommand): Promise<InvestigationResultDto> {
    this.logger.debug({ incidentId: command.incidentId }, 'Executing investigate incident command');

    const result = await this.orchestratorService.investigate(command.incidentId);

    return plainToInstance(
      InvestigationResultDto,
      {
        incidentId: result.incident.id,
        logFindings: result.logFindings,
        runbookFindings: result.runbookFindings,
        hypotheses: result.rootCause?.hypotheses ?? null,
        remediationSteps: result.remediation?.steps ?? null,
        warnings: result.warnings,
      },
      { excludeExtraneousValues: true },
    );
  }
}
