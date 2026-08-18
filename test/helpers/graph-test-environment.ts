import type { Provider } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Neo4jContainer, type StartedNeo4jContainer } from '@testcontainers/neo4j';
import neo4j, { type Driver } from 'neo4j-driver';
import { LoggerModule } from 'nestjs-pino';

import { NEO4J_DRIVER } from '../../src/graph/graph.constants';
import { GraphMigrationsService } from '../../src/graph/graph-migrations.service';

const NEO4J_IMAGE = 'neo4j:5-community';
const PASSWORD = 'password12345';

export class GraphTestEnvironment {
  private container!: StartedNeo4jContainer;

  module!: TestingModule;
  driver!: Driver;

  async start(providers: Provider[] = []): Promise<void> {
    this.container = await new Neo4jContainer(NEO4J_IMAGE).withPassword(PASSWORD).start();

    this.driver = neo4j.driver(this.container.getBoltUri(), neo4j.auth.basic(this.container.getUsername(), PASSWORD));

    this.module = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ pinoHttp: { level: 'silent' } })],
      providers: [{ provide: NEO4J_DRIVER, useValue: this.driver }, GraphMigrationsService, ...providers],
    }).compile();

    await this.module.init();
  }

  async clear(): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run('MATCH (n) DETACH DELETE n');
    } finally {
      await session.close();
    }
  }

  async stop(): Promise<void> {
    await this.module.close();
    await this.container.stop();
  }
}
