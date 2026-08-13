import { UUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, ilike } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DRIZZLE_DB } from '../database/database.constants';
import type { DrizzleDb } from '../database/database.module';
import { DrizzleTransactionContext } from '../database/drizzle-transaction.context';
import { type IncidentLogSelect, incidentLogsTable, type LogLevel } from '../schema/incident-logs.schema';

export type IncidentLogSearchParams = {
  incidentId: UUID;
  query?: string;
  level?: LogLevel;
  limit?: number;
};

const DEFAULT_LOG_SEARCH_LIMIT = 50;

@Injectable()
export class IncidentLogsRepository {
  constructor(
    @InjectPinoLogger(IncidentLogsRepository.name) private readonly logger: PinoLogger,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly txContext: DrizzleTransactionContext,
  ) {}

  async search(params: IncidentLogSearchParams): Promise<IncidentLogSelect[]> {
    this.logger.debug(params, 'Searching incident logs');
    const client = this.txContext.getClient(this.db);

    const conditions = [eq(incidentLogsTable.incidentId, params.incidentId)];
    if (params.query) {
      conditions.push(ilike(incidentLogsTable.message, `%${params.query}%`));
    }
    if (params.level) {
      conditions.push(eq(incidentLogsTable.level, params.level));
    }

    return client
      .select()
      .from(incidentLogsTable)
      .where(and(...conditions))
      .orderBy(asc(incidentLogsTable.timestamp))
      .limit(params.limit ?? DEFAULT_LOG_SEARCH_LIMIT);
  }
}
