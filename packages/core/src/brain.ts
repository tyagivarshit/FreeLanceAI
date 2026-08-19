import type { PlanFeature } from "./plan.js";

type JsonPrimitive = string | number | boolean | null;
export type BrainJsonValue =
  | JsonPrimitive
  | BrainJsonValue[]
  | { readonly [key: string]: BrainJsonValue };

const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SECRET_KEY_PATTERN = /(password|secret|token|credential|apiKey|api_key|stripeSecret)/i;

function requireReference(value: string, label: string): string {
  if (!value || value.trim() === "") {
    throw new BrainDomainError("INVALID_REQUEST", `${label} is required.`);
  }
  const clean = value.trim();
  if (!REFERENCE_PATTERN.test(clean)) {
    throw new BrainDomainError("INVALID_REQUEST", `${label} has an invalid reference format.`);
  }
  return clean;
}

function cloneJsonValue<T extends BrainJsonValue | undefined>(value: T): T {
  if (value === undefined) {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function assertJsonSafe(value: unknown, label: string, seen = new WeakSet<object>()): void {
  if (value === undefined || typeof value === "function" || typeof value === "symbol") {
    throw new BrainDomainError("INVALID_REQUEST", `${label} must be JSON serializable.`);
  }
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Number.isNaN(value)) {
      throw new BrainDomainError("INVALID_REQUEST", `${label} contains a non-finite number.`);
    }
    return;
  }
  if (typeof value !== "object") {
    throw new BrainDomainError("INVALID_REQUEST", `${label} must be JSON serializable.`);
  }
  if (seen.has(value)) {
    throw new BrainDomainError("INVALID_REQUEST", `${label} must not contain circular references.`);
  }
  seen.add(value);
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      throw new BrainDomainError("INVALID_REQUEST", `${label} must not contain secret fields.`);
    }
    assertJsonSafe(nested, `${label}.${key}`, seen);
  }
  seen.delete(value);
}

function freezeJson<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      freezeJson(nested);
    }
  }
  return value;
}

export type BrainAnalysisType = "CLIENT_HEALTH" | "OPPORTUNITY_REVIEW" | "FOLLOW_UP_PRIORITIZATION";

export const SUPPORTED_BRAIN_ANALYSIS_TYPES: readonly BrainAnalysisType[] = [
  "CLIENT_HEALTH",
  "OPPORTUNITY_REVIEW",
  "FOLLOW_UP_PRIORITIZATION",
];

export function parseBrainAnalysisType(value: string): BrainAnalysisType {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, "_");
  if (!SUPPORTED_BRAIN_ANALYSIS_TYPES.includes(normalized as BrainAnalysisType)) {
    throw new BrainDomainError("UNSUPPORTED_ANALYSIS", `Unsupported Brain analysis type: ${value}`);
  }
  return normalized as BrainAnalysisType;
}

export type BrainFailureCode =
  | "INVALID_REQUEST"
  | "UNSUPPORTED_ANALYSIS"
  | "INSUFFICIENT_CONTEXT"
  | "UNAUTHORIZED_CONTEXT"
  | "ENTITLEMENT_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_UNAVAILABLE"
  | "MALFORMED_PROVIDER_OUTPUT"
  | "INTERNAL_FAILURE";

export class BrainDomainError extends Error {
  public readonly code: BrainFailureCode;
  public readonly publicMessage: string;
  public statusCode?: number | undefined;

  constructor(code: BrainFailureCode, publicMessage: string, statusCode?: number | undefined) {
    super(publicMessage);
    this.name = "BrainDomainError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.statusCode = statusCode;
  }

  public toFailure(): BrainFailure {
    return new BrainFailure({
      code: this.code,
      message: this.publicMessage,
      retryable: isRetryableBrainFailure(this.code),
    });
  }
}

export interface BrainFailureProperties {
  code: BrainFailureCode;
  message: string;
  retryable?: boolean;
}

export class BrainFailure {
  private readonly _code: BrainFailureCode;
  private readonly _message: string;
  private readonly _retryable: boolean;

  constructor(properties: BrainFailureProperties) {
    this._code = properties.code;
    this._message = properties.message?.trim() || "Brain analysis could not be completed.";
    this._retryable = properties.retryable ?? isRetryableBrainFailure(properties.code);
    Object.freeze(this);
  }

  get code(): BrainFailureCode {
    return this._code;
  }

  get message(): string {
    return this._message;
  }

  get retryable(): boolean {
    return this._retryable;
  }

  public toJSON(): BrainFailureProperties {
    return { code: this._code, message: this._message, retryable: this._retryable };
  }
}

export function isRetryableBrainFailure(code: BrainFailureCode): boolean {
  return (
    code === "ENTITLEMENT_UNAVAILABLE" ||
    code === "PROVIDER_TIMEOUT" ||
    code === "PROVIDER_UNAVAILABLE"
  );
}

export interface BrainScopeProperties {
  tenantId: string;
  ownerId: string;
  actorId: string;
}

export class BrainScope {
  private readonly _tenantId: string;
  private readonly _ownerId: string;
  private readonly _actorId: string;

  constructor(properties: BrainScopeProperties) {
    this._tenantId = requireReference(properties.tenantId, "Tenant ID");
    this._ownerId = requireReference(properties.ownerId, "Owner ID");
    this._actorId = requireReference(properties.actorId, "Actor ID");
    Object.freeze(this);
  }

  get tenantId(): string {
    return this._tenantId;
  }

  get ownerId(): string {
    return this._ownerId;
  }

  get actorId(): string {
    return this._actorId;
  }

  public matches(signal: ScopedBrainSignal): boolean {
    return signal.tenantId === this._tenantId && signal.ownerId === this._ownerId;
  }

  public toJSON(): BrainScopeProperties {
    return { tenantId: this._tenantId, ownerId: this._ownerId, actorId: this._actorId };
  }
}

export interface ScopedBrainSignal {
  readonly signalId: string;
  readonly tenantId: string;
  readonly ownerId: string;
}

export interface ClientSignalProperties extends ScopedBrainSignal {
  readonly clientId: string;
  readonly name?: string | undefined;
  readonly status?: string | undefined;
}

export interface JobSignalProperties extends ScopedBrainSignal {
  readonly jobId: string;
  readonly title?: string | undefined;
  readonly source?: string | undefined;
  readonly requiredSkills?: readonly string[] | undefined;
}

export interface MatchSignalProperties extends ScopedBrainSignal {
  readonly matchId: string;
  readonly jobId: string;
  readonly score?: number | undefined;
  readonly strengths?: readonly string[] | undefined;
  readonly risks?: readonly string[] | undefined;
}

export interface TimelineSignalProperties extends ScopedBrainSignal {
  readonly timelineId: string;
  readonly clientId?: string | undefined;
  readonly eventCount: number;
  readonly latestEventAt?: Date | undefined;
}

export interface BusinessSignalProperties extends ScopedBrainSignal {
  readonly metric: string;
  readonly value: number;
  readonly unit?: string | undefined;
}

export interface BrainContextProperties {
  scope: BrainScope;
  clients?: readonly ClientSignalProperties[];
  jobs?: readonly JobSignalProperties[];
  matches?: readonly MatchSignalProperties[];
  timelines?: readonly TimelineSignalProperties[];
  businessSignals?: readonly BusinessSignalProperties[];
}

export class BrainContext {
  private readonly _scope: BrainScope;
  private readonly _clients: readonly ClientSignalProperties[];
  private readonly _jobs: readonly JobSignalProperties[];
  private readonly _matches: readonly MatchSignalProperties[];
  private readonly _timelines: readonly TimelineSignalProperties[];
  private readonly _businessSignals: readonly BusinessSignalProperties[];

  constructor(properties: BrainContextProperties) {
    if (!properties.scope) {
      throw new BrainDomainError("INVALID_REQUEST", "Brain scope is required.");
    }
    this._scope = properties.scope;
    this._clients = Object.freeze(
      (properties.clients ?? []).map((s) => this.validateSignal(s, "client")),
    );
    this._jobs = Object.freeze((properties.jobs ?? []).map((s) => this.validateJobSignal(s)));
    this._matches = Object.freeze(
      (properties.matches ?? []).map((s) => this.validateMatchSignal(s)),
    );
    this._timelines = Object.freeze(
      (properties.timelines ?? []).map((s) => this.validateTimelineSignal(s)),
    );
    this._businessSignals = Object.freeze(
      (properties.businessSignals ?? []).map((s) => this.validateBusinessSignal(s)),
    );
    Object.freeze(this);
  }

  get scope(): BrainScope {
    return this._scope;
  }

  get clients(): readonly ClientSignalProperties[] {
    return [...this._clients];
  }

  get jobs(): readonly JobSignalProperties[] {
    return [...this._jobs];
  }

  get matches(): readonly MatchSignalProperties[] {
    return [...this._matches];
  }

  get timelines(): readonly TimelineSignalProperties[] {
    return [...this._timelines];
  }

  get businessSignals(): readonly BusinessSignalProperties[] {
    return [...this._businessSignals];
  }

  get signalCount(): number {
    return (
      this._clients.length +
      this._jobs.length +
      this._matches.length +
      this._timelines.length +
      this._businessSignals.length
    );
  }

  public ensureSufficientFor(analysisType: BrainAnalysisType): void {
    if (this.signalCount === 0) {
      throw new BrainDomainError(
        "INSUFFICIENT_CONTEXT",
        "Brain analysis requires authorized product context.",
      );
    }
    if (analysisType === "CLIENT_HEALTH" && this._clients.length === 0) {
      throw new BrainDomainError(
        "INSUFFICIENT_CONTEXT",
        "Client health analysis requires client signals.",
      );
    }
    if (analysisType === "OPPORTUNITY_REVIEW" && this._jobs.length === 0) {
      throw new BrainDomainError(
        "INSUFFICIENT_CONTEXT",
        "Opportunity review requires job signals.",
      );
    }
    if (analysisType === "FOLLOW_UP_PRIORITIZATION" && this._timelines.length === 0) {
      throw new BrainDomainError(
        "INSUFFICIENT_CONTEXT",
        "Follow-up prioritization requires timeline signals.",
      );
    }
  }

  public toJSON(): BrainContextProperties {
    return {
      scope: this._scope,
      clients: this._clients,
      jobs: this._jobs,
      matches: this._matches,
      timelines: this._timelines.map((signal) => ({
        ...signal,
        latestEventAt: signal.latestEventAt ? new Date(signal.latestEventAt.getTime()) : undefined,
      })),
      businessSignals: this._businessSignals,
    };
  }

