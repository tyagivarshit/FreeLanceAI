import crypto from "crypto";
import { runtimeConfig } from "@freelanceos/config";
export class UnsupportedAlgorithmError extends Error {
    constructor(algorithm) {
        super(`Unsupported password hash algorithm: ${algorithm}`);
        this.name = "UnsupportedAlgorithmError";
    }
}
/**
 * Hashes a password using the configured modern hashing algorithm.
 */
export async function hashPassword(password) {
    const algorithm = runtimeConfig.CONFIG_PASSWORD_HASH_ALGORITHM;
    if (algorithm === "scrypt") {
        const salt = crypto.randomBytes(16).toString("hex");
        const rounds = runtimeConfig.CONFIG_PASSWORD_HASH_ROUNDS;
        // Map rounds to scrypt N parameter (CPU/memory cost parameter)
        // N must be a power of 2
        const N = Math.pow(2, Math.max(10, Math.min(rounds, 20))); // Default is 14
        const hash = crypto.scryptSync(password, salt, 64, { N, r: 8, p: 1 });
        return {
            passwordHash: `${salt}:${hash.toString("hex")}`,
            algorithm: "scrypt",
            hashVersion: JSON.stringify({ N, r: 8, p: 1 }),
        };
    }
    else if (algorithm === "pbkdf2") {
        const salt = crypto.randomBytes(16).toString("hex");
        const iterations = runtimeConfig.CONFIG_PASSWORD_HASH_ROUNDS * 1000;
        const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha256");
        return {
            passwordHash: `${salt}:${hash.toString("hex")}`,
            algorithm: "pbkdf2",
            hashVersion: JSON.stringify({ iterations, keylen: 64, digest: "sha256" }),
        };
    }
    else {
        throw new UnsupportedAlgorithmError(algorithm);
    }
}
/**
 * Verifies a password against a stored hash using the appropriate algorithm.
 */
export async function verifyPassword(password, storedHash, algorithm, hashVersion) {
    try {
        const parts = storedHash.split(":");
        if (parts.length !== 2) {
            return false;
        }
        const salt = parts[0];
        const hash = parts[1];
        if (algorithm === "scrypt") {
            const { N, r, p } = JSON.parse(hashVersion);
            const derived = crypto.scryptSync(password, salt, 64, { N, r, p });
            return crypto.timingSafeEqual(Buffer.from(hash, "hex"), derived);
        }
        else if (algorithm === "pbkdf2" || algorithm === "bcrypt") {
            const { iterations, keylen, digest } = JSON.parse(hashVersion);
            const derived = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest);
            return crypto.timingSafeEqual(Buffer.from(hash, "hex"), derived);
        }
        return false;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=hash.js.map