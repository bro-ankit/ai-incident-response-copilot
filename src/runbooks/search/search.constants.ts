export const SEARCH_DEFAULTS = {
  TOP_K: 3,
  // How many candidates each retriever fetches before RRF fusion
  CANDIDATE_K: 20,
  // How many RRF-fused candidates get hydrated and passed to the cross-encoder reranker
  RERANK_POOL_K: 10,
} as const;
