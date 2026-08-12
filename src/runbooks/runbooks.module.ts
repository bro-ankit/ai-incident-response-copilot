import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { RunbooksRepository } from './runbooks.repository';
import { RUNBOOK_QUERY_HANDLERS } from './search';
import { RerankerService } from './search/reranker.service';
import { SearchController } from './search/search.controller';
import { SearchService } from './search/search.service';

@Module({
  imports: [CqrsModule],
  providers: [RunbooksRepository, SearchService, RerankerService, ...RUNBOOK_QUERY_HANDLERS],
  controllers: [SearchController],
  exports: [RunbooksRepository, SearchService],
})
export class RunbooksModule {}
