import type { UUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DRIZZLE_DB } from '../database/database.constants';
import type { DrizzleDb } from '../database/database.module';
import { DrizzleTransactionContext } from '../database/drizzle-transaction.context';
import { type IncidentSelect, incidentsTable } from '../schema/incidents.schema';

@Injectable()
export class IncidentsRepository {
  constructor(
    @InjectPinoLogger(IncidentsRepository.name) private readonly logger: PinoLogger,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly txContext: DrizzleTransactionContext,
  ) {}

  async findAll(): Promise<IncidentSelect[]> {
    this.logger.debug('Listing incidents');
    const client = this.txContext.getClient(this.db);
    return client.select().from(incidentsTable).orderBy(desc(incidentsTable.occurredAt));
  }

  async findGoldenSet(): Promise<IncidentSelect[]> {
    this.logger.debug('Listing golden-case incidents for eval');
    const client = this.txContext.getClient(this.db);
    return client
      .select()
      .from(incidentsTable)
      .where(eq(incidentsTable.isGoldenCase, true))
      .orderBy(desc(incidentsTable.occurredAt));
  }

  async findById(id: UUID): Promise<IncidentSelect | undefined> {
    this.logger.debug({ id }, 'Finding incident by id');
    const client = this.txContext.getClient(this.db);
    const [result] = await client.select().from(incidentsTable).where(eq(incidentsTable.id, id)).limit(1);
    return result;
  }
}