  private validateSignal<T extends ScopedBrainSignal>(signal: T, label: string): T {
    requireReference(signal.signalId, `${label} signal ID`);
    if (!this._scope.matches(signal)) {
      throw new BrainDomainError(
        "UNAUTHORIZED_CONTEXT",
        "Brain context contains cross-owner or cross-tenant signals.",
      );
    }
    assertJsonSafe(signal, `${label} signal`);
    return freezeJson({ ...signal });
  }

  private validateJobSignal(signal: JobSignalProperties): JobSignalProperties {
    const clean = this.validateSignal(signal, "job");
    return freezeJson({
      ...clean,
      requiredSkills: Object.freeze([...(clean.requiredSkills ?? [])]),
    });
  }

  private validateMatchSignal(signal: MatchSignalProperties): MatchSignalProperties {
    if (
      signal.score !== undefined &&
      (!Number.isFinite(signal.score) || signal.score < 0 || signal.score > 1)
    ) {
      throw new BrainDomainError("INVALID_REQUEST", "Match score must be between 0 and 1.");
    }
    const clean = this.validateSignal(signal, "match");
    return freezeJson({
      ...clean,
      strengths: Object.freeze([...(clean.strengths ?? [])]),
      risks: Object.freeze([...(clean.risks ?? [])]),
    });
  }

  private validateTimelineSignal(signal: TimelineSignalProperties): TimelineSignalProperties {
    if (!Number.isInteger(signal.eventCount) || signal.eventCount < 0) {
      throw new BrainDomainError(
        "INVALID_REQUEST",
        "Timeline event count must be a non-negative integer.",
      );
    }
    const clean = this.validateSignal(signal, "timeline");
    return freezeJson({
      ...clean,
      latestEventAt: clean.latestEventAt ? new Date(clean.latestEventAt.getTime()) : undefined,
    });
  }

  private validateBusinessSignal(signal: BusinessSignalProperties): BusinessSignalProperties {
    if (!signal.metric || signal.metric.trim() === "") {
      throw new BrainDomainError("INVALID_REQUEST", "Business metric is required.");
    }
    if (!Number.isFinite(signal.value)) {
      throw new BrainDomainError("INVALID_REQUEST", "Business metric value must be finite.");
    }
    return this.validateSignal(signal, "business");
  }
}

export interface BrainRequestMetadataProperties {
  requestId: string;
  correlationId: string;
  requestedAt: Date;
  idempotencyKey?: string | undefined;
}

export class BrainRequestMetadata {
  private readonly _requestId: string;
  private readonly _correlationId: string;
  private readonly _requestedAt: Date;
  private readonly _idempotencyKey: string | undefined;

  constructor(properties: BrainRequestMetadataProperties) {
    this._requestId = requireReference(properties.requestId, "Request ID");
    this._correlationId = requireReference(properties.correlationId, "Correlation ID");
    this._requestedAt = new Date(properties.requestedAt.getTime());
    if (Number.isNaN(this._requestedAt.getTime())) {
      throw new BrainDomainError("INVALID_REQUEST", "Requested timestamp is invalid.");
    }
    this._idempotencyKey = properties.idempotencyKey
      ? requireReference(properties.idempotencyKey, "Idempotency key")
      : undefined;
    Object.freeze(this);
  }

  get requestId(): string {
    return this._requestId;
  }

  get correlationId(): string {
    return this._correlationId;
  }

  get requestedAt(): Date {
    return new Date(this._requestedAt.getTime());
  }

  get idempotencyKey(): string | undefined {
    return this._idempotencyKey;
  }

  public toJSON(): BrainRequestMetadataProperties {
    return {
      requestId: this._requestId,
      correlationId: this._correlationId,
      requestedAt: new Date(this._requestedAt.getTime()),
      idempotencyKey: this._idempotencyKey,
    };
  }
}

export interface BrainAnalysisConstraints {
  readonly maxRecommendations?: number;
  readonly maxInsights?: number;
  readonly responseFormat?: "structured";
}

export interface BrainAnalysisRequestProperties {
  analysisType: BrainAnalysisType | string;
  context: BrainContext;
  metadata: BrainRequestMetadata;
  constraints?: BrainAnalysisConstraints;
}

export class BrainAnalysisRequest {
  private readonly _analysisType: BrainAnalysisType;
  private readonly _context: BrainContext;
  private readonly _metadata: BrainRequestMetadata;
  private readonly _constraints: BrainAnalysisConstraints;

  constructor(properties: BrainAnalysisRequestProperties) {
    this._analysisType =
      typeof properties.analysisType === "string"
        ? parseBrainAnalysisType(properties.analysisType)
        : properties.analysisType;
    if (!properties.context) {
      throw new BrainDomainError("INVALID_REQUEST", "Brain context is required.");
    }
    if (!properties.metadata) {
      throw new BrainDomainError("INVALID_REQUEST", "Brain request metadata is required.");
    }
    this._context = properties.context;
    this._metadata = properties.metadata;
    this._constraints = this.validateConstraints(properties.constraints ?? {});
    this._context.ensureSufficientFor(this._analysisType);
    Object.freeze(this);
  }

  get analysisType(): BrainAnalysisType {
    return this._analysisType;
  }

  get context(): BrainContext {
    return this._context;
  }

  get metadata(): BrainRequestMetadata {
    return this._metadata;
  }

  get constraints(): BrainAnalysisConstraints {
    return { ...this._constraints };
  }

  public toJSON(): BrainAnalysisRequestProperties {
    return {
      analysisType: this._analysisType,
      context: this._context,
      metadata: this._metadata,
      constraints: this._constraints,
    };
  }

  private validateConstraints(constraints: BrainAnalysisConstraints): BrainAnalysisConstraints {
    const maxRecommendations = constraints.maxRecommendations ?? 5;
    const maxInsights = constraints.maxInsights ?? 5;
    if (
      !Number.isInteger(maxRecommendations) ||
      maxRecommendations < 1 ||
      maxRecommendations > 10
    ) {
      throw new BrainDomainError(
        "INVALID_REQUEST",
        "Maximum recommendations must be between 1 and 10.",
      );
    }
    if (!Number.isInteger(maxInsights) || maxInsights < 1 || maxInsights > 10) {
      throw new BrainDomainError("INVALID_REQUEST", "Maximum insights must be between 1 and 10.");
    }
    if (constraints.responseFormat && constraints.responseFormat !== "structured") {
      throw new BrainDomainError("INVALID_REQUEST", "Brain only supports structured responses.");
    }
    return Object.freeze({ maxRecommendations, maxInsights, responseFormat: "structured" });
  }
}

export type BrainConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";

export interface BrainConfidenceProperties {
  score: number;
  level: BrainConfidenceLevel;
  supportingSignalCount: number;
}

export class BrainConfidence {
  private readonly _score: number;
  private readonly _level: BrainConfidenceLevel;
  private readonly _supportingSignalCount: number;

  constructor(properties: BrainConfidenceProperties) {
    if (!Number.isFinite(properties.score) || properties.score < 0 || properties.score > 1) {
      throw new BrainDomainError(
        "MALFORMED_PROVIDER_OUTPUT",
        "Brain confidence score must be between 0 and 1.",
      );
    }
    if (!["LOW", "MEDIUM", "HIGH"].includes(properties.level)) {
      throw new BrainDomainError(
        "MALFORMED_PROVIDER_OUTPUT",
        "Brain confidence level is unsupported.",
      );
    }
    if (
      !Number.isInteger(properties.supportingSignalCount) ||
      properties.supportingSignalCount < 0
    ) {
      throw new BrainDomainError(
        "MALFORMED_PROVIDER_OUTPUT",
        "Supporting signal count must be non-negative.",
      );
    }
    this._score = Math.round(properties.score * 100) / 100;
    this._level = properties.level;
    this._supportingSignalCount = properties.supportingSignalCount;
    Object.freeze(this);
  }

  get score(): number {
    return this._score;
  }

  get level(): BrainConfidenceLevel {
    return this._level;
  }

  get supportingSignalCount(): number {
    return this._supportingSignalCount;
  }

  public toJSON(): BrainConfidenceProperties {
    return {
      score: this._score,
      level: this._level,
      supportingSignalCount: this._supportingSignalCount,
    };
  }
}

export type BrainEvidenceSourceType =
  | "CLIENT_SIGNAL"
  | "JOB_SIGNAL"
  | "MATCH_SIGNAL"
  | "TIMELINE_SIGNAL"
  | "BUSINESS_METRIC";

export interface BrainEvidenceProperties {
  sourceType: BrainEvidenceSourceType;
  sourceId: string;
  label: string;
  excerpt?: string | undefined;
}

export class BrainEvidence {
  private readonly _sourceType: BrainEvidenceSourceType;
  private readonly _sourceId: string;
  private readonly _label: string;
  private readonly _excerpt: string | undefined;

  constructor(properties: BrainEvidenceProperties) {
    if (
      ![
        "CLIENT_SIGNAL",
        "JOB_SIGNAL",
        "MATCH_SIGNAL",
        "TIMELINE_SIGNAL",
        "BUSINESS_METRIC",
      ].includes(properties.sourceType)
    ) {
      throw new BrainDomainError(
        "MALFORMED_PROVIDER_OUTPUT",
        "Unsupported Brain evidence source type.",
      );
    }
    this._sourceType = properties.sourceType;
    this._sourceId = requireReference(properties.sourceId, "Evidence source ID");
    this._label = properties.label?.trim();
    if (!this._label) {
      throw new BrainDomainError("MALFORMED_PROVIDER_OUTPUT", "Evidence label is required.");
    }
    this._excerpt = properties.excerpt?.trim();
    assertJsonSafe(this.toJSON(), "Brain evidence");
    Object.freeze(this);
  }

  get sourceType(): BrainEvidenceSourceType {
    return this._sourceType;
  }

  get sourceId(): string {
    return this._sourceId;
  }

  get label(): string {
    return this._label;
  }

  get excerpt(): string | undefined {
    return this._excerpt;
  }

  public toJSON(): BrainEvidenceProperties {
    const dto: BrainEvidenceProperties = {
      sourceType: this._sourceType,
      sourceId: this._sourceId,
      label: this._label,
    };
    if (this._excerpt !== undefined) {
      return { ...dto, excerpt: this._excerpt };
    }
    return dto;
  }
}

export type BrainResultStatus = "COMPLETED" | "INSUFFICIENT_CONTEXT" | "FAILED";

export interface BrainInsightProperties {
  insightId: string;
  title: string;
  body: string;
  confidence: BrainConfidence;
  evidence: readonly BrainEvidence[];
}

export interface BrainRecommendationProperties {
  recommendationId: string;
  action: string;
  rationale: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  evidence: readonly BrainEvidence[];
}

