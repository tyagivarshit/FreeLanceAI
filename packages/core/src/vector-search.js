import { EmbeddingReference, EmbeddingVector } from "./embedding.js";
// 1. Query Embedding
export class QueryEmbedding {
    _reference;
    _vector;
    constructor(source) {
        if (!source) {
            throw new Error("Query embedding source is required.");
        }
        if (source instanceof EmbeddingReference) {
            this._reference = source;
        }
        else if (source instanceof EmbeddingVector) {
            this._vector = source;
        }
        else {
            throw new Error("Invalid query embedding source type.");
        }
        Object.freeze(this);
    }
    get reference() {
        return this._reference;
    }
    get vector() {
        return this._vector;
    }
    equals(other) {
        if (!other) {
            return false;
        }
        if (this._reference && other.reference) {
            return this._reference.equals(other.reference);
        }
        if (this._vector && other.vector) {
            return this._vector.equals(other.vector);
        }
        return false;
    }
}
export class SearchScope {
    _clientReference;
    _ownerReference;
    _sourceReference;
    _embeddingSpace;
    _classification;
    constructor(properties) {
        const pattern = /^[a-z0-9]+([.-][a-z0-9]+)*$/;
        if (properties.clientReference) {
            const clean = properties.clientReference.trim();
            if (!pattern.test(clean)) {
                throw new Error("Invalid client reference format in search scope.");
            }
            this._clientReference = clean;
        }
        if (properties.ownerReference) {
            const clean = properties.ownerReference.trim();
            if (!pattern.test(clean)) {
                throw new Error("Invalid owner reference format in search scope.");
            }
            this._ownerReference = clean;
        }
        if (properties.sourceReference) {
            const clean = properties.sourceReference.trim();
            if (!pattern.test(clean)) {
                throw new Error("Invalid source reference format in search scope.");
            }
            this._sourceReference = clean;
        }
        if (properties.embeddingSpace) {
            const clean = properties.embeddingSpace.trim();
            if (!pattern.test(clean)) {
                throw new Error("Invalid embedding space format in search scope.");
            }
            this._embeddingSpace = clean;
        }
        if (properties.classification) {
            const clean = properties.classification.trim();
            if (!pattern.test(clean)) {
                throw new Error("Invalid classification format in search scope.");
            }
            this._classification = clean;
        }
        Object.freeze(this);
    }
    get clientReference() {
        return this._clientReference;
    }
    get ownerReference() {
        return this._ownerReference;
    }
    get sourceReference() {
        return this._sourceReference;
    }
    get embeddingSpace() {
        return this._embeddingSpace;
    }
    get classification() {
        return this._classification;
    }
}
// 3. Search Filters
export class SearchFilter {
    _scope;
    constructor(scope) {
        if (!scope) {
            throw new Error("Search scope is required for filtering.");
        }
        this._scope = scope;
        Object.freeze(this);
    }
    get scope() {
        return this._scope;
    }
}
export class SimilarityMetric {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Similarity metric is required.");
        }
        const cleanValue = value.trim().toLowerCase();
        let matched;
        if (cleanValue === "cosine") {
            matched = "Cosine";
        }
        else if (cleanValue === "dotproduct" ||
            cleanValue === "dot_product" ||
            cleanValue === "dot-product") {
            matched = "DotProduct";
        }
        else if (cleanValue === "euclidean") {
            matched = "Euclidean";
        }
        else {
            throw new Error(`Unsupported similarity metric: ${value}`);
        }
        this._value = matched;
        Object.freeze(this);
    }
    get value() {
        return this._value;
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return this._value === other.value;
    }
}
// 5. Similarity Score
export class SimilarityScore {
    _value;
    constructor(value) {
        if (typeof value !== "number" || !Number.isFinite(value) || Number.isNaN(value)) {
            throw new Error("Similarity score must be a finite number.");
        }
        this._value = value;
        Object.freeze(this);
    }
    get value() {
        return this._value;
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return this._value === other.value;
    }
}
// 6. Search Limit
export class SearchLimit {
    _value;
    constructor(value) {
        if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
            throw new Error("Search limit must be a positive integer.");
        }
        this._value = value;
        Object.freeze(this);
    }
    get value() {
        return this._value;
    }
}
export class SearchCandidate {
    _embeddingReference;
    _sourceReference;
    _similarityScore;
    constructor(properties) {
        if (!properties.embeddingReference) {
            throw new Error("Embedding reference is required.");
        }
        if (!properties.sourceReference) {
            throw new Error("Source reference is required.");
        }
        if (!properties.similarityScore) {
            throw new Error("Similarity score is required.");
        }
        this._embeddingReference = properties.embeddingReference;
        this._sourceReference = properties.sourceReference;
        this._similarityScore = properties.similarityScore;
        Object.freeze(this);
    }
    get embeddingReference() {
        return this._embeddingReference;
    }
    get sourceReference() {
        return this._sourceReference;
    }
    get similarityScore() {
        return this._similarityScore;
    }
}
// 8. Search Result
export class VectorSearchResult {
    _candidates;
    constructor(candidates) {
        if (!candidates) {
            throw new Error("Candidates array is required.");
        }
        this._candidates = [...candidates];
        Object.freeze(this._candidates);
        Object.freeze(this);
    }
    get candidates() {
        return Object.freeze([...this._candidates]);
    }
}
export class VectorSearchRequest {
    _queryEmbedding;
    _scope;
    _filter;
    _similarityMetric;
    _limit;
    constructor(properties) {
        if (!properties.queryEmbedding) {
            throw new Error("Query embedding is required.");
        }
        if (!properties.similarityMetric) {
            throw new Error("Similarity metric is required.");
        }
        if (!properties.limit) {
            throw new Error("Search limit is required.");
        }
        this._queryEmbedding = properties.queryEmbedding;
        this._scope = properties.scope;
        this._filter = properties.filter;
        this._similarityMetric = properties.similarityMetric;
        this._limit = properties.limit;
        Object.freeze(this);
    }
    get queryEmbedding() {
        return this._queryEmbedding;
    }
    get scope() {
        return this._scope;
    }
    get filter() {
        return this._filter;
    }
    get similarityMetric() {
        return this._similarityMetric;
    }
    get limit() {
        return this._limit;
    }
}
