import { Module } from '@nestjs/common';

import { IncidentLogsRepository } from './incident-logs.repository';
import { IncidentsRepository } from './incidents.repository';

@Module({
  providers: [IncidentsRepository, IncidentLogsRepository],
  exports: [IncidentsRepository, IncidentLogsRepository],
})
export class IncidentsModule {}