export interface BrainResultProperties {
  analysisId: string;
  analysisType: BrainAnalysisType;
  status: BrainResultStatus;
  summary: string;
  insights: readonly BrainInsightProperties[];
  recommendations: readonly BrainRecommendationProperties[];
  confidence: BrainConfidence;
  evidence: readonly BrainEvidence[];
  generatedAt: Date;
  scope?: BrainScope | undefined;
  failure?: BrainFailure | undefined;
  metadata?: BrainJsonValue | undefined;
}

export class BrainResult {
  private readonly _properties: BrainResultProperties;

  constructor(properties: BrainResultProperties) {
    requireReference(properties.analysisId, "Analysis ID");
    parseBrainAnalysisType(properties.analysisType);
    if (!["COMPLETED", "INSUFFICIENT_CONTEXT", "FAILED"].includes(properties.status)) {
      throw new BrainDomainError("MALFORMED_PROVIDER_OUTPUT", "Unsupported Brain result status.");
    }
    if (!properties.summary || properties.summary.trim() === "") {
      throw new BrainDomainError("MALFORMED_PROVIDER_OUTPUT", "Brain result summary is required.");
    }
    if (!properties.confidence) {
      throw new BrainDomainError(
        "MALFORMED_PROVIDER_OUTPUT",
        "Brain result confidence is required.",
      );
    }
    if (!properties.generatedAt || Number.isNaN(properties.generatedAt.getTime())) {
      throw new BrainDomainError(
        "MALFORMED_PROVIDER_OUTPUT",
        "Brain result generated timestamp is invalid.",
      );
    }
    if (properties.metadata !== undefined) {
      assertJsonSafe(properties.metadata, "Brain result metadata");
    }

    const insights = properties.insights.map((insight) => this.validateInsight(insight));
    const recommendations = properties.recommendations.map((rec) =>
      this.validateRecommendation(rec),
    );
    const evidence = properties.evidence.map((item) => new BrainEvidence(item));

    if (
      properties.status === "COMPLETED" &&
      insights.length === 0 &&
      recommendations.length === 0
    ) {
      throw new BrainDomainError(
        "MALFORMED_PROVIDER_OUTPUT",
        "Completed Brain results require insight or recommendation content.",
      );
    }
    if (properties.status !== "COMPLETED" && !properties.failure) {
      throw new BrainDomainError(
        "MALFORMED_PROVIDER_OUTPUT",
        "Non-completed Brain results require a typed failure.",
      );
    }

    this._properties = freezeJson({
      analysisId: properties.analysisId.trim(),
      analysisType: properties.analysisType,
      status: properties.status,
      summary: properties.summary.trim(),
      insights,
      recommendations,
      confidence: properties.confidence,
      evidence,
      generatedAt: new Date(properties.generatedAt.getTime()),
      scope: properties.scope,
      failure: properties.failure,
      metadata: cloneJsonValue(properties.metadata),
    });
    Object.freeze(this);
  }

  get analysisId(): string {
    return this._properties.analysisId;
  }

  get analysisType(): BrainAnalysisType {
    return this._properties.analysisType;
  }

  get status(): BrainResultStatus {
    return this._properties.status;
  }

  get summary(): string {
    return this._properties.summary;
  }

  get insights(): readonly BrainInsightProperties[] {
    return this._properties.insights;
  }

  get recommendations(): readonly BrainRecommendationProperties[] {
    return this._properties.recommendations;
  }

  get confidence(): BrainConfidence {
    return this._properties.confidence;
  }

  get evidence(): readonly BrainEvidence[] {
    return this._properties.evidence;
  }

  get generatedAt(): Date {
    return new Date(this._properties.generatedAt.getTime());
  }

  get metadata(): BrainJsonValue | undefined {
    return cloneJsonValue(this._properties.metadata);
  }

  get scope(): BrainScope | undefined {
    return this._properties.scope;
  }

  get failure(): BrainFailure | undefined {
    return this._properties.failure;
  }

  public toJSON(): BrainResultProperties {
    return {
      ...this._properties,
      scope: this._properties.scope,
      generatedAt: new Date(this._properties.generatedAt.getTime()),
      metadata: cloneJsonValue(this._properties.metadata),
    };
  }

  private validateInsight(properties: BrainInsightProperties): BrainInsightProperties {
    requireReference(properties.insightId, "Insight ID");
    if (!properties.title?.trim() || !properties.body?.trim()) {
      throw new BrainDomainError(
        "MALFORMED_PROVIDER_OUTPUT",
        "Brain insight title and body are required.",
      );
    }
    if (!properties.confidence) {
      throw new BrainDomainError(
        "MALFORMED_PROVIDER_OUTPUT",
        "Brain insight confidence is required.",
      );
    }
    return freezeJson({
      insightId: properties.insightId.trim(),
      title: properties.title.trim(),
      body: properties.body.trim(),
      confidence: properties.confidence,
      evidence: Object.freeze(properties.evidence.map((e) => new BrainEvidence(e))),
    });
  }

  private validateRecommendation(
    properties: BrainRecommendationProperties,
  ): BrainRecommendationProperties {
    requireReference(properties.recommendationId, "Recommendation ID");
    if (!properties.action?.trim() || !properties.rationale?.trim()) {
      throw new BrainDomainError(
        "MALFORMED_PROVIDER_OUTPUT",
        "Brain recommendation action and rationale are required.",
      );
    }
    if (!["LOW", "MEDIUM", "HIGH"].includes(properties.priority)) {
      throw new BrainDomainError(
        "MALFORMED_PROVIDER_OUTPUT",
        "Brain recommendation priority is unsupported.",
      );
    }
    return freezeJson({
      recommendationId: properties.recommendationId.trim(),
      action: properties.action.trim(),
      rationale: properties.rationale.trim(),
      priority: properties.priority,
      evidence: Object.freeze(properties.evidence.map((e) => new BrainEvidence(e))),
    });
  }
}

export type BrainAnalysisStatus =
  | "REQUESTED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "TIMEOUT"
  | "INSUFFICIENT_CONTEXT";

export interface BrainAnalysisAggregateProperties {
  id: string;
  scope: BrainScope;
  analysisType: BrainAnalysisType;
  status: BrainAnalysisStatus;
  correlationId: string;
  idempotencyKey?: string | undefined;
  constraints: BrainAnalysisConstraints;
  summary?: string | undefined;
  insights?: readonly BrainInsightProperties[] | undefined;
  recommendations?: readonly BrainRecommendationProperties[] | undefined;
  confidence?: BrainConfidence | undefined;
  evidence?: readonly BrainEvidence[] | undefined;
  failure?: BrainFailure | undefined;
  metadata?: BrainJsonValue | undefined;
  attemptCount?: number | undefined;
  maxAttempts?: number | undefined;
  claimedAt?: Date | undefined;
  completedAt?: Date | undefined;
  failedAt?: Date | undefined;
  staleTimeoutMs?: number | undefined;
  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;
}

export class BrainAnalysisAggregate {
  private readonly _id: string;
  private readonly _scope: BrainScope;
  private readonly _analysisType: BrainAnalysisType;
  private _status: BrainAnalysisStatus;
  private readonly _correlationId: string;
  private readonly _idempotencyKey: string | undefined;
  private readonly _constraints: BrainAnalysisConstraints;
  private _summary: string | undefined;
  private _insights: readonly BrainInsightProperties[];
  private _recommendations: readonly BrainRecommendationProperties[];
  private _confidence: BrainConfidence | undefined;
  private _evidence: readonly BrainEvidence[];
  private _failure: BrainFailure | undefined;
  private _metadata: BrainJsonValue | undefined;
  private _attemptCount: number;
  private readonly _maxAttempts: number;
  private _claimedAt: Date | undefined;
  private _completedAt: Date | undefined;
  private _failedAt: Date | undefined;
  private readonly _staleTimeoutMs: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(properties: BrainAnalysisAggregateProperties) {
    this._id = requireReference(properties.id, "Analysis Aggregate ID");
    if (!properties.scope) {
      throw new BrainDomainError("INVALID_REQUEST", "Brain scope is required.");
    }
    this._scope = properties.scope;
    this._analysisType = parseBrainAnalysisType(properties.analysisType);
    this._status = properties.status;
    this._correlationId = requireReference(properties.correlationId, "Correlation ID");
    this._idempotencyKey = properties.idempotencyKey
      ? requireReference(properties.idempotencyKey, "Idempotency key")
      : undefined;
    this._constraints = freezeJson({ ...properties.constraints });
    this._summary = properties.summary?.trim();
    this._insights = Object.freeze((properties.insights ?? []).map((i) => freezeJson({ ...i })));
    this._recommendations = Object.freeze(
      (properties.recommendations ?? []).map((r) => freezeJson({ ...r })),
    );
    this._confidence = properties.confidence;
    this._evidence = Object.freeze(
      (properties.evidence ?? []).map((e) =>
        e instanceof BrainEvidence ? e : new BrainEvidence(e),
      ),
    );
    this._failure = properties.failure;
    this._metadata = cloneJsonValue(properties.metadata);
    this._attemptCount = properties.attemptCount ?? 0;
    this._maxAttempts = properties.maxAttempts ?? 3;
    this._claimedAt = properties.claimedAt ? new Date(properties.claimedAt.getTime()) : undefined;
    this._completedAt = properties.completedAt
      ? new Date(properties.completedAt.getTime())
      : undefined;
    this._failedAt = properties.failedAt ? new Date(properties.failedAt.getTime()) : undefined;
    this._staleTimeoutMs = properties.staleTimeoutMs ?? 30000;
    this._createdAt = properties.createdAt ? new Date(properties.createdAt.getTime()) : new Date();
    this._updatedAt = properties.updatedAt ? new Date(properties.updatedAt.getTime()) : new Date();
  }

  public static create(
    request: BrainAnalysisRequest,
    options?: { maxAttempts?: number; staleTimeoutMs?: number; createdAt?: Date },
  ): BrainAnalysisAggregate {
    return new BrainAnalysisAggregate({
      id: request.metadata.requestId,
      scope: request.context.scope,
      analysisType: request.analysisType,
      status: "REQUESTED",
      correlationId: request.metadata.correlationId,
      idempotencyKey: request.metadata.idempotencyKey,
      constraints: request.constraints,
      attemptCount: 0,
      maxAttempts: options?.maxAttempts ?? 3,
      staleTimeoutMs: options?.staleTimeoutMs ?? 30000,
      createdAt: options?.createdAt ?? request.metadata.requestedAt,
      updatedAt: options?.createdAt ?? request.metadata.requestedAt,
    });
  }

  get id(): string {
    return this._id;
  }

  get scope(): BrainScope {
    return this._scope;
  }

  get analysisType(): BrainAnalysisType {
    return this._analysisType;
  }

  get status(): BrainAnalysisStatus {
    return this._status;
  }

