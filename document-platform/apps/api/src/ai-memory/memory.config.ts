import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RankingWeights } from './memory-core';

function integer(config: ConfigService, key: string, fallback: number): number {
  const value = Number(config.get<string>(key));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function decimal(config: ConfigService, key: string, fallback: number): number {
  const value = Number(config.get<string>(key));
  return Number.isFinite(value) ? value : fallback;
}

function bool(config: ConfigService, key: string, fallback: boolean): boolean {
  const value = config.get<string>(key);
  return value === undefined ? fallback : value === 'true';
}

@Injectable()
export class MemoryConfigService {
  readonly enabled: boolean;
  readonly automaticExtractionEnabled: boolean;
  readonly sessionSummariesEnabled: boolean;
  readonly projectSummariesEnabled: boolean;
  readonly recentMessageLimit: number;
  readonly candidateLimit: number;
  readonly retrievedLimit: number;
  readonly minimumImportance: number;
  readonly duplicateThreshold: number;
  readonly conflictThreshold: number;
  readonly summaryMessageThreshold: number;
  readonly sessionSummaryMessageIncrement: number;
  readonly projectSummaryRefreshMinutes: number;
  readonly rawMessageRetentionDays: number;
  readonly sessionSummaryRetentionDays: number;
  readonly deletedMemoryRetentionDays: number;
  readonly budgets: {
    projectSummary: number;
    memories: number;
    sessionSummary: number;
    recentMessages: number;
    codeContext: number;
    total: number;
  };
  readonly weights: RankingWeights;

  constructor(config: ConfigService) {
    this.enabled = bool(config, 'MEMORY_ENABLED', true);
    this.automaticExtractionEnabled = bool(config, 'MEMORY_AUTO_EXTRACTION_ENABLED', true);
    this.sessionSummariesEnabled = bool(config, 'MEMORY_SESSION_SUMMARIES_ENABLED', true);
    this.projectSummariesEnabled = bool(config, 'MEMORY_PROJECT_SUMMARIES_ENABLED', true);
    this.recentMessageLimit = integer(config, 'MEMORY_RECENT_MESSAGE_LIMIT', 24);
    this.candidateLimit = integer(config, 'MEMORY_CANDIDATE_LIMIT', 200);
    this.retrievedLimit = integer(config, 'MEMORY_RETRIEVED_LIMIT', 12);
    this.minimumImportance = decimal(config, 'MEMORY_MINIMUM_IMPORTANCE', 0.55);
    this.duplicateThreshold = decimal(config, 'MEMORY_DUPLICATE_THRESHOLD', 0.88);
    this.conflictThreshold = decimal(config, 'MEMORY_CONFLICT_THRESHOLD', 0.72);
    this.summaryMessageThreshold = integer(config, 'MEMORY_SUMMARY_MESSAGE_THRESHOLD', 24);
    this.sessionSummaryMessageIncrement = integer(
      config,
      'MEMORY_SESSION_SUMMARY_MESSAGE_INCREMENT',
      12,
    );
    this.projectSummaryRefreshMinutes = integer(
      config,
      'MEMORY_PROJECT_SUMMARY_REFRESH_MINUTES',
      60,
    );
    this.rawMessageRetentionDays = integer(config, 'MEMORY_RAW_MESSAGE_RETENTION_DAYS', 90);
    this.sessionSummaryRetentionDays = integer(config, 'MEMORY_SESSION_SUMMARY_RETENTION_DAYS', 365);
    this.deletedMemoryRetentionDays = integer(config, 'MEMORY_DELETED_RETENTION_DAYS', 30);
    this.budgets = {
      projectSummary: integer(config, 'MEMORY_BUDGET_PROJECT_SUMMARY', 800),
      memories: integer(config, 'MEMORY_BUDGET_LONG_TERM', 2_000),
      sessionSummary: integer(config, 'MEMORY_BUDGET_SESSION_SUMMARY', 700),
      recentMessages: integer(config, 'MEMORY_BUDGET_RECENT_MESSAGES', 3_000),
      codeContext: integer(config, 'MEMORY_BUDGET_CODE_CONTEXT', 1_500),
      total: integer(config, 'MEMORY_BUDGET_TOTAL', 8_000),
    };
    this.weights = {
      semantic: decimal(config, 'MEMORY_WEIGHT_SEMANTIC', 0.45),
      importance: decimal(config, 'MEMORY_WEIGHT_IMPORTANCE', 0.2),
      task: decimal(config, 'MEMORY_WEIGHT_TASK', 0.15),
      recency: decimal(config, 'MEMORY_WEIGHT_RECENCY', 0.1),
      usefulness: decimal(config, 'MEMORY_WEIGHT_USEFULNESS', 0.05),
      pinned: decimal(config, 'MEMORY_WEIGHT_PINNED', 0.05),
    };
  }
}
