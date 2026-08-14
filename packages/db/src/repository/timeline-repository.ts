import { eq, and, asc, desc, sql } from "drizzle-orm";
import { db } from "../client.js";
import { clientTimelines, timelineEntries } from "../schema/timeline.js";
import { ClientTimeline, TimelineEntry, TimelineAggregateStore } from "@freelanceos/core";

export class PostgresTimelineRepository implements TimelineAggregateStore {
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
