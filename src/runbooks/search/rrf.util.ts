export class RrfUtil {
  private static readonly RRF_K = 60;

  static fuse<T extends string>(vectorIds: T[], lexicalIds: T[]): { id: T; score: number }[] {
    const scores: Record<string, number> = {};

    this.accumulate(vectorIds, scores);
    this.accumulate(lexicalIds, scores);

    return Object.entries(scores)
      .map(([id, score]) => ({ id: id as T, score }))
      .sort((a, b) => b.score - a.score);
  }

  private static accumulate(ids: string[], scores: Record<string, number>) {
    return ids.forEach((id, index) => {
      scores[id] = (scores[id] ?? 0) + 1 / (this.RRF_K + index + 1);
    });
  }
}