  get correlationId(): string {
    return this._correlationId;
  }

  get idempotencyKey(): string | undefined {
    return this._idempotencyKey;
  }

  get constraints(): BrainAnalysisConstraints {
    return { ...this._constraints };
  }

  get summary(): string | undefined {
    return this._summary;
  }

  get insights(): readonly BrainInsightProperties[] {
    return [...this._insights];
  }

  get recommendations(): readonly BrainRecommendationProperties[] {
    return [...this._recommendations];
  }

  get confidence(): BrainConfidence | undefined {
    return this._confidence;
  }

  get evidence(): readonly BrainEvidence[] {
    return [...this._evidence];
  }

  get failure(): BrainFailure | undefined {
    return this._failure;
  }

  get metadata(): BrainJsonValue | undefined {
    return cloneJsonValue(this._metadata);
  }

  get attemptCount(): number {
    return this._attemptCount;
  }

  get maxAttempts(): number {
    return this._maxAttempts;
  }

  get claimedAt(): Date | undefined {
    return this._claimedAt ? new Date(this._claimedAt.getTime()) : undefined;
  }

  get completedAt(): Date | undefined {
    return this._completedAt ? new Date(this._completedAt.getTime()) : undefined;
  }

  get failedAt(): Date | undefined {
    return this._failedAt ? new Date(this._failedAt.getTime()) : undefined;
  }

  get staleTimeoutMs(): number {
    return this._staleTimeoutMs;
  }

