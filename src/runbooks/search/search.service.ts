import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { AI_CLIENT } from '../../ai/ai.constants';
import type { IAiClient } from '../../ai/ai.interface';
import { ENV_VARIABLES } from '../../constants/env.constants';
import { TrackAiUsage } from '../../metrics/track-ai-usage.decorator';
import { EMBEDDING_MODELS, type EmbeddingModel, type RunbookSelect } from '../../schema/runbooks.schema';
import { RunbooksRepository } from '../runbooks.repository';
import { RerankerService } from './reranker.service';
import { RrfUtil } from './rrf.util';
import { SEARCH_DEFAULTS } from './search.constants';

@Injectable()
export class SearchService {
  private readonly embeddingModel: EmbeddingModel;

  constructor(
    @InjectPinoLogger(SearchService.name) private readonly logger: PinoLogger,
    @Inject(AI_CLIENT) private readonly aiClient: IAiClient,
    private readonly runbooksRepository: RunbooksRepository,
    private readonly rerankerService: RerankerService,
    config: ConfigService,
  ) {
    const configured = config.get<string>(ENV_VARIABLES.GEMINI.EMBEDDING_MODEL, EMBEDDING_MODELS[0]);
    if (!EMBEDDING_MODELS.includes(configured as EmbeddingModel)) {
      throw new Error(
        `Unsupported GEMINI_EMBEDDING_MODEL "${configured}". Supported models: ${EMBEDDING_MODELS.join(', ')}. Add it to EMBEDDING_MODELS in runbooks.schema.ts first.`,
      );
    }
    this.embeddingModel = configured as EmbeddingModel;
  }

  @TrackAiUsage('EMBEDDING')
  async search(query: string): Promise<RunbookSelect[]> {
    this.logger.info({ query }, 'Hybrid runbook search request');

    const embedding = await this.aiClient.generateEmbedding(query);

    const [vectorIds, lexicalIds] = await Promise.all([
      this.runbooksRepository.findSimilarIds(embedding, SEARCH_DEFAULTS.CANDIDATE_K, this.embeddingModel),
      this.runbooksRepository.findByLexical(query, SEARCH_DEFAULTS.CANDIDATE_K),
    ]);

    this.logger.debug({ vectorCount: vectorIds.length, lexicalCount: lexicalIds.length }, 'Candidate sets');

    const fused = RrfUtil.fuse(vectorIds, lexicalIds);
    const poolIds = fused.slice(0, SEARCH_DEFAULTS.RERANK_POOL_K).map((r) => r.id);

    this.logger.debug({ poolIds }, 'RRF-fused rerank pool');

    if (poolIds.length === 0) return [];

    const pool = await this.runbooksRepository.findByIds(poolIds);
    const byId = new Map(pool.map((r) => [r.id, r]));

    const candidates = pool.map((r) => ({ id: r.id, text: `${r.title} ${r.content}` }));
    const reranked = await this.rerankerService.rerank(query, candidates);

    this.logger.info({ scores: reranked.slice(0, SEARCH_DEFAULTS.TOP_K) }, 'Cross-encoder rerank scores');

    return reranked.slice(0, SEARCH_DEFAULTS.TOP_K).flatMap((r) => {
      const runbook = byId.get(r.id);
      return runbook ? [runbook] : [];
    });
  }
}
