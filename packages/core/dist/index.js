/*
 * =====================================================================
 * @freelanceos/core Workspace API Boundary & Architectural Governance
 * =====================================================================
 *
 * [CURRENT IMPLEMENTATION STATE]
 * This package acts as the core business logic and domain layer boundary.
 * It is currently a skeleton workspace shell containing NO business logic,
 * use-cases, validators, DTOs, or domain aggregates. It is entirely
 * dependency-free to protect domain isolation.
 *
 * 1. Domain Layering Model:
 *    - Application Layer:
 *      * Responsibility: Coordinates execution processes, maps DTO boundaries,
 *        and resolves transactions.
 *    - Enterprise Domain Layer (Core):
 *      * Responsibility: Business entities, rules, invariants, and value objects.
 *    - Repository Contracts (Ports):
 *      * Responsibility: Interfaces defining data persistence schemas.
 *    - Infrastructure / Adapter Layer:
 *      * Responsibility: Specific adapter implementations (Drizzle repos,
 *        BullMQ queue workers, Stripe clients, HTTP route controllers).
 *    - External Services / Engines:
 *      * Responsibility: Relational engines (Postgres), cache stores (Redis),
 *        and API vendors (OpenAI).
 *
 *    *Constraint*: Lower layers must NEVER import or depend on higher layers.
 *
 * 2. Dependency Matrix:
 *    - Allowed Imports:
 *      * Outgoing: None (strictly dependency-free).
 *    - Forbidden Imports:
 *      * Outgoing: Core must NEVER import from `@freelanceos/db`, `@freelanceos/config`,
 *        or any `apps/*` files.
 *      * Circular Prevention: Banning reverse imports prevents reference cycles.
 *
 * 3. Framework Independence Policy (Permanent Architectural Rule):
 *    Core must NEVER directly import or depend on:
 *    * Web/App frameworks (Fastify, Next.js)
 *    * ORM libraries (Drizzle ORM)
 *    * Task queue brokers (BullMQ)
 *    * API SDKs (OpenAI SDK, Stripe SDK)
 *    * Database drivers (Postgres, Redis clients)
 *    * Browser/HTTP request APIs
 *
 * 4. Dependency Inversion Policy (Permanent Engineering Rule):
 *    - Core defines the abstractions (Repository contracts, port interfaces).
 *    - Infrastructure implements these contracts (Adapters).
 *    - Dependency direction must always point inward toward the Core.
 *
 * 5. Public API Governance Policy:
 *    - Exposes: Stable business contracts, domain abstractions, and public
 *      architectural contracts.
 *    - Hides: Framework configurations, infrastructure details, and database drivers.
 *
 * 6. Future Extension Governance:
 *    - Domain Models:        [Future Responsibility - Not Implemented]
 *    - Repository Contracts: [Future Responsibility - Not Implemented]
 *    - Use Cases:            [Future Responsibility - Not Implemented]
 *    - Value Objects:        [Future Responsibility - Not Implemented]
 *    - Domain Events:        [Future Responsibility - Not Implemented]
 *    - Policies:             [Future Responsibility - Not Implemented]
 *    - Specifications:       [Future Responsibility - Not Implemented]
 *    - Factories:            [Future Responsibility - Not Implemented]
 */
