import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import type { McpClient } from '../../src/mcp/client/mcp-client';

const PGVECTOR_IMAGE = 'pgvector/pgvector:pg16';

export class McpClientTestEnvironment {
  private pgContainer!: StartedPostgreSqlContainer;
  private originalEnv!: Record<string, string | undefined>;

  async start(client: McpClient): Promise<void> {
    this.pgContainer = await new PostgreSqlContainer(PGVECTOR_IMAGE).withReuse().start();

    this.originalEnv = { ...process.env };
    Object.assign(process.env, {
      DB_HOST: this.pgContainer.getHost(),
      DB_PORT: String(this.pgContainer.getPort()),
      DB_USER: this.pgContainer.getUsername(),
      DB_PASSWORD: this.pgContainer.getPassword(),
      DB_NAME: this.pgContainer.getDatabase(),
      GEMINI_API_KEY: process.env['GEMINI_API_KEY'] || 'test-key',
    });

    await client.onModuleInit();
  }

  async stop(client: McpClient): Promise<void> {
    await client.onModuleDestroy();
    process.env = this.originalEnv;
    await this.pgContainer.stop();
  }
}