  get createdAt(): Date {
    return new Date(this._createdAt.getTime());
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt.getTime());
  }

  public claim(actorId: string, claimedAt: Date = new Date()): void {
    if (this._status !== "REQUESTED") {
      throw new BrainDomainError(
        "INVALID_REQUEST",
        `Invalid lifecycle transition from ${this._status} to RUNNING.`,
      );
    }
    if (this._attemptCount >= this._maxAttempts) {
      throw new BrainDomainError("INVALID_REQUEST", "Maximum analysis attempts exceeded.");
    }
    if (actorId !== this._scope.actorId && actorId !== this._scope.ownerId) {
      throw new BrainDomainError(
        "UNAUTHORIZED_CONTEXT",
        "Actor context mismatch during execution claim.",
      );
    }
    this._status = "RUNNING";
    this._claimedAt = new Date(claimedAt.getTime());
    this._attemptCount++;
    this._updatedAt = new Date(claimedAt.getTime());
  }

  public complete(result: BrainResult, completedAt: Date = new Date()): void {
    if (this._status !== "RUNNING") {
      throw new BrainDomainError(
        "INVALID_REQUEST",
        `Invalid lifecycle transition from ${this._status} to COMPLETED.`,
      );
    }
    const resDto = result.toJSON();
    this._status = "COMPLETED";
    this._summary = resDto.summary;
    this._insights = Object.freeze(resDto.insights.map((i) => freezeJson({ ...i })));
    this._recommendations = Object.freeze(resDto.recommendations.map((r) => freezeJson({ ...r })));
    this._confidence = resDto.confidence;
    this._evidence = Object.freeze(
      resDto.evidence.map((e) => (e instanceof BrainEvidence ? e : new BrainEvidence(e))),
    );
    this._metadata = cloneJsonValue(resDto.metadata);
    this._completedAt = new Date(completedAt.getTime());
    this._updatedAt = new Date(completedAt.getTime());
  }

  public fail(
    failure: BrainFailure,
    status: "FAILED" | "TIMEOUT" | "INSUFFICIENT_CONTEXT" = "FAILED",
    failedAt: Date = new Date(),
  ): void {
    if (this._status !== "RUNNING" && this._status !== "REQUESTED") {
      throw new BrainDomainError(
        "INVALID_REQUEST",
        `Invalid lifecycle transition from ${this._status} to ${status}.`,
      );
    }
    this._status = status;
    this._failure = failure;
    this._summary = failure.message;
    this._failedAt = new Date(failedAt.getTime());
    this._updatedAt = new Date(failedAt.getTime());
  }

  public isStale(now: Date = new Date()): boolean {
    if (this._status !== "RUNNING" || !this._claimedAt) {
      return false;
    }
    return now.getTime() - this._claimedAt.getTime() > this._staleTimeoutMs;
  }

  public recoverStale(now: Date = new Date()): boolean {
    if (!this.isStale(now)) {
      return false;
    }
    const failure = new BrainFailure({
      code: "PROVIDER_TIMEOUT",
      message: "Orphaned execution recovered after timeout.",
      retryable: true,
    });
    this.fail(failure, "TIMEOUT", now);
    return true;
  }

  public toResult(): BrainResult {
    if (this._status === "COMPLETED") {
      return new BrainResult({
        analysisId: this._id,
        analysisType: this._analysisType,
        status: "COMPLETED",
        summary: this._summary ?? "Analysis completed.",
        insights: this._insights,
        recommendations: this._recommendations,
        confidence:
          this._confidence ??
          new BrainConfidence({ score: 1, level: "HIGH", supportingSignalCount: 1 }),
        evidence: this._evidence,
        generatedAt: this._completedAt ?? this._updatedAt,
        scope: this._scope,
        metadata: this._metadata,
      });
    }

    const failure =
      this._failure ??
      new BrainFailure({
        code:
          this._status === "TIMEOUT"
            ? "PROVIDER_TIMEOUT"
            : this._status === "INSUFFICIENT_CONTEXT"
              ? "INSUFFICIENT_CONTEXT"
              : "INTERNAL_FAILURE",
        message: this._summary ?? "Brain analysis could not be completed.",
      });

    return new BrainResult({
      analysisId: this._id,
      analysisType: this._analysisType,
      status: this._status === "INSUFFICIENT_CONTEXT" ? "INSUFFICIENT_CONTEXT" : "FAILED",
      summary: failure.message,
      insights: [],
      recommendations: [],
      confidence: new BrainConfidence({ score: 0, level: "LOW", supportingSignalCount: 0 }),
      evidence: [],
      generatedAt: this._failedAt ?? this._updatedAt,
      scope: this._scope,
      failure,
      metadata: this._metadata,
    });
  }

  public toJSON(): BrainAnalysisAggregateProperties {
    return {
      id: this._id,
      scope: this._scope,
      analysisType: this._analysisType,
      status: this._status,
      correlationId: this._correlationId,
      idempotencyKey: this._idempotencyKey,
      constraints: this._constraints,
      summary: this._summary,
      insights: this._insights,
      recommendations: this._recommendations,
      confidence: this._confidence,
      evidence: this._evidence,
      failure: this._failure,
      metadata: cloneJsonValue(this._metadata),
      attemptCount: this._attemptCount,
      maxAttempts: this._maxAttempts,
      claimedAt: this.claimedAt,
      completedAt: this.completedAt,
      failedAt: this.failedAt,
      staleTimeoutMs: this._staleTimeoutMs,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

export interface BrainAnalysisListFilters {
  readonly analysisType?: BrainAnalysisType;
  readonly status?: BrainAnalysisStatus;
  readonly limit?: number;
  readonly offset?: number;
}

export interface BrainAnalysisRepository {
  create(aggregate: BrainAnalysisAggregate): Promise<void>;
  claimExecution(
    id: string,
    scope: BrainScope,
    claimedAt?: Date,
  ): Promise<BrainAnalysisAggregate | null>;
  saveCompleted(
    id: string,
    scope: BrainScope,
    result: BrainResult,
    completedAt?: Date,
  ): Promise<BrainAnalysisAggregate>;
  saveFailed(
    id: string,
    scope: BrainScope,
    failure: BrainFailure,
    status?: "FAILED" | "TIMEOUT" | "INSUFFICIENT_CONTEXT",
    failedAt?: Date,
  ): Promise<BrainAnalysisAggregate>;
  findById(id: string, scope: BrainScope): Promise<BrainAnalysisAggregate | null>;
  findByIdempotencyKey(
    scope: BrainScope,
    analysisType: BrainAnalysisType,
    idempotencyKey: string,
  ): Promise<BrainAnalysisAggregate | null>;
  listByScope(
    scope: BrainScope,
    filters?: BrainAnalysisListFilters,
  ): Promise<{ readonly items: readonly BrainAnalysisAggregate[]; readonly total: number }>;
  recoverStaleRunning(
    staleBeforeDate: Date,
    limit?: number,
  ): Promise<readonly BrainAnalysisAggregate[]>;
}

export class InMemoryBrainAnalysisRepository implements BrainAnalysisRepository {
  private readonly _storage: Map<string, BrainAnalysisAggregate> = new Map();

  public async create(aggregate: BrainAnalysisAggregate): Promise<void> {
    const existingKey = aggregate.idempotencyKey
      ? `${aggregate.scope.tenantId}:${aggregate.scope.ownerId}:${aggregate.analysisType}:${aggregate.idempotencyKey}`
      : null;

    if (existingKey) {
      for (const item of this._storage.values()) {
        if (
          item.scope.tenantId === aggregate.scope.tenantId &&
          item.scope.ownerId === aggregate.scope.ownerId &&
          item.analysisType === aggregate.analysisType &&
          item.idempotencyKey === aggregate.idempotencyKey &&
          ["REQUESTED", "RUNNING", "COMPLETED"].includes(item.status)
        ) {
          throw new BrainDomainError(
            "INVALID_REQUEST",
            "Concurrent duplicate analysis request detected.",
          );
        }
      }
    }

    this._storage.set(aggregate.id, new BrainAnalysisAggregate(aggregate.toJSON()));
  }

  public async claimExecution(
    id: string,
    scope: BrainScope,
    claimedAt: Date = new Date(),
  ): Promise<BrainAnalysisAggregate | null> {
    const item = this._storage.get(id);
    if (!item) {
      return null;
    }
    if (item.scope.tenantId !== scope.tenantId || item.scope.ownerId !== scope.ownerId) {
      throw new BrainDomainError(
        "UNAUTHORIZED_CONTEXT",
        "Cannot claim analysis across tenant/owner boundary.",
      );
    }
    if (item.status !== "REQUESTED") {
      return null;
    }
    item.claim(scope.actorId, claimedAt);
    return new BrainAnalysisAggregate(item.toJSON());
  }

  public async saveCompleted(
    id: string,
    scope: BrainScope,
    result: BrainResult,
    completedAt: Date = new Date(),
  ): Promise<BrainAnalysisAggregate> {
    const item = this._storage.get(id);
    if (!item) {
      throw new BrainDomainError("INVALID_REQUEST", "Analysis not found.");
    }
    if (item.scope.tenantId !== scope.tenantId || item.scope.ownerId !== scope.ownerId) {
      throw new BrainDomainError(
        "UNAUTHORIZED_CONTEXT",
        "Cannot complete analysis across tenant/owner boundary.",
      );
    }
    item.complete(result, completedAt);
    return new BrainAnalysisAggregate(item.toJSON());
  }

  public async saveFailed(
    id: string,
    scope: BrainScope,
    failure: BrainFailure,
    status: "FAILED" | "TIMEOUT" | "INSUFFICIENT_CONTEXT" = "FAILED",
    failedAt: Date = new Date(),
  ): Promise<BrainAnalysisAggregate> {
    const item = this._storage.get(id);
    if (!item) {
      throw new BrainDomainError("INVALID_REQUEST", "Analysis not found.");
    }
    if (item.scope.tenantId !== scope.tenantId || item.scope.ownerId !== scope.ownerId) {
      throw new BrainDomainError(
        "UNAUTHORIZED_CONTEXT",
        "Cannot fail analysis across tenant/owner boundary.",
      );
    }
    item.fail(failure, status, failedAt);
    return new BrainAnalysisAggregate(item.toJSON());
  }

  public async findById(id: string, scope: BrainScope): Promise<BrainAnalysisAggregate | null> {
    const item = this._storage.get(id);
    if (!item) {
      return null;
    }
    if (item.scope.tenantId !== scope.tenantId || item.scope.ownerId !== scope.ownerId) {
      return null;
    }
    return new BrainAnalysisAggregate(item.toJSON());
  }

  public async findByIdempotencyKey(
    scope: BrainScope,
    analysisType: BrainAnalysisType,
    idempotencyKey: string,
  ): Promise<BrainAnalysisAggregate | null> {
    for (const item of this._storage.values()) {
      if (
        item.scope.tenantId === scope.tenantId &&
        item.scope.ownerId === scope.ownerId &&
        item.analysisType === analysisType &&
        item.idempotencyKey === idempotencyKey
      ) {
        return new BrainAnalysisAggregate(item.toJSON());
      }
    }
    return null;
  }

  public async listByScope(
    scope: BrainScope,
    filters?: BrainAnalysisListFilters,
  ): Promise<{ readonly items: readonly BrainAnalysisAggregate[]; readonly total: number }> {
    const matches: BrainAnalysisAggregate[] = [];
    for (const item of this._storage.values()) {
      if (item.scope.tenantId === scope.tenantId && item.scope.ownerId === scope.ownerId) {
        if (filters?.analysisType && item.analysisType !== filters.analysisType) {
          continue;
        }
        if (filters?.status && item.status !== filters.status) {
          continue;
        }
        matches.push(new BrainAnalysisAggregate(item.toJSON()));
      }
    }
    const offset = filters?.offset ?? 0;
    const limit = filters?.limit ?? 20;
    const paginated = matches.slice(offset, offset + limit);
    return { items: paginated, total: matches.length };
  }

  public async recoverStaleRunning(
    staleBeforeDate: Date,
    limit = 50,
  ): Promise<readonly BrainAnalysisAggregate[]> {
    const recovered: BrainAnalysisAggregate[] = [];
    for (const item of this._storage.values()) {
      if (
        item.status === "RUNNING" &&
        item.claimedAt &&
        item.claimedAt.getTime() <= staleBeforeDate.getTime()
      ) {
        item.recoverStale(new Date());
        recovered.push(new BrainAnalysisAggregate(item.toJSON()));
        if (recovered.length >= limit) {
          break;
        }
      }
    }
    return recovered;
  }
}

export interface BrainEngineOptions {
  readonly timeoutMs: number;
  readonly signal?: AbortSignal | undefined;
}

export interface BrainEngine {
  analyze(request: BrainAnalysisRequest, options: BrainEngineOptions): Promise<BrainResult>;
}

export interface BrainEntitlementDecision {
  readonly allowed: boolean;
  readonly feature: PlanFeature;
  readonly reason: "ALLOWED" | "DENIED" | "UNAVAILABLE";
}

export interface BrainEntitlementGateway {
  canUseBrain(
    scope: BrainScope,
    analysisType: BrainAnalysisType,
  ): Promise<BrainEntitlementDecision>;
}

export interface BrainExecutionServiceProperties {
  engine: BrainEngine;
  entitlementGateway: BrainEntitlementGateway;
  repository?: BrainAnalysisRepository | undefined;
  defaultTimeoutMs?: number;
  staleTimeoutMs?: number;
}

export class BrainExecutionService {
  private readonly _engine: BrainEngine;
  private readonly _entitlementGateway: BrainEntitlementGateway;
  private readonly _repository: BrainAnalysisRepository | undefined;
  private readonly _defaultTimeoutMs: number;
  private readonly _staleTimeoutMs: number;

  constructor(properties: BrainExecutionServiceProperties) {
    if (!properties.engine) {
      throw new BrainDomainError("INVALID_REQUEST", "Brain engine is required.");
    }
    if (!properties.entitlementGateway) {
      throw new BrainDomainError("INVALID_REQUEST", "Brain entitlement gateway is required.");
    }
    this._engine = properties.engine;
    this._entitlementGateway = properties.entitlementGateway;
    this._repository = properties.repository;
    this._defaultTimeoutMs = properties.defaultTimeoutMs ?? 5000;
    this._staleTimeoutMs = properties.staleTimeoutMs ?? 30000;
    if (
      !Number.isInteger(this._defaultTimeoutMs) ||
      this._defaultTimeoutMs < 1 ||
      this._defaultTimeoutMs > 30000
    ) {
      throw new BrainDomainError(
        "INVALID_REQUEST",
        "Brain timeout must be between 1 and 30000 milliseconds.",
      );
    }
    if (
      !Number.isInteger(this._staleTimeoutMs) ||
      this._staleTimeoutMs < 1000 ||
      this._staleTimeoutMs > 300000
    ) {
      throw new BrainDomainError(
        "INVALID_REQUEST",
        "Brain stale timeout must be between 1000 and 300000 milliseconds.",
      );
    }
  }

  public async analyze(
    request: BrainAnalysisRequest,
    options?: Partial<BrainEngineOptions>,
  ): Promise<BrainResult> {
    // 1. Request & Context validation
    request.context.ensureSufficientFor(request.analysisType);

    // 2. Entitlement verification
    const entitlement = await this.resolveEntitlement(request);
    if (!entitlement.allowed) {
      const code =
        entitlement.reason === "UNAVAILABLE" ? "ENTITLEMENT_UNAVAILABLE" : "UNAUTHORIZED_CONTEXT";
      return this.failureResult(
        request,
        new BrainFailure({ code, message: "Brain entitlement denied." }),
      );
    }

    const timeoutMs = options?.timeoutMs ?? this._defaultTimeoutMs;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) {
      throw new BrainDomainError(
        "INVALID_REQUEST",
        "Brain timeout must be between 1 and 30000 milliseconds.",
      );
    }

    // 3. Idempotency Check (if repository available)
    if (this._repository && request.metadata.idempotencyKey) {
      const existing = await this._repository.findByIdempotencyKey(
        request.context.scope,
        request.analysisType,
        request.metadata.idempotencyKey,
      );
      if (existing) {
        if (existing.status === "COMPLETED") {
          return existing.toResult();
        }
        if (
          (existing.status === "RUNNING" || existing.status === "REQUESTED") &&
          !existing.isStale()
        ) {
          const pollIntervalMs = 10;
          const maxWaitMs = timeoutMs;
          const startTime = Date.now();

          while (Date.now() - startTime < maxWaitMs) {
            const inFlight = await this._repository.findByIdempotencyKey(
              request.context.scope,
              request.analysisType,
              request.metadata.idempotencyKey,
            );

            if (inFlight) {
              if (
                inFlight.status === "COMPLETED" ||
                inFlight.status === "FAILED" ||
                inFlight.status === "TIMEOUT" ||
                inFlight.status === "INSUFFICIENT_CONTEXT"
              ) {
                return inFlight.toResult();
              }
            }
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
          }

          return this.failureResult(
            request,
            new BrainFailure({
              code: "PROVIDER_TIMEOUT",
              message: "Timed out waiting for concurrent in-flight analysis.",
              retryable: true,
            }),
          );
        }
      }
    }

    // 4. Create analysis execution record & claim leader execution
    const aggregate = BrainAnalysisAggregate.create(request, {
      staleTimeoutMs: this._staleTimeoutMs,
    });

    if (this._repository) {
      let isLeader = false;
      try {
        await this._repository.create(aggregate);
        const claimed = await this._repository.claimExecution(aggregate.id, request.context.scope);
        isLeader = Boolean(claimed);
      } catch (err: unknown) {
        if (err instanceof BrainDomainError && err.message.includes("duplicate")) {
          isLeader = false;
        } else {
          throw err;
        }
      }

      if (!isLeader) {
        // A concurrent execution is in-flight or already completed. Await resolution up to timeout.
        const pollIntervalMs = 10;
        const maxWaitMs = timeoutMs;
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitMs) {
          const inFlight = request.metadata.idempotencyKey
            ? await this._repository.findByIdempotencyKey(
                request.context.scope,
                request.analysisType,
                request.metadata.idempotencyKey,
              )
            : await this._repository.findById(aggregate.id, request.context.scope);

          if (inFlight) {
            if (
              inFlight.status === "COMPLETED" ||
              inFlight.status === "FAILED" ||
              inFlight.status === "TIMEOUT" ||
              inFlight.status === "INSUFFICIENT_CONTEXT"
            ) {
              return inFlight.toResult();
            }
          }
          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }

        return this.failureResult(
          request,
          new BrainFailure({
            code: "PROVIDER_TIMEOUT",
            message: "Timed out waiting for concurrent in-flight analysis.",
            retryable: true,
          }),
        );
      }
    } else {
      aggregate.claim(request.context.scope.actorId);
    }

    // 5. Provider execution (outside DB transactions)
    try {
      const rawResult = await this.withTimeout(
        this._engine.analyze(request, { timeoutMs, signal: options?.signal }),
        timeoutMs,
      );
      const validatedResult = new BrainResult({
        ...rawResult.toJSON(),
        scope: request.context.scope,
      });

      if (this._repository) {
        await this._repository.saveCompleted(aggregate.id, request.context.scope, validatedResult);
      } else {
        aggregate.complete(validatedResult);
      }

      return validatedResult;
    } catch (error) {
      const failure = mapBrainError(error);
      const terminalStatus: "FAILED" | "TIMEOUT" | "INSUFFICIENT_CONTEXT" =
        failure.code === "PROVIDER_TIMEOUT"
          ? "TIMEOUT"
          : failure.code === "INSUFFICIENT_CONTEXT"
            ? "INSUFFICIENT_CONTEXT"
            : "FAILED";

      if (this._repository) {
        await this._repository.saveFailed(
          aggregate.id,
          request.context.scope,
          failure,
          terminalStatus,
        );
      } else {
        aggregate.fail(failure, terminalStatus);
      }

      return this.failureResult(request, failure);
    }
  }

  public async recoverStaleRunning(
    staleBeforeDate: Date,
    limit = 50,
  ): Promise<readonly BrainAnalysisAggregate[]> {
    if (!this._repository) {
      return [];
    }
    return this._repository.recoverStaleRunning(staleBeforeDate, limit);
  }

  private async resolveEntitlement(
    request: BrainAnalysisRequest,
  ): Promise<BrainEntitlementDecision> {
    try {
      return await this._entitlementGateway.canUseBrain(
        request.context.scope,
        request.analysisType,
      );
    } catch {
      return { allowed: false, feature: "AI_PROPOSAL", reason: "UNAVAILABLE" };
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new BrainDomainError("PROVIDER_TIMEOUT", "Brain provider timed out.")),
        timeoutMs,
      );
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private failureResult(request: BrainAnalysisRequest, failure: BrainFailure): BrainResult {
    return new BrainResult({
      analysisId: request.metadata.requestId,
      analysisType: request.analysisType,
      status: failure.code === "INSUFFICIENT_CONTEXT" ? "INSUFFICIENT_CONTEXT" : "FAILED",
      summary: failure.message,
      insights: [],
      recommendations: [],
      confidence: new BrainConfidence({ score: 0, level: "LOW", supportingSignalCount: 0 }),
      evidence: [],
      generatedAt: new Date(),
      scope: request.context.scope,
      failure,
    });
  }
}

