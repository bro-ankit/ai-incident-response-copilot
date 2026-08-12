export type SeedRunbook = {
  readonly key: string;
  readonly title: string;
  readonly content: string;
  readonly services: string[];
};

export const SEED_RUNBOOKS: SeedRunbook[] = [
  {
    key: 'unbounded-in-memory-cache-oom',
    title: 'Runbook: Service OOMKilled / CrashLoopBackOff after a deploy',
    content:
      'Symptoms: pods restart every few minutes shortly after a deploy, kubelet logs show OOMKilled (exit code 137), heap/memory usage climbs steadily with no plateau instead of settling after warmup. ' +
      'Diagnosis: check whether the most recent deploy added a new in-memory cache, buffer, or map that is never evicted (idempotency keys, dedupe sets, request caches). Compare heap_used trend before/after the deploy — a steady, unbounded climb (not a sawtooth from normal GC) points to a leak, not load. ' +
      'Root cause pattern: a newly introduced in-memory data structure has no TTL, max-size bound, or eviction policy, so it grows without limit until it exceeds the container memory limit. ' +
      'Remediation: add an eviction policy (LRU with a max size, or a TTL) to the offending cache; as an immediate mitigation, raise the memory limit and/or roll back the deploy while a permanent fix ships; add a memory-usage alert with headroom before OOM to catch this earlier next time.',
    services: ['payments-api', 'checkout-service'],
  },
  {
    key: 'db-connection-pool-exhaustion',
    title: 'Runbook: 504 Gateway Timeout / connection pool exhaustion under load',
    content:
      'Symptoms: 504s or connection-acquire-timeout errors rise sharply during a traffic spike, Postgres logs show "remaining connection slots are reserved", pool waiting count climbs while active connections stay pinned at the configured max. ' +
      'Diagnosis: check the connection pool max size against expected peak concurrency, and check for slow queries (Postgres slow query log or pg_stat_statements) that hold connections far longer than typical — a slow, unindexed query multiplies the effective load on the pool. Look for sequential scans on large tables in the query plan. ' +
      'Root cause pattern: pool size was never tuned for peak traffic (flash sales, marketing pushes), and/or a missing index turns a fast query into a slow one that monopolizes connections. ' +
      'Remediation: add the missing index; increase pool size with headroom for peak concurrency; add a statement_timeout so one slow query cannot indefinitely starve the pool; load-test before the next known traffic spike.',
    services: ['checkout-service', 'postgres'],
  },
  {
    key: 'upstream-cascade-no-circuit-breaker',
    title: 'Runbook: Upstream latency spike cascading through the request chain',
    content:
      'Symptoms: p99 latency on outbound calls to a specific external dependency jumps far above baseline with no local deploy or config change; callers of the affected service start timing out too, and the failure spreads to their callers in turn. ' +
      "Diagnosis: check the upstream provider's status page for an ongoing incident. Check whether the calling service has a circuit breaker or timeout budget configured for that dependency — if thread pool / connection pool usage on the adapter service is maxed out while it keeps dispatching new requests into a known-slow upstream, that confirms no breaker is in place. " +
      'Root cause pattern: a third-party dependency degrades, and the absence of a circuit breaker or bounded timeout means the calling service keeps sending traffic into it, exhausting its own resources and propagating the failure to its own callers. ' +
      'Remediation: add a circuit breaker (open after N consecutive failures, half-open retry) and a request timeout budget on the adapter; once open, fail fast or fall back instead of queuing; this is a config/resilience gap, not something fixable by scaling.',
    services: ['payment-gateway-adapter', 'checkout-service'],
  },
  {
    key: 'consumer-lag-throughput-deficit',
    title: 'Runbook: Kafka consumer lag growing steadily (not spiking)',
    content:
      'Symptoms: consumer lag on a topic climbs monotonically over tens of minutes rather than spiking and recovering; downstream effects (e.g. delayed notifications, delayed webhook delivery) show up only after lag has been building for a while. ' +
      'Diagnosis: a steady, sustained climb in lag (not a sawtooth) means consumer throughput is below producer rate, not a transient blip. Check active consumer count against partition count — fewer active consumers than partitions caps available parallelism. Check per-message processing time before/after any recent deploy to that consumer, especially library upgrades touching the hot path (crypto, serialization, validation). ' +
      'Root cause pattern: either the consumer group is under-provisioned relative to partition count, or a recent change made per-message processing slower, or both compounding together. ' +
      'Remediation: scale consumers up to at least partition count; profile and fix the slowed-down code path; add a consumer-lag alert with a slope-based threshold (rate of growth), not just an absolute value, so a slow leak like this pages before it becomes a customer-visible delay.',
    services: ['webhook-processor', 'kafka'],
  },
  {
    key: 'missing-required-config-crashloop',
    title: 'Runbook: Deployment stuck at 0 healthy replicas after a config change',
    content:
      "Symptoms: every pod in the deployment crash-loops immediately after a config/ConfigMap rollout, with 0/N replicas ever reaching ready; the same fatal error appears in every pod's log at startup, not intermittently. " +
      'Diagnosis: 100% of replicas failing identically and immediately (not a subset, not after some uptime) is the signature of a startup-time failure, not a runtime or load issue — check what changed in the most recent config/ConfigMap rollout at the same timestamp the incident began. Read the exact fatal log line; services that validate required env vars at startup will name the missing variable directly. ' +
      'Root cause pattern: a required environment variable or config key was removed or renamed in a config rollout, and the service correctly fails fast on startup rather than running in a broken state. ' +
      'Remediation: restore the missing config value and re-roll; going forward, add a pre-deploy validation step (schema-check the ConfigMap against what the service requires) so this is caught before rollout, not after 0 replicas go ready.',
    services: ['refunds-service'],
  },
  {
    key: 'cache-eviction-thundering-herd',
    title: 'Runbook: Database CPU spike after a cache eviction event',
    content:
      'Symptoms: database CPU and connection count spike sharply and stay elevated, cache hit rate drops suddenly (not gradually) at the same time, read replica lag increases. ' +
      "Diagnosis: correlate the timing precisely — a sharp, simultaneous drop in cache hit rate and rise in DB load points to a mass cache eviction or expiry, not organic growth in read traffic. Check the cache's maxmemory/eviction logs for a large eviction batch, and check whether the evicted keys share a fixed TTL set at the same warm-up time (all expiring together) rather than staggered TTLs. " +
      'Root cause pattern: a large, synchronized set of cache keys (same fixed TTL, or evicted together under memory pressure) all miss at once, and every one of those requests falls through to the database simultaneously — a thundering herd. ' +
      'Remediation: stagger TTLs with jitter so keys do not expire in lockstep; consider request coalescing/locking so concurrent misses for the same key only hit the DB once; size the cache with enough headroom that eviction under normal load is rare; add an alert on cache hit-rate drop, not just DB CPU, so this is caught at the cause rather than the symptom.',
    services: ['pricing-service', 'redis'],
  },
  {
    key: 'tls-certificate-expiry',
    title: 'Runbook: TLS handshake failures after certificate expiry',
    content:
      'Symptoms: clients suddenly cannot establish TLS connections to a service; errors mention certificate expired, unknown CA, or handshake failure; the failure is total and starts at an exact timestamp rather than ramping up. ' +
      'Diagnosis: check the certificate expiry date on the affected endpoint (openssl s_client or your certificate manager dashboard) against the incident start time — an exact-timestamp cutover to total failure is the signature of an expired cert, not a code or infra issue. ' +
      'Root cause pattern: automated certificate renewal failed silently (expired credentials for the ACME/CA client, a renewal job that stopped running, DNS validation failing) and nobody caught it before the old cert expired. ' +
      'Remediation: issue and deploy a new certificate immediately; fix the renewal automation and add a certificate-expiry alert at 30/14/7 days out so this never again reaches a hard outage.',
    services: ['api-gateway'],
  },
  {
    key: 'disk-pressure-pod-eviction',
    title: 'Runbook: Pods evicted due to node disk pressure',
    content:
      'Symptoms: pods are evicted (not OOMKilled) with a DiskPressure node condition, kubelet logs mention garbage collecting images or ephemeral-storage limit exceeded, evictions cluster on specific nodes rather than being cluster-wide. ' +
      'Diagnosis: check node disk usage and the DiskPressure condition on affected nodes; check for runaway log files, unbounded temp file writes, or container image sprawl on those specific nodes. ' +
      'Root cause pattern: a node ran low on ephemeral storage, often from unrotated logs or a workload writing large temp files without cleanup, triggering kubelet eviction of pods to reclaim space. ' +
      "Remediation: set/fix log rotation and temp-file cleanup on the offending workload; set ephemeral-storage requests/limits on pods so the scheduler avoids overcommitting a node's disk; add node disk-usage alerting well before the eviction threshold.",
    services: ['platform'],
  },
];
