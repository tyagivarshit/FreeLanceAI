const fs=require('fs');
let c=fs.readFileSync('packages/auth/src/session.ts', 'utf8');

c=c.replace(/import { db, sessions, userPasswordHashes } from "@freelanceos\/db";/, 'import { db, sessions, userPasswordHashes, users } from "@freelanceos/db";');
c=c.replace(/import { eq, and, gt, isNull, lt, isNotNull, or, asc, inArray } from "drizzle-orm";/, 'import { eq, and, gt, isNull, lt, isNotNull, or, asc, inArray, sql } from "drizzle-orm";');

c=c.replace(/export async function validateSession[\s\S]*?userId: payload.userId,\n  };\n}/, `const buildValidateSessionQuery = () => db
  .select({
    credentialVersion: userPasswordHashes.credentialVersion,
    session: sessions,
    userEmail: users.email
  })
  .from(sessions)
  .innerJoin(userPasswordHashes, eq(userPasswordHashes.userId, sessions.userId))
  .innerJoin(users, eq(users.id, sessions.userId))
  .where(eq(sessions.id, sql.placeholder('sessionId')))
  .limit(1);

const preparedValidateSessionQuery = process.env.NODE_ENV === "test" 
  ? null 
  : buildValidateSessionQuery().prepare("validate_session_query");

export async function validateSession(
  accessToken: string,
): Promise<{ sessionId: string; userId: string; email: string }> {
  const payload = verifyAccessToken(accessToken);

  const joinedResult = process.env.NODE_ENV === "test"
    ? await buildValidateSessionQuery().execute({ sessionId: payload.sessionId })
    : await preparedValidateSessionQuery!.execute({ sessionId: payload.sessionId });

  const row = joinedResult[0];
  if (!row || row.credentialVersion !== payload.credentialVersion) {
    throw new InvalidTokenError(
      "User credentials have changed. Session invalidated.",
      "INVALID",
      payload.userId,
      payload.sessionId,
    );
  }

  const session = row.session;
  if (!session) {
    throw new SessionNotFoundError(payload.sessionId);
  }

  if (session.revokedAt) {
    throw new SessionRevokedError(payload.sessionId);
  }

  if (session.expiresAt.getTime() < Date.now()) {
    throw new SessionExpiredError(payload.sessionId);
  }

  return {
    sessionId: payload.sessionId,
    userId: payload.userId,
    email: row.userEmail
  };
}`);
fs.writeFileSync('packages/auth/src/session.ts', c);
