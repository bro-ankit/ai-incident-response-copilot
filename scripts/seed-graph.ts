import 'dotenv/config';

import neo4j from 'neo4j-driver';

import type { DependencyCriticality } from '../src/graph/graph.repository';

// Synthetic service dependency graph matching the services referenced in the seeded incidents
// (src/seed/incident-seed-data.ts) — service DEPENDS_ON dependsOn, with a criticality per edge:
// 'hard' = service cannot function without it; 'soft' = it degrades gracefully without it.
const DEPENDENCIES: { service: string; dependsOn: string; criticality: DependencyCriticality }[] = [
  { service: 'checkout-service', dependsOn: 'payments-api', criticality: 'hard' },
  { service: 'checkout-service', dependsOn: 'pricing-service', criticality: 'hard' },
  { service: 'payments-api', dependsOn: 'payment-gateway-adapter', criticality: 'hard' },
  { service: 'payments-api', dependsOn: 'postgres', criticality: 'hard' },
  { service: 'pricing-service', dependsOn: 'redis', criticality: 'soft' },
  { service: 'pricing-service', dependsOn: 'postgres', criticality: 'hard' },
  { service: 'refunds-service', dependsOn: 'payments-api', criticality: 'hard' },
  { service: 'refunds-service', dependsOn: 'postgres', criticality: 'hard' },
  { service: 'webhook-processor', dependsOn: 'kafka', criticality: 'hard' },
  { service: 'webhook-processor', dependsOn: 'payments-api', criticality: 'soft' },
  { service: 'payment-gateway-adapter', dependsOn: 'api-gateway', criticality: 'soft' },
];

async function seedGraph(): Promise<void> {
  const uri = process.env['NEO4J_URI'] ?? 'bolt://localhost:7687';
  const user = process.env['NEO4J_USER'] ?? 'neo4j';
  const password = process.env['NEO4J_PASSWORD'] ?? 'password12345';

  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  const session = driver.session();

  try {
    await session.run('CREATE CONSTRAINT service_name_unique IF NOT EXISTS FOR (s:Service) REQUIRE s.name IS UNIQUE');
    console.log('Schema ready: service_name_unique constraint');

    for (const { service, dependsOn, criticality } of DEPENDENCIES) {
      await session.run(
        `MERGE (a:Service {name: $service})
         MERGE (b:Service {name: $dependsOn})
         MERGE (a)-[r:DEPENDS_ON]->(b)
         SET r.criticality = $criticality`,
        { service, dependsOn, criticality },
      );
      console.log(`Seeded: ${service} -[DEPENDS_ON {criticality: ${criticality}}]-> ${dependsOn}`);
    }
  } finally {
    await session.close();
    await driver.close();
  }
}

seedGraph()
  .then(() => {
    console.log('Graph seeding complete.');
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error('Graph seeding failed:', error);
    process.exit(1);
  });
