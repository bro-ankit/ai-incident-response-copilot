import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type { Driver } from 'neo4j-driver';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { NEO4J_DRIVER } from './graph.constants';

const MAX_BLAST_RADIUS_HOPS = 3;
const MAX_PATH_HOPS = 10;

export type DependencyCriticality = 'hard' | 'soft';

export type AffectedService = {
  name: string;
  criticality: DependencyCriticality;
};

@Injectable()
export class GraphRepository implements OnModuleDestroy {
  constructor(
    @InjectPinoLogger(GraphRepository.name) private readonly logger: PinoLogger,
    @Inject(NEO4J_DRIVER) private readonly driver: Driver,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.driver.close();
  }

  async upsertDependency(service: string, dependsOn: string, criticality: DependencyCriticality): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        `MERGE (a:Service {name: $service})
         MERGE (b:Service {name: $dependsOn})
         MERGE (a)-[r:DEPENDS_ON]->(b)
         SET r.criticality = $criticality`,
        { service, dependsOn, criticality },
      );
    } finally {
      await session.close();
    }
  }

  async blastRadius(serviceName: string): Promise<AffectedService[]> {
    this.logger.debug({ serviceName }, 'Computing blast radius');
    const session = this.driver.session();
    try {
      const result = await session.run<AffectedService>(
        `MATCH path = (affected:Service)-[:DEPENDS_ON*1..${MAX_BLAST_RADIUS_HOPS}]->(target:Service {name: $serviceName})
         WITH affected, ALL(r IN relationships(path) WHERE r.criticality = 'hard') AS pathIsHard
         WITH affected, MAX(CASE WHEN pathIsHard THEN 1 ELSE 0 END) AS anyHardPath
         RETURN affected.name AS name, (CASE WHEN anyHardPath = 1 THEN 'hard' ELSE 'soft' END) AS criticality`,
        { serviceName },
      );
      return result.records.map((record) => ({
        name: record.get('name'),
        criticality: record.get('criticality'),
      }));
    } finally {
      await session.close();
    }
  }

  async dependencyPath(from: string, to: string): Promise<string[] | null> {
    this.logger.debug({ from, to }, 'Computing dependency path');
    const session = this.driver.session();
    try {
      const result = await session.run<{ path: string[] }>(
        `MATCH path = shortestPath((a:Service {name: $from})-[:DEPENDS_ON*1..${MAX_PATH_HOPS}]->(b:Service {name: $to}))
         RETURN [n IN nodes(path) | n.name] AS path`,
        { from, to },
      );
      const record = result.records[0];
      return record ? record.get('path') : null;
    } finally {
      await session.close();
    }
  }
}
