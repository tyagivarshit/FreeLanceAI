import { db, jobMatches } from "@freelanceos/db";
import { eq, and, desc, lt, or } from "drizzle-orm";
/**
 * Chapter 8F: Leaderboard Ranking Engine
 * Paginates high-speed algorithmic candidate matching arrays natively in PostgreSQL,
 * bypassing Node.js heap memory limits and single-thread CPU array-sorting bottlenecks.
 */
export class JobLeaderboardRankingService {
    // Cap database dynamic chunk limit to fully safeguard server memory from OOM errors
    MAX_LIMIT = 50;
    /**
     * Delegates all candidate ranking calculations directly to PostgreSQL using Drizzle ORM.
     */
    async getJobLeaderboard(request) {
        // Enforce maximum fetch size strictly
        const fetchLimit = request.limit
            ? Math.min(request.limit, this.MAX_LIMIT)
            : this.MAX_LIMIT;
        // 1. STRICT PRE-FILTERING BOUNDARY
        // Locks traversal graph to the specific tenant and job to absolutely block B2B leaderboard bleeding.
        const baseConditions = [
            eq(jobMatches.tenantId, request.tenantId),
            eq(jobMatches.jobId, request.jobId)
        ];
        // 2. O(1) KEYSET CURSOR PAGINATION
        // Rip out monolithic loops and slow OFFSET mechanics.
        // Seek composite cursor based on (weightedScore, freelancerId/candidateId)
        if (request.cursor) {
            baseConditions.push(or(lt(jobMatches.weightedScore, request.cursor.lastScore), and(eq(jobMatches.weightedScore, request.cursor.lastScore), lt(jobMatches.freelancerId, request.cursor.lastCandidateId))));
        }
        // 3. DATABASE-LEVEL SORTING ENGINE
        const leaderboard = await db
            .select({
            id: jobMatches.id,
            freelancerId: jobMatches.freelancerId, // The candidate ID
            weightedScore: jobMatches.weightedScore,
            vectorDistanceScore: jobMatches.vectorDistanceScore,
            booleanStackScore: jobMatches.booleanStackScore,
            financialAlignmentScore: jobMatches.financialAlignmentScore,
        })
            .from(jobMatches)
            .where(and(...baseConditions))
            // Native sorting in Postgres memory, bypassing Node.js `.sort()` thread choke.
            // desc(freelancerId) used as the deterministic tie-breaker for the cursor.
            .orderBy(desc(jobMatches.weightedScore), desc(jobMatches.freelancerId))
            .limit(fetchLimit);
        // Compute the next deterministic keyset cursor
        let nextCursor = undefined;
        // Only return a next cursor if we filled our limit, implying there might be more rows.
        if (leaderboard.length === fetchLimit) {
            const lastItem = leaderboard[leaderboard.length - 1];
            nextCursor = {
                lastScore: lastItem.weightedScore,
                lastCandidateId: lastItem.freelancerId,
            };
        }
        return {
            data: leaderboard,
            nextCursor
        };
    }
}