export interface BrainPersistenceContract {
  checkUniqueAnalysisId(tenantId: string, ownerId: string, analysisId: string): Promise<boolean>;
}

export type BrainAnalysisAggregateStore = BrainAnalysisRepository;

export function mapBrainError(error: unknown): BrainFailure {
  if (error instanceof BrainDomainError) {
    return error.toFailure();
  }
  if (error instanceof BrainFailure) {
    return error;
  }
  return new BrainFailure({
    code: "PROVIDER_UNAVAILABLE",
    message: "Brain provider is unavailable.",
    retryable: true,
  });
}

export class OpportunityReviewEngine implements BrainEngine {
  public async analyze(
    request: BrainAnalysisRequest,
    _options?: BrainEngineOptions,
  ): Promise<BrainResult> {
    if (request.analysisType !== "OPPORTUNITY_REVIEW") {
      throw new BrainDomainError(
        "UNSUPPORTED_ANALYSIS",
        `OpportunityReviewEngine does not support ${request.analysisType}`,
      );
    }

    const jobs = request.context.jobs;
    if (jobs.length === 0) {
      throw new BrainDomainError(
        "INSUFFICIENT_CONTEXT",
        "Opportunity review requires at least one job signal.",
      );
    }

    const primaryJob = jobs[0]!;
    const matchingMatches = request.context.matches.filter((m) => m.jobId === primaryJob.jobId);
    const primaryMatch = matchingMatches[0];

    const requiredSkills = primaryJob.requiredSkills ?? [];
    const matchedSkills = primaryMatch?.strengths ?? [];
    const missingSkills = requiredSkills.filter(
      (skill) => !matchedSkills.some((ms) => ms.toLowerCase() === skill.toLowerCase()),
    );

    const evidenceList: BrainEvidence[] = [
      new BrainEvidence({
        sourceType: "JOB_SIGNAL",
        sourceId: primaryJob.signalId,
        label: `Job: ${primaryJob.title ?? primaryJob.jobId}`,
        excerpt: primaryJob.title ? `Title: ${primaryJob.title}` : undefined,
      }),
    ];

    if (primaryMatch) {
      evidenceList.push(
        new BrainEvidence({
          sourceType: "MATCH_SIGNAL",
          sourceId: primaryMatch.signalId,
          label: `Match: ${primaryMatch.matchId}`,
          excerpt:
            primaryMatch.score !== undefined
              ? `Match score: ${(primaryMatch.score * 100).toFixed(0)}%`
              : undefined,
        }),
      );
    }

    const insights: BrainInsightProperties[] = [];

    const alignmentScore =
      primaryMatch?.score ??
      (requiredSkills.length > 0
        ? (requiredSkills.length - missingSkills.length) / requiredSkills.length
        : 0.8);
    const fitLevel: BrainConfidenceLevel =
      alignmentScore >= 0.75 ? "HIGH" : alignmentScore >= 0.5 ? "MEDIUM" : "LOW";

    insights.push({
      insightId: `insight-alignment-${primaryJob.jobId}`,
      title: `Skill Alignment for "${primaryJob.title ?? primaryJob.jobId}"`,
      body:
        matchedSkills.length > 0
          ? `Strong candidate alignment on skills: ${matchedSkills.join(", ")}.`
          : `Job requires ${requiredSkills.length > 0 ? requiredSkills.join(", ") : "general capabilities"}.`,
      confidence: new BrainConfidence({
        score: Math.min(1, Math.max(0, Math.round(alignmentScore * 100) / 100)),
        level: fitLevel,
        supportingSignalCount: evidenceList.length,
      }),
      evidence: evidenceList,
    });

    if (missingSkills.length > 0 || (primaryMatch?.risks && primaryMatch.risks.length > 0)) {
      insights.push({
        insightId: `insight-gaps-${primaryJob.jobId}`,
        title: "Skill Gaps & Scope Risks",
        body:
          missingSkills.length > 0
            ? `Identified gaps in required skills: ${missingSkills.join(", ")}. Address competency early in proposal.`
            : `Potential risks noted: ${(primaryMatch?.risks ?? []).join(", ")}.`,
        confidence: new BrainConfidence({
          score: 0.85,
          level: "HIGH",
          supportingSignalCount: 1,
        }),
        evidence: [evidenceList[0]!],
      });
    }

    const clients = request.context.clients;
    if (clients.length > 0) {
      const clientEvidence = new BrainEvidence({
        sourceType: "CLIENT_SIGNAL",
        sourceId: clients[0]!.signalId,
        label: `Client: ${clients[0]!.name ?? clients[0]!.clientId}`,
        excerpt: clients[0]!.status ? `Status: ${clients[0]!.status}` : undefined,
      });
      insights.push({
        insightId: `insight-client-${clients[0]!.clientId}`,
        title: `Existing Client Context: ${clients[0]!.name ?? clients[0]!.clientId}`,
        body: `Client ${clients[0]!.name ?? clients[0]!.clientId} is currently ${clients[0]!.status ?? "ACTIVE"}. Leverage historical engagement trust.`,
        confidence: new BrainConfidence({
          score: 0.9,
          level: "HIGH",
          supportingSignalCount: 1,
        }),
        evidence: [clientEvidence],
      });
    }

    const recommendations: BrainRecommendationProperties[] = [];

    recommendations.push({
      recommendationId: `rec-frame-${primaryJob.jobId}`,
      action:
        matchedSkills.length > 0
          ? `Lead proposal with proven case studies in ${matchedSkills.slice(0, 3).join(", ")}`
          : `Lead proposal with relevant domain experience and verified portfolio`,
      rationale:
        "Aligns candidate strengths directly with stated job requirements to maximize conversion.",
      priority: "HIGH",
      evidence: evidenceList,
    });

    if (missingSkills.length > 0) {
      recommendations.push({
        recommendationId: `rec-gap-${primaryJob.jobId}`,
        action: `Explicitly address learning velocity and adjacent experience for ${missingSkills.slice(0, 2).join(", ")}`,
        rationale:
          "Proactively alleviates client hesitation regarding missing primary requirements.",
        priority: "MEDIUM",
        evidence: [evidenceList[0]!],
      });
    } else {
      recommendations.push({
        recommendationId: `rec-schedule-${primaryJob.jobId}`,
        action: "Propose concrete milestones and initial kickoff discovery within 48 hours",
        rationale: "Demonstrates clear execution roadmap and operational velocity.",
        priority: "MEDIUM",
        evidence: [evidenceList[0]!],
      });
    }

    recommendations.push({
      recommendationId: `rec-submit-${primaryJob.jobId}`,
      action: "Submit proposal within active opportunity window",
      rationale: "First-quartile submissions experience significantly higher response rates.",
      priority: "HIGH",
      evidence: [evidenceList[0]!],
    });

    const maxInsights = request.constraints.maxInsights ?? 5;
    const maxRecs = request.constraints.maxRecommendations ?? 5;

    const finalInsights = insights.slice(0, maxInsights);
    const finalRecs = recommendations.slice(0, maxRecs);

    const overallScore = primaryMatch?.score ?? alignmentScore;
    const overallLevel: BrainConfidenceLevel =
      overallScore >= 0.75 ? "HIGH" : overallScore >= 0.5 ? "MEDIUM" : "LOW";

    const overallConfidence = new BrainConfidence({
      score: Math.min(1, Math.max(0, Math.round(overallScore * 100) / 100)),
      level: overallLevel,
      supportingSignalCount: request.context.signalCount,
    });

    return new BrainResult({
      analysisId: request.metadata.requestId,
      analysisType: "OPPORTUNITY_REVIEW",
      status: "COMPLETED",
      summary: `Opportunity review completed for "${primaryJob.title ?? primaryJob.jobId}". Generated ${finalInsights.length} insights and ${finalRecs.length} recommendations.`,
      insights: finalInsights,
      recommendations: finalRecs,
      confidence: overallConfidence,
      evidence: evidenceList,
      generatedAt: new Date(),
      scope: request.context.scope,
    });
  }
}

