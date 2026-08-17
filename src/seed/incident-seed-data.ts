import type { LogLevel } from '../schema/incident-logs.schema';
import type { IncidentSeverity } from '../schema/incidents.schema';

export type SeedLog = {
  readonly offsetMs: number;
  readonly level: LogLevel;
  readonly service: string;
  readonly message: string;
};

export type SeedIncident = {
  readonly key: string;
  readonly isGoldenCase: boolean;
  readonly title: string;
  readonly description: string;
  readonly service: string;
  readonly severity: IncidentSeverity;
  readonly occurredAt: string;
  readonly groundTruthRootCause: string;
  readonly groundTruthExplanation: string;
  readonly logs: SeedLog[];
};

export const SEED_INCIDENTS: SeedIncident[] = [
  {
    key: 'payments-oom-crashloop',
    isGoldenCase: true,
    title: 'Payments API pods crash-looping after v2.14.0 deploy',
    description:
      'Alert: PaymentsAPIHighRestartCount. payments-api pods in prod are restarting every 2-3 minutes since the 14:02 UTC deploy. Checkout success rate down 40%.',
    service: 'payments-api',
    severity: 'SEV1',
    occurredAt: '2026-08-05T14:02:00Z',
    groundTruthRootCause:
      'Memory leak in the new idempotency-key cache introduced in v2.14.0 — cache has no TTL/eviction, so pods exceed their memory limit and get OOMKilled.',
    groundTruthExplanation:
      'Logs show steadily climbing heap usage after the 14:02 deploy with no corresponding drop, followed by OOMKilled kubelet events and CrashLoopBackOff. The in-memory idempotency cache added in v2.14.0 has no eviction policy, so it grows unbounded under normal traffic until it exceeds the container memory limit.',
    logs: [
      { offsetMs: 0, level: 'INFO', service: 'payments-api', message: 'Deployment v2.14.0 rollout started' },
      {
        offsetMs: 15000,
        level: 'INFO',
        service: 'payments-api',
        message: 'Deployment v2.14.0 rollout complete, 6/6 pods ready',
      },
      { offsetMs: 60000, level: 'INFO', service: 'payments-api', message: 'heap_used=412MB heap_limit=1024MB' },
      { offsetMs: 300000, level: 'INFO', service: 'payments-api', message: 'heap_used=598MB heap_limit=1024MB' },
      {
        offsetMs: 600000,
        level: 'WARN',
        service: 'payments-api',
        message: 'heap_used=781MB heap_limit=1024MB, GC pause 340ms',
      },
      {
        offsetMs: 720000,
        level: 'WARN',
        service: 'payments-api',
        message: 'idempotency_cache_size=482113 entries, no eviction configured',
      },
      {
        offsetMs: 900000,
        level: 'ERROR',
        service: 'payments-api',
        message: 'heap_used=1011MB heap_limit=1024MB, GC pause 1120ms',
      },
      {
        offsetMs: 905000,
        level: 'FATAL',
        service: 'kubelet',
        message: 'pod payments-api-7f9c6b8-x2j4l OOMKilled (exit code 137)',
      },
      {
        offsetMs: 906000,
        level: 'WARN',
        service: 'kubelet',
        message: 'pod payments-api-7f9c6b8-x2j4l entering CrashLoopBackOff',
      },
      {
        offsetMs: 960000,
        level: 'FATAL',
        service: 'kubelet',
        message: 'pod payments-api-7f9c6b8-m9p1q OOMKilled (exit code 137)',
      },
      {
        offsetMs: 961000,
        level: 'WARN',
        service: 'kubelet',
        message: 'pod payments-api-7f9c6b8-m9p1q entering CrashLoopBackOff',
      },
      {
        offsetMs: 1020000,
        level: 'ERROR',
        service: 'checkout-service',
        message: 'POST /payments/charge timed out after 5000ms, upstream payments-api unavailable',
      },
      {
        offsetMs: 1080000,
        level: 'FATAL',
        service: 'kubelet',
        message: 'pod payments-api-7f9c6b8-k7d2n OOMKilled (exit code 137)',
      },
      {
        offsetMs: 1140000,
        level: 'ERROR',
        service: 'checkout-service',
        message: 'checkout success rate dropped to 58% over last 5m window',
      },
      {
        offsetMs: 1200000,
        level: 'WARN',
        service: 'payments-api',
        message: '3/6 pods in CrashLoopBackOff, restart_count=14',
      },
    ],
  },
  {
    key: 'checkout-db-pool-exhaustion',
    isGoldenCase: true,
    title: 'Checkout API returning 504s during flash sale traffic',
    description:
      'Alert: HighLatency5xx checkout-service. 504 Gateway Timeout rate at 22% since traffic ramp began at 09:15 UTC for the flash sale.',
    service: 'checkout-service',
    severity: 'SEV1',
    occurredAt: '2026-08-06T09:15:00Z',
    groundTruthRootCause:
      'Postgres connection pool (max 20) is exhausted under flash-sale load because a slow, unindexed query on the orders table holds connections for 8-12s each, starving other requests.',
    groundTruthExplanation:
      'Logs show connection pool wait times rising in lockstep with traffic, "remaining connection slots reserved" errors from Postgres, and a recurring slow query against orders filtered by customer_email with a sequential scan noted in the query planner log. The pool size was never tuned for flash-sale peak concurrency, and the slow query multiplies the effect by holding connections far longer than typical requests.',
    logs: [
      {
        offsetMs: 0,
        level: 'INFO',
        service: 'checkout-service',
        message: 'Traffic ramp detected: RPS 120 -> 640 over 3 minutes',
      },
      { offsetMs: 60000, level: 'WARN', service: 'checkout-service', message: 'db_pool: active=20 idle=0 waiting=4' },
      { offsetMs: 120000, level: 'WARN', service: 'checkout-service', message: 'db_pool: active=20 idle=0 waiting=17' },
      {
        offsetMs: 125000,
        level: 'WARN',
        service: 'postgres',
        message:
          'slow query 8421ms: SELECT * FROM orders WHERE customer_email = $1 (seq scan, no index on customer_email)',
      },
      {
        offsetMs: 180000,
        level: 'ERROR',
        service: 'checkout-service',
        message: 'db_pool: connection acquire timed out after 5000ms',
      },
      {
        offsetMs: 181000,
        level: 'ERROR',
        service: 'postgres',
        message: 'FATAL: remaining connection slots are reserved for non-replication superuser connections',
      },
      {
        offsetMs: 240000,
        level: 'WARN',
        service: 'postgres',
        message:
          'slow query 11938ms: SELECT * FROM orders WHERE customer_email = $1 (seq scan, no index on customer_email)',
      },
      {
        offsetMs: 300000,
        level: 'ERROR',
        service: 'checkout-service',
        message: 'GET /checkout/cart 504 Gateway Timeout, db_pool waiting=31',
      },
      { offsetMs: 360000, level: 'ERROR', service: 'checkout-service', message: '5xx rate over last 5m: 22.4%' },
      {
        offsetMs: 420000,
        level: 'WARN',
        service: 'postgres',
        message:
          'slow query 9204ms: SELECT * FROM orders WHERE customer_email = $1 (seq scan, no index on customer_email)',
      },
      {
        offsetMs: 480000,
        level: 'ERROR',
        service: 'checkout-service',
        message: 'POST /checkout/place-order 504 Gateway Timeout, db_pool waiting=28',
      },
      {
        offsetMs: 540000,
        level: 'INFO',
        service: 'checkout-service',
        message: 'db_pool config: max=20 min=5 idleTimeoutMs=30000 (unchanged since 2025-11-02)',
      },
    ],
  },
  {
    key: 'gateway-timeout-cascade',
    isGoldenCase: true,
    title: 'Checkout latency spike traced to payment gateway provider outage',
    description:
      'Alert: UpstreamLatencyHigh payment-gateway-adapter. p99 latency for outbound charge calls jumped from 300ms to 14s starting 03:47 UTC, no corresponding deploy.',
    service: 'payment-gateway-adapter',
    severity: 'SEV2',
    occurredAt: '2026-08-07T03:47:00Z',
    groundTruthRootCause:
      'Third-party payment gateway (Stripe-compatible provider) is degraded upstream; payment-gateway-adapter has no circuit breaker or timeout budget, so slow upstream calls exhaust its own thread pool and cascade the failure to checkout-service.',
    groundTruthExplanation:
      'Logs show outbound calls to the external gateway domain taking 10-14s (versus a normal ~300ms baseline) with no local deploy or config change around the incident start. The adapter has no circuit breaker configured, so it keeps sending new requests into the degraded upstream, its own thread pool fills up, and callers (checkout-service) start timing out on calls to the adapter itself, spreading the failure.',
    logs: [
      {
        offsetMs: 0,
        level: 'INFO',
        service: 'payment-gateway-adapter',
        message: 'outbound charge call latency p99=312ms (baseline)',
      },
      {
        offsetMs: 60000,
        level: 'WARN',
        service: 'payment-gateway-adapter',
        message: 'outbound charge call to api.gatewayprovider.com took 10421ms',
      },
      {
        offsetMs: 90000,
        level: 'WARN',
        service: 'payment-gateway-adapter',
        message: 'outbound charge call to api.gatewayprovider.com took 12884ms',
      },
      {
        offsetMs: 100000,
        level: 'INFO',
        service: 'status-page-poller',
        message: 'gatewayprovider.com status page reports "investigating elevated error rates"',
      },
      {
        offsetMs: 120000,
        level: 'WARN',
        service: 'payment-gateway-adapter',
        message: 'thread_pool: active=64 max=64 queue_depth=112',
      },
      {
        offsetMs: 150000,
        level: 'ERROR',
        service: 'payment-gateway-adapter',
        message: 'no circuit breaker configured for gatewayprovider client, continuing to dispatch',
      },
      {
        offsetMs: 180000,
        level: 'ERROR',
        service: 'checkout-service',
        message: 'POST /internal/charge to payment-gateway-adapter timed out after 8000ms',
      },
      {
        offsetMs: 210000,
        level: 'ERROR',
        service: 'payment-gateway-adapter',
        message: 'outbound charge call to api.gatewayprovider.com took 14209ms',
      },
      {
        offsetMs: 240000,
        level: 'ERROR',
        service: 'checkout-service',
        message: 'circuit_breaker[payment-gateway-adapter] state=OPEN after 12 consecutive failures',
      },
      {
        offsetMs: 300000,
        level: 'ERROR',
        service: 'checkout-service',
        message: 'checkout error rate 31% over last 5m, root calls failing at payment-gateway-adapter boundary',
      },
    ],
  },
  {
    key: 'webhook-consumer-lag',
    isGoldenCase: true,
    title: 'Payment confirmation webhooks delayed by up to 40 minutes',
    description:
      'Alert: KafkaConsumerLagHigh webhook-processor. Merchants reporting order confirmations arriving 20-40 minutes late since ~11:00 UTC.',
    service: 'webhook-processor',
    severity: 'SEV2',
    occurredAt: '2026-08-08T11:00:00Z',
    groundTruthRootCause:
      'webhook-processor consumer group is under-provisioned (2 consumers for a 12-partition topic) and a recent schema change made downstream signature verification 6x slower per message, so consumer throughput fell below producer rate and lag grew unbounded.',
    groundTruthExplanation:
      'Consumer lag climbs steadily and monotonically rather than spiking, which points to a sustained throughput deficit, not a transient blip. Logs show per-message processing time increased sharply right after the webhook-signing-lib upgrade, and only 2 of 12 partitions have an active consumer, so available parallelism was already capped before the slowdown made it worse.',
    logs: [
      {
        offsetMs: 0,
        level: 'INFO',
        service: 'webhook-processor',
        message: 'deployed webhook-signing-lib v3.2.0 (HMAC verification rewrite)',
      },
      {
        offsetMs: 60000,
        level: 'INFO',
        service: 'webhook-processor',
        message: 'consumer_group=webhook-processors partitions=12 active_consumers=2',
      },
      {
        offsetMs: 120000,
        level: 'WARN',
        service: 'webhook-processor',
        message: 'avg processing time per message: 340ms (was 55ms before v3.2.0)',
      },
      {
        offsetMs: 300000,
        level: 'WARN',
        service: 'kafka',
        message: 'consumer_lag topic=payment-events group=webhook-processors lag=8400',
      },
      {
        offsetMs: 600000,
        level: 'WARN',
        service: 'kafka',
        message: 'consumer_lag topic=payment-events group=webhook-processors lag=19200',
      },
      {
        offsetMs: 900000,
        level: 'ERROR',
        service: 'kafka',
        message: 'consumer_lag topic=payment-events group=webhook-processors lag=31500',
      },
      {
        offsetMs: 1200000,
        level: 'ERROR',
        service: 'webhook-processor',
        message: 'oldest unprocessed message age=1840s',
      },
      {
        offsetMs: 1500000,
        level: 'ERROR',
        service: 'merchant-notifications',
        message: '14 merchants reported delayed order confirmation emails via support',
      },
      {
        offsetMs: 1800000,
        level: 'ERROR',
        service: 'kafka',
        message: 'consumer_lag topic=payment-events group=webhook-processors lag=44700',
      },
      {
        offsetMs: 1810000,
        level: 'WARN',
        service: 'webhook-processor',
        message: 'consumer_group=webhook-processors partitions=12 active_consumers=2 (unchanged)',
      },
    ],
  },
  {
    key: 'config-missing-env-var',
    isGoldenCase: true,
    title: 'Refunds service failing to start after config rollout',
    description:
      'Alert: DeploymentFailed refunds-service. All 4 pods stuck in CrashLoopBackOff since the 16:20 UTC config rollout, zero healthy replicas.',
    service: 'refunds-service',
    severity: 'SEV1',
    occurredAt: '2026-08-09T16:20:00Z',
    groundTruthRootCause:
      'The 16:20 config rollout removed the LEDGER_SERVICE_URL environment variable from the refunds-service ConfigMap; the service fails a startup validation check for this required var and exits immediately, so every pod crash-loops with zero healthy replicas.',
    groundTruthExplanation:
      'Every pod log shows the identical fatal startup error citing the missing LEDGER_SERVICE_URL variable, immediately followed by process exit — this is a deterministic startup-time failure affecting 100% of replicas, not a runtime or load-related issue, which points directly at the config change deployed at the same timestamp the incident began.',
    logs: [
      {
        offsetMs: 0,
        level: 'INFO',
        service: 'refunds-service',
        message: 'ConfigMap refunds-service-config updated (rollout config-v48)',
      },
      {
        offsetMs: 10000,
        level: 'FATAL',
        service: 'refunds-service',
        message: 'startup validation failed: required env var LEDGER_SERVICE_URL is not set',
      },
      {
        offsetMs: 10500,
        level: 'WARN',
        service: 'kubelet',
        message: 'pod refunds-service-6c8d9-a1b2 CrashLoopBackOff, restart_count=1',
      },
      {
        offsetMs: 40000,
        level: 'FATAL',
        service: 'refunds-service',
        message: 'startup validation failed: required env var LEDGER_SERVICE_URL is not set',
      },
      {
        offsetMs: 40500,
        level: 'WARN',
        service: 'kubelet',
        message: 'pod refunds-service-6c8d9-c3d4 CrashLoopBackOff, restart_count=1',
      },
      {
        offsetMs: 70000,
        level: 'FATAL',
        service: 'refunds-service',
        message: 'startup validation failed: required env var LEDGER_SERVICE_URL is not set',
      },
      {
        offsetMs: 100000,
        level: 'ERROR',
        service: 'refunds-service',
        message: 'deployment refunds-service: 0/4 replicas ready',
      },
      {
        offsetMs: 160000,
        level: 'ERROR',
        service: 'refund-scheduler',
        message: 'POST /refunds/process to refunds-service failed: connection refused, no healthy endpoints',
      },
      {
        offsetMs: 220000,
        level: 'ERROR',
        service: 'refunds-service',
        message: 'deployment refunds-service: 0/4 replicas ready, restart_count avg=6',
      },
    ],
  },
  {
    key: 'cache-thundering-herd',
    isGoldenCase: true,
    title: 'Product pricing DB overloaded after Redis cache eviction spike',
    description:
      'Alert: DatabaseCPUHigh pricing-db. CPU at 98% and read replicas lagging since 07:10 UTC, correlated with a Redis maxmemory eviction event.',
    service: 'pricing-service',
    severity: 'SEV2',
    occurredAt: '2026-08-09T07:10:00Z',
    groundTruthRootCause:
      'Redis hit its maxmemory limit and evicted the entire pricing cache key set at once (no staggered TTLs), causing a thundering herd of cache-miss requests to hit pricing-db directly and saturate its CPU.',
    groundTruthExplanation:
      'The timeline shows a single Redis eviction event immediately preceding a sharp, sustained rise in both cache miss rate and pricing-db CPU, rather than a gradual increase — consistent with a large batch of keys expiring or being evicted together (all pricing keys were seeded with the same fixed TTL) and every subsequent request falling through to the database at once.',
    logs: [
      {
        offsetMs: 0,
        level: 'WARN',
        service: 'redis',
        message: 'maxmemory limit reached (4096MB), evicting keys (policy=allkeys-lru)',
      },
      {
        offsetMs: 5000,
        level: 'WARN',
        service: 'redis',
        message: 'evicted 182340 keys in eviction cycle, prefix=pricing:* dominant',
      },
      { offsetMs: 15000, level: 'WARN', service: 'pricing-service', message: 'cache_hit_rate dropped from 96% to 11%' },
      { offsetMs: 30000, level: 'ERROR', service: 'pricing-db', message: 'cpu_usage=91% active_connections=180' },
      { offsetMs: 60000, level: 'ERROR', service: 'pricing-db', message: 'cpu_usage=98% active_connections=200 (max)' },
      { offsetMs: 90000, level: 'WARN', service: 'pricing-db', message: 'read replica pricing-db-replica-1 lag=42s' },
      {
        offsetMs: 120000,
        level: 'ERROR',
        service: 'pricing-service',
        message: 'GET /pricing/quote p99 latency 4200ms (baseline 80ms)',
      },
      {
        offsetMs: 150000,
        level: 'INFO',
        service: 'pricing-service',
        message: 'cache key TTL config: all pricing:* keys use fixed ttl=3600s set at cache warm time',
      },
      {
        offsetMs: 180000,
        level: 'ERROR',
        service: 'pricing-db',
        message: 'cpu_usage=97% active_connections=200 (max), query queue depth=340',
      },
    ],
  },
];
