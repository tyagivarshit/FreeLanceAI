import { db, users } from "@freelanceos/db";
import { eq } from "drizzle-orm";
export class DbIdentityStore {
    async findUserById(userId) {
        const userRecords = await db
            .select({
            id: users.id,
            email: users.email,
        })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
        const user = userRecords[0];
        if (!user) {
            return null;
        }
        return {
            id: user.id,
            email: user.email,
        };
    }
}
export const identityStore = new DbIdentityStore();
