import type { UUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DRIZZLE_DB } from '../database/database.constants';
import type { DrizzleDb } from '../database/database.module';
import { DrizzleTransactionContext } from '../database/drizzle-transaction.context';
import { type EmbeddingModel, type RunbookInsert, type RunbookSelect, runbooksTable } from '../schema/runbooks.schema';

@Injectable()
export class RunbooksRepository {
  constructor(
    @InjectPinoLogger(RunbooksRepository.name) private readonly logger: PinoLogger,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly txContext: DrizzleTransactionContext,
  ) {}

  async insert(data: RunbookInsert): Promise<RunbookSelect> {
    this.logger.debug('Inserting runbook');
    const client = this.txContext.getClient(this.db);
    const searchableText = `${data.title} ${data.content} ${(data.services ?? []).join(' ')}`;
    const [result] = await client
      .insert(runbooksTable)
      .values({ ...data, tsvContent: sql`to_tsvector('english', ${searchableText})` })
      .returning();
    return result;
  }

  async findSimilarIds(embedding: number[], limit: number, embeddingModel: EmbeddingModel): Promise<UUID[]> {
    const client = this.txContext.getClient(this.db);
    const vector = `[${embedding.join(',')}]`;
    const distanceExpr = sql<number>`${runbooksTable.embedding} <=> ${vector}::vector`;
    const rows = await client
      .select({ id: runbooksTable.id })
      .from(runbooksTable)
      .where(and(isNotNull(runbooksTable.embedding), eq(runbooksTable.embeddingModel, embeddingModel)))
      .orderBy(distanceExpr)
      .limit(limit);
    return rows.map((r) => r.id);
  }

  async findByLexical(query: string, limit: number): Promise<UUID[]> {
    const client = this.txContext.getClient(this.db);
    const rows = await client
      .select({ id: runbooksTable.id })
      .from(runbooksTable)
      .where(
        and(
          isNotNull(runbooksTable.tsvContent),
          sql`${runbooksTable.tsvContent} @@ plainto_tsquery('english', ${query})`,
        ),
      )
      .orderBy(sql`ts_rank(${runbooksTable.tsvContent}, plainto_tsquery('english', ${query})) DESC`)
      .limit(limit);
    return rows.map((r) => r.id);
  }

  async findByIds(ids: UUID[]): Promise<RunbookSelect[]> {
    if (ids.length === 0) return [];
    const client = this.txContext.getClient(this.db);
    return client.select().from(runbooksTable).where(inArray(runbooksTable.id, ids));
  }
}
