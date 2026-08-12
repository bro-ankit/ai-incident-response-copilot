import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable } from '@nestjs/common';

import type { MetricOperation } from '../schema/metric-logs.schema';

export type AiUsageStore = { operation: MetricOperation };

@Injectable()
export class AiUsageContextService {
  private readonly als = new AsyncLocalStorage<AiUsageStore>();

  async *runIterable<T>(store: AiUsageStore, source: AsyncIterable<T>): AsyncIterable<T> {
    const iterator = source[Symbol.asyncIterator]();
    while (true) {
      const { value, done } = await this.run(store, () => iterator.next());
      if (done) return;
      yield value;
    }
  }

  run<T>(store: AiUsageStore, fn: () => T): T {
    return this.als.run(store, fn);
  }

  getOperation(): MetricOperation | undefined {
    return this.als.getStore()?.operation;
  }
}
