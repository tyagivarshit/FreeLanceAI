// ============================================================================
// FreelanceOS - Phase 11D-6 Timeline Search Domain Implementation
// ============================================================================
import { AuthorizedSearchScope, SearchQuery, SearchResult, SearchResultSet, SearchDomainError, DEFAULT_SEARCH_PAGE, DEFAULT_SEARCH_PAGE_SIZE, MAX_SEARCH_PAGE_SIZE, } from "./search.js";
// ----------------------------------------------------------------------------
// Canonical Result Mapping
// ----------------------------------------------------------------------------
/**
 * Maps a raw/persisted timeline search record to the canonical SearchResult DTO.
 * Excludes internal DB metadata, tenant IDs, owner IDs, and credentials.
 */
export function mapTimelineEntryToSearchResult(item, queryText) {
    const matchedFields = [];
    const q = queryText.toLowerCase().trim();
    const categoryLower = item.category.toLowerCase();
    const eventRefLower = item.eventRef?.toLowerCase();
    const actorRefLower = item.actorRef.toLowerCase();
    const visibilityLower = item.visibility.toLowerCase();
    const metadataLower = item.metadataSummary?.toLowerCase();
    let score = 0.5;
    if (categoryLower === q) {
        matchedFields.push("category");
        score = 1.0;
    }
    else if (categoryLower.includes(q)) {
        matchedFields.push("category");
        score = 0.9;
    }
    if (eventRefLower && eventRefLower === q) {
        matchedFields.push("eventRef");
        score = Math.max(score, 1.0);
    }
    else if (eventRefLower && eventRefLower.includes(q)) {
        matchedFields.push("eventRef");
        score = Math.max(score, 0.9);
    }
    if (actorRefLower === q || actorRefLower.includes(q)) {
        matchedFields.push("actorRef");
        score = Math.max(score, 0.85);
    }
    if (visibilityLower === q || visibilityLower.includes(q)) {
        matchedFields.push("visibility");
        score = Math.max(score, 0.85);
    }
    if (metadataLower && metadataLower.includes(q)) {
        matchedFields.push("metadata");
        score = Math.max(score, 0.8);
    }
    if (item.clientId.toLowerCase().includes(q)) {
        matchedFields.push("clientId");
        score = Math.max(score, 0.75);
    }
    if (item.id.toLowerCase().includes(q)) {
        matchedFields.push("id");
        score = Math.max(score, 0.75);
    }
    // Safe display formatting
    const formattedDate = item.timestamp.toISOString().split("T")[0];
    const title = `${item.category} • ${formattedDate}`;
    const subtitleParts = [item.visibility, `Actor: ${item.actorRef}`];
    if (item.eventRef) {
        subtitleParts.push(`Ref: ${item.eventRef}`);
    }
    const subtitle = subtitleParts.join(" • ");
    const snippet = item.metadataSummary
        ? item.metadataSummary.length > 150
            ? `${item.metadataSummary.slice(0, 147)}...`
            : item.metadataSummary
        : undefined;
    return new SearchResult({
        resultType: "TIMELINE",
        entityId: item.id,
        display: {
            title,
            subtitle,
            ...(snippet !== undefined ? { snippet } : {}),
        },
        relevance: {
            score: Math.round(score * 100) / 100,
            matchedFields: matchedFields.length > 0 ? matchedFields : ["category"],
        },
    });
}
// ----------------------------------------------------------------------------
// Timeline Search Engine
// ----------------------------------------------------------------------------
export class TimelineSearchEngine {
    _repository;
    constructor(repository) {
        if (!repository || typeof repository.searchTimeline !== "function") {
            throw new SearchDomainError("INVALID_SEARCH_REQUEST", "TimelineSearchRepository implementation is required.");
        }
        this._repository = repository;
    }
    async search(query, scope) {
        if (!query || !(query instanceof SearchQuery)) {
            throw new SearchDomainError("INVALID_SEARCH_REQUEST", "Valid SearchQuery is required.");
        }
        if (!scope || !(scope instanceof AuthorizedSearchScope)) {
            throw new SearchDomainError("UNAUTHORIZED_SCOPE", "AuthorizedSearchScope is required.");
        }
        // Fast path: if query restricts resultTypes and "TIMELINE" is not included, return empty result set
        if (query.hasTypeFilter() && !query.includesType("TIMELINE")) {
            return new SearchResultSet({
                results: [],
                total: 0,
                page: query.page,
                pageSize: query.pageSize,
            });
        }
        try {
            const searchResultList = await this._repository.searchTimeline(query.query, scope, query.page, query.pageSize);
            const results = searchResultList.items.map((item) => mapTimelineEntryToSearchResult(item, query.query));
            return new SearchResultSet({
                results,
                total: searchResultList.total,
                page: searchResultList.page,
                pageSize: searchResultList.pageSize,
            });
        }
        catch (error) {
            if (error instanceof SearchDomainError) {
                throw error;
            }
            throw new SearchDomainError("SEARCH_PROVIDER_ERROR", "Timeline search failed.");
        }
    }
}
export class InMemoryTimelineSearchRepository {
    _records = [];
    constructor(initialRecords = []) {
        this._records = [...initialRecords];
    }
    addTimelineEntry(record) {
        this._records.push({ ...record });
    }
    async searchTimeline(queryText, scope, page = DEFAULT_SEARCH_PAGE, pageSize = DEFAULT_SEARCH_PAGE_SIZE) {
        const q = queryText.toLowerCase().trim();
        // Enforce tenant and owner isolation authoritative boundary
        const scoped = this._records.filter((r) => scope.matchesTenant(r.tenantId) && scope.matchesOwner(r.ownerId));
        // Case-insensitive matching on supported timeline fields
        const matched = scoped.filter((r) => {
            const categoryMatch = r.category.toLowerCase().includes(q);
            const eventRefMatch = r.eventRef ? r.eventRef.toLowerCase().includes(q) : false;
            const actorRefMatch = r.actorRef.toLowerCase().includes(q);
            const visibilityMatch = r.visibility.toLowerCase().includes(q);
            const idMatch = r.id.toLowerCase().includes(q);
            const timelineIdMatch = r.timelineId.toLowerCase().includes(q);
            const clientIdMatch = r.clientId.toLowerCase().includes(q);
            let metadataMatch = false;
            if (r.metadata) {
                const metadataString = JSON.stringify(r.metadata).toLowerCase();
                metadataMatch = metadataString.includes(q);
            }
            return (categoryMatch ||
                eventRefMatch ||
                actorRefMatch ||
                visibilityMatch ||
                idMatch ||
                timelineIdMatch ||
                clientIdMatch ||
                metadataMatch);
        });
        // Deterministic ordering: timestamp DESC, then id DESC
        matched.sort((a, b) => {
            const timeDiff = b.timestamp.getTime() - a.timestamp.getTime();
            if (timeDiff !== 0) {
                return timeDiff;
            }
            return b.id.localeCompare(a.id);
        });
        const total = matched.length;
        const boundedPage = Math.max(1, page);
        const boundedPageSize = Math.min(MAX_SEARCH_PAGE_SIZE, Math.max(1, pageSize));
        const offset = (boundedPage - 1) * boundedPageSize;
        const paged = matched.slice(offset, offset + boundedPageSize);
        const items = paged.map((r) => {
            let metadataSummary;
            if (r.metadata) {
                // Extract note, message, description, title, or stringified payload
                const rawNote = r.metadata.note ||
                    r.metadata.message ||
                    r.metadata.description ||
                    r.metadata.title ||
                    r.metadata.summary;
                if (typeof rawNote === "string") {
                    metadataSummary = rawNote;
                }
                else {
                    metadataSummary = Object.entries(r.metadata)
                        .filter(([_, v]) => typeof v === "string" || typeof v === "number")
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(", ");
                }
            }
            return {
                id: r.id,
                timelineId: r.timelineId,
                clientId: r.clientId,
                category: r.category,
                timestamp: r.timestamp,
                eventRef: r.eventRef,
                actorRef: r.actorRef,
                visibility: r.visibility,
                metadataSummary: metadataSummary || undefined,
                createdAt: r.createdAt,
            };
        });
        return {
            items,
            total,
            page: boundedPage,
            pageSize: boundedPageSize,
        };
    }
}