export class FollowUpPrioritizationEngine implements BrainEngine {
  public async analyze(
    request: BrainAnalysisRequest,
    _options?: BrainEngineOptions,
  ): Promise<BrainResult> {
    if (request.analysisType !== "FOLLOW_UP_PRIORITIZATION") {
      throw new BrainDomainError(
        "UNSUPPORTED_ANALYSIS",
        `FollowUpPrioritizationEngine does not support ${request.analysisType}`,
      );
    }

    const timelines = request.context.timelines;
    if (timelines.length === 0) {
      throw new BrainDomainError(
        "INSUFFICIENT_CONTEXT",
        "Follow-up prioritization requires at least one timeline signal.",
      );
    }

    const sorted = [...timelines].sort((a, b) => {
      const timeA = a.latestEventAt ? a.latestEventAt.getTime() : 0;
      const timeB = b.latestEventAt ? b.latestEventAt.getTime() : 0;
      return timeA - timeB;
    });

    const primaryTimeline = sorted[0]!;
    const matchingClient = request.context.clients.find(
      (c) => c.clientId === primaryTimeline.clientId,
    );

    const evidenceList: BrainEvidence[] = [
      new BrainEvidence({
        sourceType: "TIMELINE_SIGNAL",
        sourceId: primaryTimeline.signalId,
        label: `Timeline: ${primaryTimeline.timelineId}`,
        excerpt: primaryTimeline.latestEventAt
          ? `Last event: ${primaryTimeline.latestEventAt.toISOString()}`
          : `Event count: ${primaryTimeline.eventCount}`,
      }),
    ];

    if (matchingClient) {
      evidenceList.push(
        new BrainEvidence({
          sourceType: "CLIENT_SIGNAL",
          sourceId: matchingClient.signalId,
          label: `Client: ${matchingClient.name ?? matchingClient.clientId}`,
          excerpt: matchingClient.status ? `Status: ${matchingClient.status}` : undefined,
        }),
      );
    }

    const insights: BrainInsightProperties[] = [];

    const now = Date.now();
    const daysSinceLatest = primaryTimeline.latestEventAt
      ? Math.max(
          0,
          Math.floor((now - primaryTimeline.latestEventAt.getTime()) / (1000 * 60 * 60 * 24)),
        )
      : 0;

    const urgencyLevel: BrainConfidenceLevel =
      daysSinceLatest > 7 || primaryTimeline.eventCount <= 1
        ? "HIGH"
        : daysSinceLatest > 3
          ? "MEDIUM"
          : "LOW";

    insights.push({
      insightId: `insight-recency-${primaryTimeline.timelineId}`,
      title: `Recency & Inactivity Analysis for Timeline ${primaryTimeline.timelineId}`,
      body: primaryTimeline.latestEventAt
        ? `Last recorded activity was ${daysSinceLatest} day(s) ago (${primaryTimeline.eventCount} total events recorded).`
        : `Timeline contains ${primaryTimeline.eventCount} recorded lifecycle events.`,
      confidence: new BrainConfidence({
        score: primaryTimeline.latestEventAt ? 0.9 : 0.7,
        level: primaryTimeline.latestEventAt ? "HIGH" : "MEDIUM",
        supportingSignalCount: evidenceList.length,
      }),
      evidence: evidenceList,
    });

    if (matchingClient) {
      insights.push({
        insightId: `insight-client-status-${matchingClient.clientId}`,
        title: `Associated Client Status: ${matchingClient.name ?? matchingClient.clientId}`,
        body: `Client ${matchingClient.name ?? matchingClient.clientId} is currently marked as ${matchingClient.status ?? "ACTIVE"}. Timely re-engagement preserves account momentum.`,
        confidence: new BrainConfidence({
          score: 0.85,
          level: "HIGH",
          supportingSignalCount: 1,
        }),
        evidence: [evidenceList[1] ?? evidenceList[0]!],
      });
    }

    const recommendations: BrainRecommendationProperties[] = [];

    recommendations.push({
      recommendationId: `rec-followup-${primaryTimeline.timelineId}`,
      action: matchingClient?.name
        ? `Initiate proactive follow-up with ${matchingClient.name}`
        : `Initiate proactive follow-up on timeline ${primaryTimeline.timelineId}`,
      rationale:
        "Prompt cadence prevents communication stalls and clarifies current milestone state.",
      priority: urgencyLevel === "HIGH" ? "HIGH" : "MEDIUM",
      evidence: evidenceList,
    });

    recommendations.push({
      recommendationId: `rec-review-${primaryTimeline.timelineId}`,
      action: "Review open proposals and pending milestone deliverables",
      rationale: "Ensures alignment with latest contractual obligations before reaching out.",
      priority: "MEDIUM",
      evidence: [evidenceList[0]!],
    });

    const maxInsights = request.constraints.maxInsights ?? 5;
    const maxRecs = request.constraints.maxRecommendations ?? 5;

    const finalInsights = insights.slice(0, maxInsights);
    const finalRecs = recommendations.slice(0, maxRecs);

    const overallConfidence = new BrainConfidence({
      score: primaryTimeline.latestEventAt ? 0.85 : 0.75,
      level: primaryTimeline.latestEventAt ? "HIGH" : "MEDIUM",
      supportingSignalCount: request.context.signalCount,
    });

    return new BrainResult({
      analysisId: request.metadata.requestId,
      analysisType: "FOLLOW_UP_PRIORITIZATION",
      status: "COMPLETED",
      summary: `Follow-up prioritization completed for timeline ${primaryTimeline.timelineId}. ${finalInsights.length} insights and ${finalRecs.length} recommendations generated.`,
      insights: finalInsights,
      recommendations: finalRecs,
      confidence: overallConfidence,
      evidence: evidenceList,
      generatedAt: new Date(),
      scope: request.context.scope,
    });
  }
}

export class HeuristicBrainEngine implements BrainEngine {
  private readonly _opportunityReviewEngine = new OpportunityReviewEngine();
  private readonly _followUpEngine = new FollowUpPrioritizationEngine();

  public async analyze(
    request: BrainAnalysisRequest,
    options: BrainEngineOptions,
  ): Promise<BrainResult> {
    if (request.analysisType === "OPPORTUNITY_REVIEW") {
      return this._opportunityReviewEngine.analyze(request, options);
    }

    if (request.analysisType === "FOLLOW_UP_PRIORITIZATION") {
      return this._followUpEngine.analyze(request, options);
    }

    if (request.analysisType === "CLIENT_HEALTH") {
      const clients = request.context.clients;
      if (clients.length === 0) {
        throw new BrainDomainError(
          "INSUFFICIENT_CONTEXT",
          "Client health analysis requires client signals.",
        );
      }
      const client = clients[0]!;
      const evidence = [
        new BrainEvidence({
          sourceType: "CLIENT_SIGNAL",
          sourceId: client.signalId,
          label: `Client: ${client.name ?? client.clientId}`,
        }),
      ];
      const confidence = new BrainConfidence({
        score: 0.85,
        level: "HIGH",
        supportingSignalCount: 1,
      });
      return new BrainResult({
        analysisId: request.metadata.requestId,
        analysisType: "CLIENT_HEALTH",
        status: "COMPLETED",
        summary: `Client health evaluation for ${client.name ?? client.clientId}: Stable and active.`,
        insights: [
          {
            insightId: `insight-health-${client.clientId}`,
            title: "Engagement Health",
            body: `Client ${client.name ?? client.clientId} is in ${client.status ?? "ACTIVE"} status with positive historical cadence.`,
            confidence,
            evidence,
          },
        ],
        recommendations: [
          {
            recommendationId: `rec-checkin-${client.clientId}`,
            action: "Schedule periodic touchpoint to review upcoming deliverables",
            rationale: "Maintains high client satisfaction and expands account surface.",
            priority: "MEDIUM",
            evidence,
          },
        ],
        confidence,
        evidence,
        generatedAt: new Date(),
        scope: request.context.scope,
      });
    }

    throw new BrainDomainError(
      "UNSUPPORTED_ANALYSIS",
      `Unsupported Brain analysis type: ${request.analysisType}`,
    );
  }
}

export interface BoundedClient {
  readonly id: string;
  readonly name?: string;
  readonly status?: string;
  readonly profile?: { readonly name?: string };
}

export interface BoundedJob {
  readonly id: string;
  readonly title?: string;
  readonly source?: string;
  readonly requiredSkills?: readonly string[];
  readonly rawPayload?: {
    readonly data?: {
      readonly title?: string;
      readonly skills?: readonly string[];
    };
  };
  readonly externalIdentity?: {
    readonly source?: {
      readonly value?: string;
    };
  };
}

export interface BoundedMatch {
  readonly id: string;
  readonly jobId?: string;
  readonly score?: number;
  readonly matchSignals?: {
    readonly semanticSimilarity?: number;
    readonly matchedSkills?: readonly string[];
  };
  readonly strengths?: readonly string[];
  readonly risks?: readonly string[];
}

export interface BoundedTimelineEntry {
  readonly timestamp: Date | string | number;
}

export interface BoundedTimeline {
  readonly id?: string;
  readonly timelineId?: string;
  readonly clientId?: string;
  readonly entries?: readonly BoundedTimelineEntry[];
}

export interface BoundedClientRepository {
  findById(clientId: string, ownerId: string): Promise<BoundedClient | null>;
}

export interface BoundedJobsRepository {
  findById(jobId: string, tenantId: string): Promise<BoundedJob | null>;
}

export interface BoundedMatchRepository {
  findById(matchId: string, tenantId: string): Promise<BoundedMatch | null>;
}

export interface BoundedTimelineRepository {
  findById(timelineId: string, ownerId: string): Promise<BoundedTimeline | null>;
}

export interface BrainOrchestratorRepositories {
  readonly clientRepo?: BoundedClientRepository;
  readonly jobsRepo?: BoundedJobsRepository;
  readonly matchRepo?: BoundedMatchRepository;
  readonly timelineRepo?: BoundedTimelineRepository;
}

export interface OrchestrateContextInput {
  readonly analysisType: BrainAnalysisType | string;
  readonly scope: BrainScope;
  readonly clientIds?: readonly string[];
  readonly jobIds?: readonly string[];
  readonly matchIds?: readonly string[];
  readonly timelineIds?: readonly string[];
  readonly businessSignals?: readonly {
    readonly metric: string;
    readonly value: number;
    readonly unit?: string | undefined;
  }[];
}

export class BrainContextOrchestrator {
  private readonly _repos: BrainOrchestratorRepositories;

  constructor(repositories: BrainOrchestratorRepositories) {
    this._repos = repositories;
  }

