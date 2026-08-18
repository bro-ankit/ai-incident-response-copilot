import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { Driver, ManagedTransaction } from 'neo4j-driver';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { NEO4J_DRIVER } from './graph.constants';
import { GRAPH_MIGRATIONS } from './graph-migrations';

const LOCK_STALE_AFTER_MS = 30_000;
const LOCK_RETRY_DELAY_MS = 500;
const LOCK_MAX_ATTEMPTS = 60;

@Injectable()
export class GraphMigrationsService implements OnModuleInit {
  constructor(
    @InjectPinoLogger(GraphMigrationsService.name) private readonly logger: PinoLogger,
    @Inject(NEO4J_DRIVER) private readonly driver: Driver,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.info('Running graph migrations...');

    await this.ensureLockConstraint();
    await this.ensureLockNode();
    await this.acquireLock();
    try {
      await this.applyPendingMigrations();
    } finally {
      await this.releaseLock();
    }

    this.logger.info('Graph migrations complete.');
  }

  private async ensureLockConstraint(): Promise<void> {
    const session = this.driver.session();
    try {
      await session.executeWrite((tx) =>
        tx.run(
          'CREATE CONSTRAINT graph_migration_lock_unique IF NOT EXISTS FOR (l:_GraphMigrationLock) REQUIRE l.id IS UNIQUE',
        ),
      );
    } finally {
      await session.close();
    }
  }

  private async ensureLockNode(): Promise<void> {
    const session = this.driver.session();
    try {
      await session.executeWrite((tx) =>
        tx.run('MERGE (l:_GraphMigrationLock {id: 1}) ON CREATE SET l.active = false'),
      );
    } finally {
      await session.close();
    }
  }

  private async acquireLock(): Promise<void> {
    for (let attempt = 0; attempt < LOCK_MAX_ATTEMPTS; attempt++) {
      const session = this.driver.session();
      try {
        const acquired = await session.executeWrite(async (tx: ManagedTransaction) => {
          const result = await tx.run(
            `MATCH (l:_GraphMigrationLock {id: 1})
             SET l.id = l.id
             WITH l
             WHERE l.active = false OR l.lastAcquiredAt < datetime() - duration({milliseconds: $staleAfterMs})
             SET l.active = true, l.lastAcquiredAt = datetime()
             RETURN l`,
            { staleAfterMs: LOCK_STALE_AFTER_MS },
          );
          return result.records.length > 0;
        });
        if (acquired) return;
      } finally {
        await session.close();
      }
      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_DELAY_MS));
    }
    throw new Error('Timed out waiting for the graph migration lock');
  }

  private async releaseLock(): Promise<void> {
    const session = this.driver.session();
    try {
      await session.executeWrite((tx) => tx.run('MATCH (l:_GraphMigrationLock {id: 1}) SET l.active = false'));
    } finally {
      await session.close();
    }
  }

  private async applyPendingMigrations(): Promise<void> {
    for (const migration of GRAPH_MIGRATIONS) {
      if (await this.isApplied(migration.id)) continue;

      const applySession = this.driver.session();
      try {
        await applySession.executeWrite((tx) => tx.run(migration.cypher));
      } finally {
        await applySession.close();
      }

      const recordSession = this.driver.session();
      try {
        await recordSession.executeWrite((tx) =>
          tx.run('CREATE (:_GraphMigration {id: $id, appliedAt: datetime()})', { id: migration.id }),
        );
      } finally {
        await recordSession.close();
      }

      this.logger.info({ id: migration.id }, 'Applied graph migration');
    }
  }

  private async isApplied(id: string): Promise<boolean> {
    const session = this.driver.session();
    try {
      return await session.executeRead(async (tx: ManagedTransaction) => {
        const result = await tx.run('MATCH (m:_GraphMigration {id: $id}) RETURN m', { id });
        return result.records.length > 0;
      });
    } finally {
      await session.close();
    }
  }
}
