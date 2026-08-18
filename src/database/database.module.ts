import { Global, Inject, Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import * as path from 'path';
import { Pool } from 'pg';

import { ENV_VARIABLES } from '../constants/env.constants';
import * as schema from '../schema';
import { AdvisoryLockKeyUtil } from './advisory-lock-key.util';
import { DRIZZLE_DB, PG_POOL } from './database.constants';
import { DrizzleTransactionContext } from './drizzle-transaction.context';
import { DrizzleTransactionService } from './drizzle-transaction.service';

export type DrizzleDb = NodePgDatabase<typeof schema>;

const MIGRATION_LOCK_KEY = AdvisoryLockKeyUtil.fromName('ai-incident-response-copilot:database-migrations');

const PG_POOL_PROVIDER = {
  provide: PG_POOL,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Pool => {
    const dbHost = config.getOrThrow<string>(ENV_VARIABLES.DATABASE.host);
    const dbPort = parseInt(config.getOrThrow<string>(ENV_VARIABLES.DATABASE.port), 10);
    const dbUser = config.getOrThrow<string>(ENV_VARIABLES.DATABASE.user);
    const dbPassword = config.getOrThrow<string>(ENV_VARIABLES.DATABASE.password);
    const dbName = config.getOrThrow<string>(ENV_VARIABLES.DATABASE.database);
    const dbPoolSize = parseInt(config.getOrThrow<string>(ENV_VARIABLES.DATABASE.poolSize), 10);

    return new Pool({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      max: dbPoolSize,
    });
  },
};

const DRIZZLE_PROVIDER = {
  provide: DRIZZLE_DB,
  inject: [PG_POOL],
  useFactory: (pool: Pool): DrizzleDb => drizzle(pool, { schema }),
};

@Global()
@Module({
  providers: [PG_POOL_PROVIDER, DRIZZLE_PROVIDER, DrizzleTransactionContext, DrizzleTransactionService],
  exports: [DRIZZLE_DB, DrizzleTransactionContext, DrizzleTransactionService],
})
export class DatabaseModule implements OnModuleInit {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    @Inject(PG_POOL) private readonly pool: Pool,
    @InjectPinoLogger(DatabaseModule.name) private readonly logger: PinoLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.info('Running database migrations...');

    const lockClient = await this.pool.connect();
    try {
      await lockClient.query('SELECT pg_advisory_lock($1, $2)', MIGRATION_LOCK_KEY);
      await migrate(this.db, { migrationsFolder: path.join(process.cwd(), 'db/migrations') });
    } finally {
      await lockClient.query('SELECT pg_advisory_unlock($1, $2)', MIGRATION_LOCK_KEY);
      lockClient.release();
    }

    this.logger.info('Migrations complete.');
  }
}