export { isValidEmailFormat, normalizeEmailAddress, validatePasswordStrength, } from "./validation.js";
export { Client, CLIENT_CREATED, CLIENT_UPDATED, CLIENT_ARCHIVED, CLIENT_REACTIVATED, } from "./client.js";
export { TimelineEntry, ClientTimeline, TIMELINE_ENTRY_APPENDED, TIMELINE_ARCHIVED, } from "./timeline.js";
export { Money, Payment, PAYMENT_CREATED, PAYMENT_AUTHORIZED, PAYMENT_CAPTURED, PAYMENT_COMPLETED, PAYMENT_FAILED, PAYMENT_CANCELLED, } from "./payment.js";
export { ProjectMetadata, ProjectVisibility, Project, PROJECT_CREATED, PROJECT_UPDATED, PROJECT_STARTED, PROJECT_PAUSED, PROJECT_COMPLETED, PROJECT_CANCELLED, PROJECT_ARCHIVED, } from "./project.js";
export { AttachmentMetadata, AttachmentVisibility, Attachment, ATTACHMENT_CREATED, ATTACHMENT_UPDATED, ATTACHMENT_AVAILABLE, ATTACHMENT_ARCHIVED, ATTACHMENT_DELETED, } from "./attachment.js";
export { RepositoryMetadata, RepositoryVisibility, Repository, REPOSITORY_REGISTERED, REPOSITORY_UPDATED, REPOSITORY_AVAILABLE, REPOSITORY_ARCHIVED, REPOSITORY_REMOVED, } from "./repository.js";
export { AiRequestMetadata, AiRequest, AI_REQUEST_RECEIVED, AI_REQUEST_ACCEPTED, AI_REQUEST_ORCHESTRATING, AI_REQUEST_COMPLETED, AI_REQUEST_FAILED, } from "./ai-gateway.js";
export { LogicalVisibilityClassification, PromptDefinition, PromptMetadata, PromptVersion, Prompt, PROMPT_REGISTERED, PROMPT_UPDATED, PROMPT_PUBLISHED, PROMPT_DEPRECATED, PROMPT_ARCHIVED, } from "./prompt-registry.js";
export { ContextBlueprint, ContextMetadata, ContextAssemblyRule, ContextSourceReference, Context, CONTEXT_REGISTERED, CONTEXT_VALIDATED, CONTEXT_PUBLISHED, CONTEXT_ARCHIVED, } from "./context-builder.js";
export { MemoryMetadata, MemoryRetentionRule, MemoryEntry, MemorySnapshot, Memory, MEMORY_VALIDATED, MEMORY_PUBLISHED, MEMORY_ARCHIVED, } from "./memory.js";
export { EmbeddingReference, EmbeddingSourceReference, EmbeddingVector, EmbeddingSpace, EmbeddingFingerprint, EmbeddingSnapshot, Embedding, EMBEDDING_REGISTERED, EMBEDDING_VALIDATED, EMBEDDING_AVAILABLE, EMBEDDING_ARCHIVED, } from "./embedding.js";
export { PromptCompositionReference, PromptDefinitionReference, ContextSpecificationReference, MemoryReference, EmbeddingReference as PromptEmbeddingReference, CompositionStrategyReference, PromptComposition, CompositionMetadata, CompositionStrategy, CompositionFingerprint, CompositionSnapshot, PromptBuilder, PROMPT_COMPOSITION_REGISTERED, PROMPT_COMPOSED, PROMPT_COMPOSITION_VALIDATED, PROMPT_COMPOSITION_PUBLISHED, PROMPT_COMPOSITION_ARCHIVED, } from "./prompt-builder.js";
export { PolicyReference, PolicyDefinition, PolicyMetadata, PolicyRuleSet, PolicyEvaluationResult, DecisionFingerprint, PolicySnapshot, Policy, POLICY_REGISTERED, POLICY_VALIDATED, POLICY_PUBLISHED, POLICY_ARCHIVED, POLICY_EVALUATED, } from "./policy.js";
export { SummaryContent, SummaryScope, SummaryMetadata, SummaryClassification, SummaryFingerprint, SummaryReference, SummarySnapshot, ClientSummary, CLIENT_SUMMARY_REGISTERED, CLIENT_SUMMARY_GENERATED, CLIENT_SUMMARY_VALIDATED, CLIENT_SUMMARY_PUBLISHED, CLIENT_SUMMARY_ARCHIVED, } from "./client-summary.js";
export { ImportMetadata, ImportScope, ImportFingerprint, ImportReference, ConversationReference, SourceClassification, ConversationImportSnapshot, ConversationImport, CONVERSATION_IMPORT_REGISTERED, CONVERSATION_IMPORT_VALIDATED, CONVERSATION_IMPORT_COMPLETED, CONVERSATION_IMPORT_ARCHIVED, } from "./conversation-import.js";
export { InsightContent, InsightClassification, InsightConfidence, InsightSourceReference, InsightMetadata, InsightFingerprint, InsightReference, ClientInsightSnapshot, ClientInsight, CLIENT_INSIGHT_IDENTIFIED, CLIENT_INSIGHT_VALIDATED, CLIENT_INSIGHT_PUBLISHED, CLIENT_INSIGHT_ARCHIVED, } from "./client-insight.js";
export { MemoryUpdateReference, TargetMemoryReference, MemoryUpdateSpecification, MemoryUpdateClassification, MemoryUpdateSourceReference, MemoryUpdatePriority, MemoryUpdateFingerprint, ClientMemoryUpdateSnapshot, ClientMemoryUpdate, CLIENT_MEMORY_UPDATE_PROPOSED, CLIENT_MEMORY_UPDATE_VALIDATED, CLIENT_MEMORY_UPDATE_APPROVED, CLIENT_MEMORY_UPDATE_APPLIED, CLIENT_MEMORY_UPDATE_REJECTED, CLIENT_MEMORY_UPDATE_ARCHIVED, } from "./client-memory-update.js";
export { QueryEmbedding, SearchScope, SearchFilter, SimilarityMetric, SimilarityScore, SearchLimit, SearchCandidate, VectorSearchResult, VectorSearchRequest, } from "./vector-search.js";
export { FusionStrategy, FusionWeight, FusionScore, LexicalCandidate, HybridSearchCandidate, HybridSearchResult, HybridSearchRequest, } from "./hybrid-search.js";
export { RankingCriteria, RankingPolicy, RankingScore, RankingCandidate, RankedItem, RankingResult, RankingRequest, RankingService, } from "./ranking.js";
export { ScopeExtractionLifecycle, ScopeFactType, ScopeFactValue, ScopeSourceReference, ScopeEvidence, ScopeFact, ScopeExtractionSnapshot, ScopeExtraction, ScopeExtractionDraftedEvent, ScopeExtractionCompletedEvent, ScopeExtractionCommittedEvent, ScopeExtractionArchivedEvent, } from "./scope-extraction.js";
export { ScopeRuleType, ScopeRule, ScopeRuleSet, ScopeDecision, ScopeDecisionValue, ScopeRuleViolation, ScopeEvaluation, ScopeEvaluationCompletedEvent, ScopeRulesEngine, } from "./scope-rules.js";
export { ConfidenceScore, ConfidenceLevel, ConfidenceReason, ConfidenceEvidence, ConfidenceAssessment, ConfidenceAssessedEvent, } from "./confidence.js";
export { PricingAmount, PricingCurrency, PricingComponent, PricingBreakdown, PricingAssessment, } from "./pricing.js";
export { GenerationReference, GenerationConstraint, GenerationMetadata, GenerationContent, GenerationRequest, GenerationResult, ReplyGenerationSnapshot, ReplyGeneration, REPLY_GENERATION_DRAFTED, REPLY_GENERATION_REQUESTED, REPLY_GENERATION_COMPLETED, REPLY_GENERATION_ARCHIVED, } from "./reply-generation.js";
export { RewriteInstruction, RewriteRequest, RewriteResult, Revision, ReplyRewriteSnapshot, ReplyRewrite, REPLY_REWRITE_DRAFTED, REPLY_REWRITE_REQUESTED, REPLY_REWRITE_COMPLETED, REPLY_REWRITE_ARCHIVED, } from "./reply-rewrite.js";
export { ToneProfile, ToneRequest, ToneResult, ReplyToneAdjustmentSnapshot, ReplyToneAdjustment, REPLY_TONE_DRAFTED, REPLY_TONE_REQUESTED, REPLY_TONE_ADJUSTED, REPLY_TONE_ARCHIVED, } from "./reply-tone.js";
export { GrammarProfile, GrammarRequest, GrammarResult, ReplyGrammarCorrectionSnapshot, ReplyGrammarCorrection, REPLY_GRAMMAR_DRAFTED, REPLY_GRAMMAR_REQUESTED, REPLY_GRAMMAR_CORRECTED, REPLY_GRAMMAR_ARCHIVED, } from "./reply-grammar.js";
export { JobSource, JobExternalIdentity, JobImportProvenance, JobRawPayload, JobImportFingerprint, JobImportSnapshot, JobImport, JOB_IMPORT_RECEIVED, JOB_IMPORTED, JOB_IMPORT_ARCHIVED, } from "./job-import.js";
export { JobSourceReference, CanonicalBudget, CanonicalLocation, CanonicalJob, JobNormalizedFingerprint, JobNormalizationSnapshot, JobNormalization, JOB_NORMALIZATION_CREATED, JOB_NORMALIZED, JOB_NORMALIZATION_ARCHIVED, } from "./job-normalization.js";
export { ModelReference, JobVectorFingerprint, JobEmbeddingSnapshot, JOB_EMBEDDING_CREATED, JOB_EMBEDDING_GENERATED, JOB_EMBEDDING_ARCHIVED, JobEmbedding, } from "./job-embedding.js";
export { freezeMatchSignals, calculateCosineSimilarity, matchExperience, matchBudget, matchJobType, matchLocation, JobMatchSnapshot, JOB_MATCH_CREATED, JOB_MATCH_EVALUATED, JOB_MATCH_ARCHIVED, JobMatch, } from "./job-match.js";
export { ScoreWeightProfile, ScoringConfiguration, SignalContribution, ScoreBreakdown, ScoreFingerprint, roundToPrecision, JobMatchScoreSnapshot, JOB_MATCH_SCORE_CREATED, JOB_MATCH_SCORE_CALCULATED, JOB_MATCH_SCORE_ARCHIVED, JobMatchScore, } from "./job-match-score.js";
export { JobMatchRankingPolicy, RankedMatch, RankingFingerprint, buildCandidateSetIdentity, JobMatchRankingSnapshot, JOB_MATCH_RANKING_CREATED, JOB_MATCH_RANKING_COMPLETED, JOB_MATCH_RANKING_ARCHIVED, JobMatchRanking, } from "./job-match-ranking.js";
export { ExplanationPolicy, ExplanationFact, ExplanationModel, ExplanationFingerprint, buildEvidenceFactFingerprint, JobMatchExplanationSnapshot, JOB_MATCH_EXPLANATION_CREATED, JOB_MATCH_EXPLANATION_GENERATED, JOB_MATCH_EXPLANATION_ARCHIVED, JobMatchExplanation, } from "./job-match-explanation.js";
export { MemoryCacheStore, CacheKeyBuilder, JobMatchCacheManager } from "./job-match-cache.js";
export { JobMatchWorkItemSnapshot, JobMatchWorkItem } from "./job-match-work-item.js";
export { ValidationError, TenantError, VersionError, DomainError, CancellationError, TransientInfrastructureError, PermanentInfrastructureError, JobMatchWorker, } from "./job-match-worker.js";
// Trial and Pricing/Plan exports
export { calculateTrialExpiration, TrialEligibility, TrialGrant, TrialService, } from "./trial.js";
export { PricingRegionResolver, Plan, PlanCatalog, EU_COUNTRIES, } from "./plan.js";
//# sourceMappingURL=index.js.map