import { RrfUtil } from '../../../src/runbooks/search/rrf.util';

const RRF_K = 60;
const rrfScore = (rank: number) => 1 / (RRF_K + rank + 1);

describe('RrfUtil Unit Test', () => {
  describe('Given fuse', () => {
    describe('When called with two disjoint candidate lists', () => {
      test('Then each id keeps the single-list RRF score matching its rank in that list', () => {
        const result = RrfUtil.fuse(['a', 'b'], ['c']);
        const byId = Object.fromEntries(result.map((r) => [r.id, r.score]));

        expect(byId).toEqual({
          a: rrfScore(0),
          b: rrfScore(1),
          c: rrfScore(0),
        });
      });
    });

    describe('When a candidate appears in both lists', () => {
      test('Then its score is the sum of both contributions, outranking a candidate found by only one retriever', () => {
        const result = RrfUtil.fuse(['vector-only', 'shared'], ['shared']);

        const shared = result.find((r) => r.id === 'shared')!;
        const vectorOnly = result.find((r) => r.id === 'vector-only')!;

        expect(shared.score).toBeCloseTo(rrfScore(1) + rrfScore(0));
        expect(vectorOnly.score).toBeCloseTo(rrfScore(0));
        expect(result[0]!.id).toBe('shared');
      });
    });

    describe('When one retriever returns no results', () => {
      test('Then it degrades gracefully to ranking by the other retriever alone', () => {
        const result = RrfUtil.fuse([], ['x', 'y']);

        expect(result).toEqual([
          { id: 'x', score: rrfScore(0) },
          { id: 'y', score: rrfScore(1) },
        ]);
      });
    });

    describe('When both retrievers return no results', () => {
      test('Then it returns an empty list', () => {
        expect(RrfUtil.fuse([], [])).toEqual([]);
      });
    });

    describe('When results are returned', () => {
      test('Then they are sorted by descending fused score', () => {
        const result = RrfUtil.fuse(['first', 'second', 'third'], []);

        const scores = result.map((r) => r.score);
        expect(scores).toEqual([...scores].sort((a, b) => b - a));
      });
    });
  });
});
