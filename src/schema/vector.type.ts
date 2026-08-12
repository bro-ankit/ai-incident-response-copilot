import { customType } from 'drizzle-orm/pg-core';

export function toVectorDriverString(value: number[]): string {
  return `[${value.join(',')}]`;
}

export function parseVectorString(raw: string): number[] {
  const inner = raw.slice(1, -1);
  if (!inner) return [];
  const parts = inner.split(',');
  const result = new Array<number>(parts.length);
  for (let i = 0; i < parts.length; i++) {
    result[i] = +parts[i];
  }
  return result;
}

export type VectorColumnConfig = {
  dataType: () => string;
  toDriver: (value: number[]) => string;
  fromDriver: (value: string) => number[];
};

export function buildVectorConfig(dimensions: number): VectorColumnConfig {
  return {
    dataType: () => `vector(${dimensions})`,
    toDriver: toVectorDriverString,
    fromDriver: parseVectorString,
  };
}

export function createVectorType(dimensions: number) {
  return customType<{ data: number[]; driverData: string }>(buildVectorConfig(dimensions));
}

export const GEMINI_EMBEDDING_DIMENSIONS = 768 as const;

export const getGeminiVector = createVectorType(GEMINI_EMBEDDING_DIMENSIONS);