  public async buildContext(input: OrchestrateContextInput): Promise<BrainContext> {
    const scope = input.scope;
    const analysisType =
      typeof input.analysisType === "string"
        ? parseBrainAnalysisType(input.analysisType)
        : input.analysisType;

    const clients: ClientSignalProperties[] = [];
    const jobs: JobSignalProperties[] = [];
    const matches: MatchSignalProperties[] = [];
    const timelines: TimelineSignalProperties[] = [];
    const businessSignals: BusinessSignalProperties[] = (input.businessSignals ?? []).map(
      (s, idx) => ({
        signalId: `business-${idx + 1}`,
        tenantId: scope.tenantId,
        ownerId: scope.ownerId,
        metric: s.metric,
        value: s.value,
        unit: s.unit,
      }),
    );

    if (input.clientIds && input.clientIds.length > 0 && this._repos.clientRepo) {
      for (const clientId of input.clientIds) {
        const client = await this._repos.clientRepo.findById(clientId, scope.ownerId);
        if (!client) {
          throw new BrainDomainError(
            "INVALID_REQUEST",
            `Referenced client not found: ${clientId}`,
            404,
          );
        }
        clients.push({
          signalId: `client-${client.id}`,
          tenantId: scope.tenantId,
          ownerId: scope.ownerId,
          clientId: client.id,
          name: client.profile?.name ?? client.name,
          status: client.status,
        });
      }
    }

    if (input.jobIds && input.jobIds.length > 0 && this._repos.jobsRepo) {
      for (const jobId of input.jobIds) {
        const job = await this._repos.jobsRepo.findById(jobId, scope.ownerId);
        if (!job) {
          throw new BrainDomainError("INVALID_REQUEST", `Referenced job not found: ${jobId}`, 404);
        }
        jobs.push({
          signalId: `job-${job.id}`,
          tenantId: scope.tenantId,
          ownerId: scope.ownerId,
          jobId: job.id,
          title: job.rawPayload?.data?.title ?? job.title,
          source: job.externalIdentity?.source?.value ?? job.source ?? "DIRECT",
          requiredSkills: Array.isArray(job.rawPayload?.data?.skills)
            ? job.rawPayload.data.skills
            : Array.isArray(job.requiredSkills)
              ? job.requiredSkills
              : [],
        });
      }
    }

    if (input.matchIds && input.matchIds.length > 0 && this._repos.matchRepo) {
      for (const matchId of input.matchIds) {
        const match = await this._repos.matchRepo.findById(matchId, scope.ownerId);
        if (!match) {
          throw new BrainDomainError(
            "INVALID_REQUEST",
            `Referenced match not found: ${matchId}`,
            404,
          );
        }
        matches.push({
          signalId: `match-${match.id}`,
          tenantId: scope.tenantId,
          ownerId: scope.ownerId,
          matchId: match.id,
          jobId: match.jobId ?? match.id,
          score:
            typeof match.matchSignals?.semanticSimilarity === "number"
              ? match.matchSignals.semanticSimilarity
              : typeof match.score === "number"
                ? match.score
                : undefined,
          strengths: Array.isArray(match.matchSignals?.matchedSkills)
            ? match.matchSignals.matchedSkills
            : Array.isArray(match.strengths)
              ? match.strengths
              : [],
          risks: Array.isArray(match.risks) ? match.risks : [],
        });
      }
    }

    if (input.timelineIds && input.timelineIds.length > 0 && this._repos.timelineRepo) {
      for (const timelineId of input.timelineIds) {
        const timeline = await this._repos.timelineRepo.findById(timelineId, scope.ownerId);
        if (!timeline) {
          throw new BrainDomainError(
            "INVALID_REQUEST",
            `Referenced timeline not found: ${timelineId}`,
            404,
          );
        }
        const entries = Array.isArray(timeline.entries) ? timeline.entries : [];
        const latest = [...entries].sort((a, b) => {
          const tA =
            a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
          const tB =
            b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
          return tB - tA;
        })[0];
        timelines.push({
          signalId: `timeline-${timeline.timelineId ?? timeline.id ?? timelineId}`,
          tenantId: scope.tenantId,
          ownerId: scope.ownerId,
          timelineId: timeline.timelineId ?? timeline.id ?? timelineId,
          clientId: timeline.clientId,
          eventCount: entries.length,
          latestEventAt: latest?.timestamp
            ? latest.timestamp instanceof Date
              ? latest.timestamp
              : new Date(latest.timestamp)
            : undefined,
        });
      }
    }

    const context = new BrainContext({ scope, clients, jobs, matches, timelines, businessSignals });
    context.ensureSufficientFor(analysisType);
    return context;
  }
}

export type BrainFreshness = "FRESH" | "STALE";

export type ClientHealthDecisionStatus = "HEALTHY" | "NEEDS_ATTENTION" | "AT_RISK";

export interface ClientHealthDecision {
  readonly analysisId: string;
  readonly decisionType: "CLIENT_HEALTH";
  readonly status: ClientHealthDecisionStatus;
  readonly priority: "HIGH" | "MEDIUM" | "LOW";
  readonly reason: string;
  readonly confidence: BrainConfidence;
  readonly freshness: BrainFreshness;
  readonly evidence: readonly BrainEvidence[];
  readonly derivedAt: Date;
}

export type OpportunityDecisionStatus =
  | "STRONG_OPPORTUNITY"
  | "REVIEW_REQUIRED"
  | "WEAK_OPPORTUNITY";

export interface OpportunityDecision {
  readonly analysisId: string;
  readonly decisionType: "OPPORTUNITY_REVIEW";
  readonly status: OpportunityDecisionStatus;
  readonly priority: "HIGH" | "MEDIUM" | "LOW";
  readonly reason: string;
  readonly confidence: BrainConfidence;
  readonly freshness: BrainFreshness;
  readonly evidence: readonly BrainEvidence[];
  readonly derivedAt: Date;
}

export interface FollowUpDecision {
  readonly analysisId: string;
  readonly decisionType: "FOLLOW_UP_PRIORITIZATION";
  readonly priority: "HIGH" | "MEDIUM" | "LOW";
  readonly reason: string;
  readonly confidence: BrainConfidence;
  readonly freshness: BrainFreshness;
  readonly evidence: readonly BrainEvidence[];
  readonly derivedAt: Date;
}

export type BrainDecision = ClientHealthDecision | OpportunityDecision | FollowUpDecision;

export interface DecisionDerivationOptions {
  readonly maxAgeMs?: number | undefined;
  readonly now?: Date | undefined;
}

export class BrainDecisionDeriver {
  public static readonly DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

  public deriveClientHealthDecision(
    result: BrainResult,
    options?: DecisionDerivationOptions,
  ): ClientHealthDecision {
    this.assertCompleted(result, "CLIENT_HEALTH");

    const freshness = this.computeFreshness(result.generatedAt, options);
    const confidence = result.confidence;
    const evidence = result.evidence;

    const hasHighRec = result.recommendations.some((r) => r.priority === "HIGH");
    const hasMediumRec = result.recommendations.some((r) => r.priority === "MEDIUM");
    const insightsBody = result.insights.map((i) => i.body.toLowerCase()).join(" ");

    let status: ClientHealthDecisionStatus = "HEALTHY";
    let priority: "HIGH" | "MEDIUM" | "LOW" = "LOW";

    if (
      insightsBody.includes("inactive") ||
      insightsBody.includes("stalled") ||
      insightsBody.includes("at-risk") ||
      insightsBody.includes("at risk")
    ) {
      status = "AT_RISK";
      priority = "HIGH";
    } else if (hasHighRec || hasMediumRec || insightsBody.includes("attention")) {
      status = "NEEDS_ATTENTION";
      priority = hasHighRec ? "HIGH" : "MEDIUM";
    } else {
      status = "HEALTHY";
      priority = "LOW";
    }

    const reason = result.summary || `Client health evaluated as ${status}.`;

    return Object.freeze({
      analysisId: result.analysisId,
      decisionType: "CLIENT_HEALTH",
      status,
      priority,
      reason,
      confidence,
      freshness,
      evidence,
      derivedAt: options?.now ?? new Date(),
    });
  }

  public deriveOpportunityDecision(
    result: BrainResult,
    options?: DecisionDerivationOptions,
  ): OpportunityDecision {
    this.assertCompleted(result, "OPPORTUNITY_REVIEW");

    const freshness = this.computeFreshness(result.generatedAt, options);
    const confidence = result.confidence;
    const evidence = result.evidence;

    let status: OpportunityDecisionStatus = "REVIEW_REQUIRED";
    let priority: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";

    if (confidence.level === "HIGH" && confidence.score >= 0.75) {
      status = "STRONG_OPPORTUNITY";
      priority = "HIGH";
    } else if (confidence.level === "LOW" || confidence.score < 0.5) {
      status = "WEAK_OPPORTUNITY";
      priority = "LOW";
    } else {
      status = "REVIEW_REQUIRED";
      priority = "MEDIUM";
    }

    const reason = result.summary || `Opportunity assessment derived as ${status}.`;

    return Object.freeze({
      analysisId: result.analysisId,
      decisionType: "OPPORTUNITY_REVIEW",
      status,
      priority,
      reason,
      confidence,
      freshness,
      evidence,
      derivedAt: options?.now ?? new Date(),
    });
  }

  public deriveFollowUpDecision(
    result: BrainResult,
    options?: DecisionDerivationOptions,
  ): FollowUpDecision {
    this.assertCompleted(result, "FOLLOW_UP_PRIORITIZATION");

    const freshness = this.computeFreshness(result.generatedAt, options);
    const confidence = result.confidence;
    const evidence = result.evidence;

    const highestRecPriority = result.recommendations.reduce<"HIGH" | "MEDIUM" | "LOW">(
      (highest, rec) => {
        if (rec.priority === "HIGH" || highest === "HIGH") {
          return "HIGH";
        }
        if (rec.priority === "MEDIUM" || highest === "MEDIUM") {
          return "MEDIUM";
        }
        return "LOW";
      },
      "LOW",
    );

    const reason =
      result.summary || `Follow-up prioritization derived with ${highestRecPriority} priority.`;

    return Object.freeze({
      analysisId: result.analysisId,
      decisionType: "FOLLOW_UP_PRIORITIZATION",
      priority: highestRecPriority,
      reason,
      confidence,
      freshness,
      evidence,
      derivedAt: options?.now ?? new Date(),
    });
  }

  public derive(result: BrainResult, options?: DecisionDerivationOptions): BrainDecision {
    if (result.analysisType === "CLIENT_HEALTH") {
      return this.deriveClientHealthDecision(result, options);
    }
    if (result.analysisType === "OPPORTUNITY_REVIEW") {
      return this.deriveOpportunityDecision(result, options);
    }
    if (result.analysisType === "FOLLOW_UP_PRIORITIZATION") {
      return this.deriveFollowUpDecision(result, options);
    }
    throw new BrainDomainError(
      "UNSUPPORTED_ANALYSIS",
      `Cannot derive decision for analysis type: ${result.analysisType}`,
    );
  }

  private assertCompleted(result: BrainResult, expectedType: BrainAnalysisType): void {
    if (result.analysisType !== expectedType) {
      throw new BrainDomainError(
        "INVALID_REQUEST",
        `Expected ${expectedType} analysis result, got ${result.analysisType}`,
      );
    }
    if (result.status !== "COMPLETED") {
      throw new BrainDomainError(
        "INVALID_REQUEST",
        `Cannot derive decision from analysis with status ${result.status}. Only COMPLETED analyses produce decisions.`,
      );
    }
  }

  private computeFreshness(generatedAt: Date, options?: DecisionDerivationOptions): BrainFreshness {
    const maxAgeMs = options?.maxAgeMs ?? BrainDecisionDeriver.DEFAULT_MAX_AGE_MS;
    const nowMs = (options?.now ?? new Date()).getTime();
    const elapsed = nowMs - generatedAt.getTime();
    return elapsed > maxAgeMs ? "STALE" : "FRESH";
  }
}
