import { AdvisoryLockKeyUtil } from '../../src/database/advisory-lock-key.util';

describe('AdvisoryLockKeyUtil Unit Test', () => {
  describe('Given fromName', () => {
    describe('When called twice with the same name', () => {
      test('Then it returns the same key both times', () => {
        const first = AdvisoryLockKeyUtil.fromName('ai-incident-response-copilot:database-migrations');
        const second = AdvisoryLockKeyUtil.fromName('ai-incident-response-copilot:database-migrations');

        expect(first).toEqual(second);
      });
    });

    describe('When called with two different names', () => {
      test('Then it returns different keys', () => {
        const a = AdvisoryLockKeyUtil.fromName('ai-incident-response-copilot:database-migrations');
        const b = AdvisoryLockKeyUtil.fromName('some-other-app:some-other-lock');

        expect(a).not.toEqual(b);
      });
    });

    describe('When called with any name', () => {
      test('Then both returned values fit in a signed 32-bit integer, as Postgres advisory_lock(int, int) requires', () => {
        const [namespace, id] = AdvisoryLockKeyUtil.fromName('ai-incident-response-copilot:database-migrations');

        expect(Number.isInteger(namespace)).toBe(true);
        expect(namespace).toBeGreaterThanOrEqual(-(2 ** 31));
        expect(namespace).toBeLessThanOrEqual(2 ** 31 - 1);

        expect(Number.isInteger(id)).toBe(true);
        expect(id).toBeGreaterThanOrEqual(-(2 ** 31));
        expect(id).toBeLessThanOrEqual(2 ** 31 - 1);
      });
    });
  });
});
