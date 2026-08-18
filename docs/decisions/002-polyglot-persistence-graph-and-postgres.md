# ADR-002: Polyglot Persistence — Postgres for Business Data, Neo4j for Relationship Data

**Status:** Accepted
**Date:** 2026-08-18

## Context

This service now writes to two databases: Postgres (incidents, runbooks, eval runs) and Neo4j
(service dependency edges, queried by `GraphRepository.blastRadius`/`dependencyPath`). Adding a
second storage technology to one service is worth an explicit decision, not an assumption — "one
service, one database" is a real principle worth respecting, so it needs to be clear which rule this
is and isn't violating, and what happens if the two stores disagree.

## Decision

### "One service, one database" is about cross-service coupling, not a per-service technology count

The principle exists to stop independently-deployed services from silently coupling through a shared
schema — service A can't safely change a table's shape if service B also reads it directly, so each
service should own its own datastore. That constraint is about _service boundaries_, not about how
many storage engines a single service is allowed to use internally. A service using Postgres and
Redis, or Postgres and Elasticsearch, for different data shapes within its own boundary is normal
polyglot persistence, not a violation — this is the same category.

### Neo4j is the sole source of truth for dependency-graph data; Postgres does not duplicate it

There is no `service_dependencies` table in Postgres. The `DEPENDS_ON` edges and their criticality
live only in Neo4j, populated by `scripts/seed-graph.ts` (and, longer-term, whatever process
maintains a real service catalog — see Consequences). This isn't two copies of the same data that
need syncing; it's one dataset that only ever existed in the store suited to its access pattern
(multi-hop traversal), same as embeddings only ever existing in Postgres/pgvector and never being
duplicated into Neo4j.

### The two stores are linked by a soft, ungoverned reference — deliberately

`incidents.service` (a plain Postgres `text` column) and `Service.name` (a Neo4j node property) are
expected to use the same string, but nothing enforces that: no foreign key, no cross-database
constraint, no distributed transaction. This is a deliberate choice, not an oversight — Postgres and
Neo4j can't participate in a single ACID transaction, so real referential integrity across them would
require either a distributed-transaction protocol (real complexity for a link that's read-only and
low-stakes) or an event-driven sync process keeping a shadow copy consistent (real infrastructure for
a service dependency graph that changes on the order of deploys, not requests).

Instead, the actual consequence of drift is handled at the read path: if an incident references a
service with no corresponding graph node (never seeded, typo'd, or a newly-added service not yet
wired into the catalog), `GraphRepository.blastRadius` returns an empty array — not an error —
and `RemediationAgent` renders that as "no other services depend on X" rather than failing the whole
remediation proposal. The system is designed so a missing/stale graph edge degrades the _quality_ of
one section of a proposal, never the availability of the pipeline. Cheap eventual consistency plus
graceful degradation was chosen over expensive strong consistency for a relationship that's inherently
low-frequency-changing and non-transactional.

## Consequences

- No code path ever writes to both databases in one logical operation — incident/runbook writes
  and graph writes are fully independent, so there's no distributed-transaction problem to solve
  because none was created.
- Seeding the graph is a separate, explicit step (`pnpm graph:seed`) from seeding Postgres
  (`pnpm db:seed`) — the two datasets are provisioned independently on purpose, mirroring how they'll
  actually be maintained independently in a real deployment.
- A real production version of this system would likely populate the graph from a service-catalog
  source of truth (a Backstage-style git-based YAML catalog, or a CI-driven publish step on each
  service's deploy) rather than a one-off seed script — but that source would still write _into_
  Neo4j as the query-time store, not into Postgres, so this decision doesn't change under that
  evolution, only the _pipeline that populates_ Neo4j does.
- Any future feature that needs incident-service and graph-service data joined in one query (e.g.
  "list all golden-case incidents whose service has a hard dependent") can't do that as a single
  database query — it requires an application-level join across two round trips. Accepted, since no
  current feature needs that, and it's the honest cost of not merging two different data shapes into
  one store just to make one hypothetical query easier.
