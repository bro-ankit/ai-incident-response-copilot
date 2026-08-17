import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { AgentsModule } from '../agents/agents.module';
import { IncidentsModule } from '../incidents/incidents.module';
import { EVALS_COMMAND_HANDLERS } from './commands';
import { EvalsController } from './evals.controller';
import { EvalsRepository } from './evals.repository';
import { EvalJudgeService } from './judge/eval-judge.service';

@Module({
  imports: [CqrsModule, IncidentsModule, AgentsModule],
  controllers: [EvalsController],
  providers: [EvalsRepository, EvalJudgeService, ...EVALS_COMMAND_HANDLERS],
})
export class EvalsModule {}
