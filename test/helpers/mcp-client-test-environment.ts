import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import type { McpClient } from '../../src/mcp/client/mcp-client';

const PGVECTOR_IMAGE = 'pgvector/pgvector:pg16';

export class McpClientTestEnvironment {
  private container!: StartedPostgreSqlContainer;
  private originalEnv!: Record<string, string | undefined>;

  async start(client: McpClient): Promise<void> {
    this.container = await new PostgreSqlContainer(PGVECTOR_IMAGE).withReuse().start();

    this.originalEnv = { ...process.env };
    Object.assign(process.env, {
      DB_HOST: this.container.getHost(),
      DB_PORT: String(this.container.getPort()),
      DB_USER: this.container.getUsername(),
      DB_PASSWORD: this.container.getPassword(),
      DB_NAME: this.container.getDatabase(),
      GEMINI_API_KEY: process.env['GEMINI_API_KEY'] || 'test-key',
    });

    await client.onModuleInit();
  }

  async stop(client: McpClient): Promise<void> {
    await client.onModuleDestroy();
    process.env = this.originalEnv;
    await this.container.stop();
  }
}
