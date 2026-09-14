import { db } from "../client.js";
import { aiGatewayLogs } from "../schema/gateway.js";
import { eq, and } from "drizzle-orm";
export class PostgresGatewayRepository {
    async saveLog(logData) {
        await db.insert(aiGatewayLogs).values({
            id: logData.id,
            tenantId: logData.tenantId,
            ownerId: logData.ownerId,
            requestContextReference: logData.requestContextReference,
            metadata: logData.metadata,
            status: logData.status,
            createdAt: new Date(),
            updatedAt: new Date(),
        }).onConflictDoUpdate({
            target: aiGatewayLogs.id,
            set: {
                status: logData.status,
                metadata: logData.metadata,
                updatedAt: new Date(),
            }
        });
    }
    async getLog(id, tenantId) {
        const result = await db.select().from(aiGatewayLogs).where(and(eq(aiGatewayLogs.id, id), eq(aiGatewayLogs.tenantId, tenantId))).limit(1);
        return result[0] || null;
    }
}
