export declare class UnsupportedAlgorithmError extends Error {
    constructor(algorithm: string);
}
/**
 * Hashes a password using the configured modern hashing algorithm.
 */
export declare function hashPassword(password: string): Promise<{
    passwordHash: string;
    algorithm: string;
    hashVersion: string;
}>;
/**
 * Verifies a password against a stored hash using the appropriate algorithm.
 */
export declare function verifyPassword(password: string, storedHash: string, algorithm: string, hashVersion: string): Promise<boolean>;
//# sourceMappingURL=hash.d.ts.map