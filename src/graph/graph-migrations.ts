export type GraphMigration = {
  id: string;
  cypher: string;
};

export const GRAPH_MIGRATIONS: GraphMigration[] = [
  {
    id: '2026-08-17-01-service-name-unique',
    cypher: 'CREATE CONSTRAINT service_name_unique IF NOT EXISTS FOR (s:Service) REQUIRE s.name IS UNIQUE',
  },
];
