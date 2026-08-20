import { eq, and, or, asc, desc, sql } from "drizzle-orm";
import { db } from "../client.js";
import { clientTimelines, timelineEntries } from "../schema/timeline.js";
import { clients } from "../schema/clients.js";
import {
  ClientTimeline,
  TimelineEntry,
  TimelineAggregateStore,
  AuthorizedSearchScope,
  SearchQuery,
  SearchResultSet,
  TimelineSearchEngine,
  DEFAULT_SEARCH_PAGE,
  DEFAULT_SEARCH_PAGE_SIZE,
  MAX_SEARCH_PAGE_SIZE,
  type TimelineSearchRepository,
  type TimelineSearchResultItem,
  type TimelineSearchResultList,
  type SearchProvider,
} from "@freelanceos/core";

export class PostgresTimelineRepository
  implements TimelineAggregateStore, TimelineSearchRepository, SearchProvider
{
  public async save(timeline: ClientTimeline): Promise<void> {
    await db.transaction(async (tx) => {
      // 1. Save parent client timeline record
      await tx
        .insert(clientTimelines)
        .values({
          id: timeline.timelineId,
          clientId: timeline.clientId,
          ownerId: timeline.ownerId,
          status: timeline.status,
          createdAt: timeline.createdAt,
          updatedAt: timeline.updatedAt,
        })
        .onConflictDoUpdate({
          target: [clientTimelines.id],
          set: {
            status: timeline.status,
            updatedAt: timeline.updatedAt,
          },
        });

      // 2. Save chronological child timeline entry records
      if (timeline.entries.length > 0) {
        const entriesValues = timeline.entries.map((entry) => ({
          id: entry.entryId,
          timelineId: timeline.timelineId,
          eventRef: entry.eventRef || null,
          category: entry.category,
          timestamp: entry.timestamp,
          metadata: entry.metadata,
          actorRef: entry.actorRef,
          visibility: entry.visibility,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        await tx.insert(timelineEntries).values(entriesValues).onConflictDoNothing();
      }
    });
  }

  public async findById(timelineId: string, ownerId: string): Promise<ClientTimeline | null> {
    const parent = await db
      .select()
      .from(clientTimelines)
      .where(and(eq(clientTimelines.id, timelineId), eq(clientTimelines.ownerId, ownerId)))
      .limit(1);

    if (parent.length === 0) {
      return null;
    }
    return this.loadTimelineWithEntries(parent[0]!);
  }

  public async findByClientId(clientId: string, ownerId: string): Promise<ClientTimeline | null> {
    const parent = await db
      .select()
      .from(clientTimelines)
      .where(and(eq(clientTimelines.clientId, clientId), eq(clientTimelines.ownerId, ownerId)))
      .limit(1);

    if (parent.length === 0) {
      return null;
    }
    return this.loadTimelineWithEntries(parent[0]!);
  }

  public async findTimelineEntriesByOwner(
    ownerId: string,
    options: {
      page: number;
      pageSize: number;
    },
  ): Promise<{ items: TimelineEntry[]; total: number }> {
    const offset = (options.page - 1) * options.pageSize;

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(timelineEntries)
      .innerJoin(clientTimelines, eq(timelineEntries.timelineId, clientTimelines.id))
      .where(eq(clientTimelines.ownerId, ownerId));

    const total = Number(countResult[0]?.count || 0);

    const rows = await db
      .select({
        id: timelineEntries.id,
        timelineId: timelineEntries.timelineId,
        eventRef: timelineEntries.eventRef,
        category: timelineEntries.category,
        timestamp: timelineEntries.timestamp,
        metadata: timelineEntries.metadata,
        actorRef: timelineEntries.actorRef,
        visibility: timelineEntries.visibility,
      })
      .from(timelineEntries)
      .innerJoin(clientTimelines, eq(timelineEntries.timelineId, clientTimelines.id))
      .where(eq(clientTimelines.ownerId, ownerId))
      .orderBy(desc(timelineEntries.timestamp), desc(timelineEntries.id))
      .limit(options.pageSize)
      .offset(offset);

    const items = rows.map(
      (row) =>
        new TimelineEntry({
          entryId: row.id,
          eventRef: row.eventRef || undefined,
          category: row.category,
          timestamp: row.timestamp,
          metadata: row.metadata as Record<string, unknown>,
          actorRef: row.actorRef,
          visibility: row.visibility,
        }),
    );

    return { items, total };
  }

  public async findTimelineEntriesByClientId(
    clientId: string,
    ownerId: string,
    options: {
      page: number;
      pageSize: number;
    },
  ): Promise<{
    timelineId: string | null;
    status: ClientTimeline["status"] | null;
    items: TimelineEntry[];
    total: number;
  }> {
    const parent = await db
      .select()
      .from(clientTimelines)
      .where(and(eq(clientTimelines.clientId, clientId), eq(clientTimelines.ownerId, ownerId)))
      .limit(1);

    if (parent.length === 0) {
      return { timelineId: null, status: null, items: [], total: 0 };
    }

    const offset = (options.page - 1) * options.pageSize;

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(timelineEntries)
      .where(eq(timelineEntries.timelineId, parent[0]!.id));

    const total = Number(countResult[0]?.count || 0);

    const rows = await db
      .select({
        id: timelineEntries.id,
        timelineId: timelineEntries.timelineId,
        eventRef: timelineEntries.eventRef,
        category: timelineEntries.category,
        timestamp: timelineEntries.timestamp,
        metadata: timelineEntries.metadata,
        actorRef: timelineEntries.actorRef,
        visibility: timelineEntries.visibility,
      })
      .from(timelineEntries)
      .where(eq(timelineEntries.timelineId, parent[0]!.id))
      .orderBy(desc(timelineEntries.timestamp), desc(timelineEntries.id))
      .limit(options.pageSize)
      .offset(offset);

    const items = rows.map(
      (row) =>
        new TimelineEntry({
          entryId: row.id,
          eventRef: row.eventRef || undefined,
          category: row.category,
          timestamp: row.timestamp,
          metadata: row.metadata as Record<string, unknown>,
          actorRef: row.actorRef,
          visibility: row.visibility,
        }),
    );

    return { timelineId: parent[0]!.id, status: parent[0]!.status, items, total };
  }

  public async searchTimeline(
    queryText: string,
    scope: AuthorizedSearchScope,
    page = DEFAULT_SEARCH_PAGE,
    pageSize = DEFAULT_SEARCH_PAGE_SIZE,
  ): Promise<TimelineSearchResultList> {
    const boundedPage = Math.max(1, page);
    const boundedPageSize = Math.min(MAX_SEARCH_PAGE_SIZE, Math.max(1, pageSize));
    const offset = (boundedPage - 1) * boundedPageSize;

    const normalizedQuery = queryText.trim().toLowerCase();
    const searchPattern = `%${normalizedQuery}%`;

    const scopeCondition = and(
      eq(clientTimelines.ownerId, scope.ownerId),
      eq(clients.tenantId, scope.tenantId),
    );

    const searchCondition = or(
      sql`lower(${timelineEntries.category}) LIKE ${searchPattern}`,
      sql`lower(${timelineEntries.eventRef}) LIKE ${searchPattern}`,
      sql`lower(${timelineEntries.actorRef}) LIKE ${searchPattern}`,
      sql`lower(${timelineEntries.visibility}) LIKE ${searchPattern}`,
      sql`cast(${timelineEntries.id} as text) LIKE ${searchPattern}`,
      sql`cast(${timelineEntries.timelineId} as text) LIKE ${searchPattern}`,
      sql`cast(${clientTimelines.clientId} as text) LIKE ${searchPattern}`,
      sql`lower(cast(${timelineEntries.metadata} as text)) LIKE ${searchPattern}`,
    );

    const whereClause = and(scopeCondition, searchCondition);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(timelineEntries)
      .innerJoin(clientTimelines, eq(timelineEntries.timelineId, clientTimelines.id))
      .innerJoin(clients, eq(clientTimelines.clientId, clients.id))
      .where(whereClause);

    const total = Number(countResult[0]?.count || 0);

    const rows = await db
      .select({
        id: timelineEntries.id,
        timelineId: timelineEntries.timelineId,
        clientId: clientTimelines.clientId,
        category: timelineEntries.category,
        timestamp: timelineEntries.timestamp,
        eventRef: timelineEntries.eventRef,
        actorRef: timelineEntries.actorRef,
        visibility: timelineEntries.visibility,
        metadata: timelineEntries.metadata,
        createdAt: timelineEntries.createdAt,
      })
      .from(timelineEntries)
      .innerJoin(clientTimelines, eq(timelineEntries.timelineId, clientTimelines.id))
      .innerJoin(clients, eq(clientTimelines.clientId, clients.id))
      .where(whereClause)
      .orderBy(desc(timelineEntries.timestamp), desc(timelineEntries.id))
      .limit(boundedPageSize)
      .offset(offset);

    const items: TimelineSearchResultItem[] = rows.map((row) => {
      const meta = (row.metadata as Record<string, unknown>) || {};
      const rawNote = meta.note || meta.message || meta.description || meta.title || meta.summary;
      let metadataSummary: string | undefined;
      if (typeof rawNote === "string") {
        metadataSummary = rawNote;
      } else if (Object.keys(meta).length > 0) {
        metadataSummary = Object.entries(meta)
          .filter(([_, v]) => typeof v === "string" || typeof v === "number")
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ");
      }

      return {
        id: row.id,
        timelineId: row.timelineId,
        clientId: row.clientId,
        category: row.category,
        timestamp: row.timestamp,
        eventRef: row.eventRef || undefined,
        actorRef: row.actorRef,
        visibility: row.visibility,
        metadataSummary: metadataSummary || undefined,
        createdAt: row.createdAt,
      };
    });

    return {
      items,
      total,
      page: boundedPage,
      pageSize: boundedPageSize,
    };
  }

  public async search(query: SearchQuery, scope: AuthorizedSearchScope): Promise<SearchResultSet> {
    const engine = new TimelineSearchEngine(this);
    return engine.search(query, scope);
  }

  private async loadTimelineWithEntries(
    parent: typeof clientTimelines.$inferSelect,
  ): Promise<ClientTimeline> {
    const entriesRows = await db
      .select()
      .from(timelineEntries)
      .where(eq(timelineEntries.timelineId, parent.id))
      .orderBy(asc(timelineEntries.timestamp));

    const entries = entriesRows.map(
      (row) =>
        new TimelineEntry({
          entryId: row.id,
          eventRef: row.eventRef || undefined,
          category: row.category,
          timestamp: row.timestamp,
          metadata: row.metadata as Record<string, unknown>,
          actorRef: row.actorRef,
          visibility: row.visibility,
        }),
    );

    return new ClientTimeline({
      timelineId: parent.id,
      clientId: parent.clientId,
      ownerId: parent.ownerId,
      status: parent.status,
      entries,
      createdAt: parent.createdAt,
      updatedAt: parent.updatedAt,
    });
  }
}
