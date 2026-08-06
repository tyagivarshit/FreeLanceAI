export interface Session {
    id: string;
    userId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    lastActivityAt: Date;
    revokedAt: Date | null;
    deviceName: string | null;
    platform: string | null;
    browser: string | null;
    userAgent: string;
    ipAddress: string;
    rotationCounter: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface SessionMetadata {
    deviceName?: string;
    platform?: string;
    browser?: string;
    userAgent: string;
    ipAddress: string;
}
export interface SessionResult {
    sessionId: string;
    userId: string;
    rawRefreshToken: string;
    signedAccessToken: string;
    expiresAt: Date;
}
/**
 * Creates a stateful session and issues access/refresh tokens.
 */
export declare function createSession(userId: string, metadata: SessionMetadata): Promise<SessionResult>;
/**
 * Validates a Signed Access Token statelessly and maps it back to active database session invariants.
 */
export declare function validateSession(accessToken: string): Promise<{
    sessionId: string;
    userId: string;
}>;
/**
 * Rotates a refresh token, checking for replay theft attacks and applying concurrency grace periods.
 */
export declare function rotateSession(rawRefreshToken: string, metadata: SessionMetadata): Promise<{
    newRawRefreshToken: string;
    newSignedAccessToken: string;
}>;
/**
 * Revokes a specific session.
 */
export declare function revokeSession(sessionId: string): Promise<void>;
/**
 * Revokes all sessions belonging to a user.
 */
export declare function revokeAllSessions(userId: string): Promise<void>;
/**
 * Locates an active, unexpired, and unrevoked session by its identifier.
 */
export declare function findActiveSession(sessionId: string): Promise<Session | null>;
//# sourceMappingURL=session.d.ts.map