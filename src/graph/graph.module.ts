import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import neo4j, { type Driver } from 'neo4j-driver';

import { ENV_VARIABLES } from '../constants/env.constants';
import { NEO4J_DRIVER } from './graph.constants';
import { GraphRepository } from './graph.repository';
import { GraphMigrationsService } from './graph-migrations.service';

const NEO4J_DRIVER_PROVIDER = {
  provide: NEO4J_DRIVER,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Driver => {
    const uri = config.getOrThrow<string>(ENV_VARIABLES.GRAPH.URI);
    const user = config.getOrThrow<string>(ENV_VARIABLES.GRAPH.USER);
    const password = config.getOrThrow<string>(ENV_VARIABLES.GRAPH.PASSWORD);
    return neo4j.driver(uri, neo4j.auth.basic(user, password));
  },
};

// Not @Global() — unlike Postgres/Gemini, only the composition roots that actually use the graph
// should import this and pay for a Neo4j connection.
@Module({
  providers: [NEO4J_DRIVER_PROVIDER, GraphRepository, GraphMigrationsService],
  exports: [NEO4J_DRIVER, GraphRepository],
})
export class GraphModule {}
