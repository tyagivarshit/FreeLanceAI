import { db } from './packages/db/src/client.ts';
import { sessions } from './packages/db/src/index.ts';
import { eq } from 'drizzle-orm';
import { signAccessToken } from './packages/auth/src/token.ts';
import fs from 'fs';
async function run() {
    try {
        await db.delete(sessions).where(eq(sessions.id, '00000000-0000-4000-8000-000000000002'));
        await db.insert(sessions).values({
            id: '00000000-0000-4000-8000-000000000002',
            userId: '00000000-0000-4000-8000-000000000001',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
            lastActivityAt: new Date(),
            ipAddress: '127.0.0.1',
            userAgent: 'autocannon',
            refreshTokenHash: 'dummy'
        });
        console.log('Session inserted.');
        const token = signAccessToken({ sessionId: '00000000-0000-4000-8000-000000000002', userId: '00000000-0000-4000-8000-000000000001', credentialVersion: 1 });
        fs.writeFileSync('C:/Users/tyagi/.gemini/antigravity-cli/brain/63a140eb-b98d-4cc7-966f-b45dbeb52563/scratch/benchmark-token.txt', token);
        console.log('Token written.');
    }
    catch (e) {
        console.error(e);
    }
    finally {
        process.exit(0);
    }
}
run();
