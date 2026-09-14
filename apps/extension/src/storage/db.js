export const SCHEMA_VERSION = 1;
export const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 Hours
export const MAX_SNAPSHOT_SIZE = 512 * 1024; // 512KB
export const MAX_SNAPSHOT_COUNT = 10;
/**
 * Recursively strips sensitive credentials to enforce absolute privacy.
 */
export function sanitizePrivateData(val) {
    if (val === null || val === undefined) {
        return val;
    }
    if (Array.isArray(val)) {
        return val.map(sanitizePrivateData);
    }
    if (typeof val === "object") {
        const cleaned = {};
        const sensitiveKeys = ["accesstoken", "refreshtoken", "password", "cookie", "authorization"];
        const obj = val;
        for (const key of Object.keys(obj)) {
            if (sensitiveKeys.includes(key.toLowerCase())) {
                continue;
            }
            cleaned[key] = sanitizePrivateData(obj[key]);
        }
        return cleaned;
    }
    return val;
}
export class OfflineStorage {
    dbName;
    dbVersion;
    dbPromise = null;
    constructor(dbName = "FreelanceOS_Offline", dbVersion = 1) {
        this.dbName = dbName;
        this.dbVersion = dbVersion;
    }
    getDB() {
        if (this.dbPromise) {
            return this.dbPromise;
        }
        this.dbPromise = new Promise((resolve, reject) => {
            if (typeof indexedDB === "undefined") {
                reject(new Error("IndexedDB is not supported."));
                return;
            }
            const request = indexedDB.open(this.dbName, this.dbVersion);
            request.onupgradeneeded = (event) => {
                const target = event.target;
                const db = target.result;
                if (!db.objectStoreNames.contains("snapshots")) {
                    db.createObjectStore("snapshots", { keyPath: "snapshotId" });
                }
            };
            request.onsuccess = (event) => {
                const target = event.target;
                resolve(target.result);
            };
            request.onerror = (event) => {
                const target = event.target;
                reject(target.error || new Error("Failed to open IndexedDB"));
            };
        });
        return this.dbPromise;
    }
    /**
     * Safe transactional read from snapshot store with full corruption checking.
     */
    async getSnapshot(snapshotId) {
        try {
            const db = await this.getDB();
            return new Promise((resolve) => {
                const transaction = db.transaction("snapshots", "readonly");
                const store = transaction.objectStore("snapshots");
                const request = store.get(snapshotId);
                request.onsuccess = () => {
                    const snapshot = request.result;
                    if (!snapshot) {
                        resolve(null);
                        return;
                    }
                    // 1. Extended Corruption & Schema validation
                    if (!snapshot.snapshotId ||
                        typeof snapshot.schemaVersion !== "number" ||
                        typeof snapshot.capturedAt !== "number" ||
                        typeof snapshot.expiresAt !== "number" ||
                        typeof snapshot.source !== "string" ||
                        !snapshot.data) {
                        console.warn(`[OfflineStorage] Corrupted snapshot detected for: ${snapshotId}. Invalidating.`);
                        this.deleteSnapshot(snapshotId)
                            .then(() => resolve(null))
                            .catch(() => resolve(null));
                        return;
                    }
                    // 2. Schema version verification
                    if (snapshot.schemaVersion !== SCHEMA_VERSION) {
                        console.warn(`[OfflineStorage] Schema version mismatch for: ${snapshotId} (Expected ${SCHEMA_VERSION}, got ${snapshot.schemaVersion}). Invalidate.`);
                        this.deleteSnapshot(snapshotId)
                            .then(() => resolve(null))
                            .catch(() => resolve(null));
                        return;
                    }
                    // 3. Expiration checks
                    if (Date.now() > snapshot.expiresAt) {
                        console.info(`[OfflineStorage] Snapshot expired for: ${snapshotId}.`);
                        resolve(snapshot); // Return stale, calling code knows it is expired
                        return;
                    }
                    resolve(snapshot);
                };
                request.onerror = () => {
                    console.error(`[OfflineStorage] Transaction error retrieving snapshot: ${snapshotId}`);
                    resolve(null);
                };
            });
        }
        catch (err) {
            console.error(`[OfflineStorage] Error in getSnapshot:`, err);
            return null;
        }
    }
    /**
     * Safe transactional write with concurrency protection, privacy sanitization, and atomic limits checks.
     */
    async saveSnapshot(snapshotId, data, source, capturedAt) {
        try {
            // 1. Sanitize sensitive fields (privacy rules)
            const sanitizedData = sanitizePrivateData(data);
            // 2. Prepare Snapshot DTO
            const snapshot = {
                snapshotId,
                schemaVersion: SCHEMA_VERSION,
                capturedAt: capturedAt ?? Date.now(),
                updatedAt: Date.now(),
                source,
                expiresAt: (capturedAt ?? Date.now()) + DEFAULT_TTL,
                data: sanitizedData,
            };
            const size = JSON.stringify(snapshot).length;
            if (size > MAX_SNAPSHOT_SIZE) {
                console.error(`[OfflineStorage] Snapshot payload too large: ${size} bytes (Limit: ${MAX_SNAPSHOT_SIZE})`);
                return false;
            }
            // 3. Perform Eviction checks
            await this.enforceLimits();
            // 4. Perform atomic IndexedDB transaction (with older-overwrite protection)
            const db = await this.getDB();
            return new Promise((resolve) => {
                const transaction = db.transaction("snapshots", "readwrite");
                const store = transaction.objectStore("snapshots");
                const getReq = store.get(snapshotId);
                getReq.onsuccess = () => {
                    const existing = getReq.result;
                    if (existing && existing.capturedAt > snapshot.capturedAt) {
                        console.warn(`[OfflineStorage] Attempted to overwrite newer snapshot (existing: ${existing.capturedAt}, new: ${snapshot.capturedAt}). Ignored.`);
                        resolve(true); // Don't overwrite, treat as safe ignore (newer wins)
                        return;
                    }
                    const putReq = store.put(snapshot);
                    putReq.onsuccess = () => resolve(true);
                    putReq.onerror = () => resolve(false);
                };
                getReq.onerror = () => {
                    // Fallback to try putting if read fails
                    const putReq = store.put(snapshot);
                    putReq.onsuccess = () => resolve(true);
                    putReq.onerror = () => resolve(false);
                };
            });
        }
        catch (err) {
            console.error(`[OfflineStorage] Error in saveSnapshot:`, err);
            return false;
        }
    }
    /**
     * Explicitly invalidate a snapshot.
     */
    async deleteSnapshot(snapshotId) {
        try {
            const db = await this.getDB();
            return new Promise((resolve) => {
                const transaction = db.transaction("snapshots", "readwrite");
                const store = transaction.objectStore("snapshots");
                const request = store.delete(snapshotId);
                request.onsuccess = () => resolve(true);
                request.onerror = () => resolve(false);
            });
        }
        catch (err) {
            console.error(`[OfflineStorage] Error in deleteSnapshot:`, err);
            return false;
        }
    }
    /**
     * Enforces limits by evicting expired entries first, then the oldest.
     */
    async enforceLimits() {
        try {
            const db = await this.getDB();
            const snapshots = await new Promise((resolve) => {
                const transaction = db.transaction("snapshots", "readonly");
                const store = transaction.objectStore("snapshots");
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => resolve([]);
            });
            // 1. Evict any expired snapshots first
            const now = Date.now();
            const activeSnapshots = [];
            for (const snap of snapshots) {
                if (now > snap.expiresAt) {
                    console.info(`[OfflineStorage] Evicting expired snapshot: ${snap.snapshotId}`);
                    await this.deleteSnapshot(snap.snapshotId);
                }
                else {
                    activeSnapshots.push(snap);
                }
            }
            // 2. If count still exceeds max count, remove oldest (lowest capturedAt)
            if (activeSnapshots.length >= MAX_SNAPSHOT_COUNT) {
                // Sort by capturedAt ascending (oldest first)
                activeSnapshots.sort((a, b) => a.capturedAt - b.capturedAt);
                // Keep latest. Evict from start of the list.
                const toEvictCount = activeSnapshots.length - MAX_SNAPSHOT_COUNT + 1;
                console.info(`[OfflineStorage] Bounded limit hit. Evicting oldest ${toEvictCount} active items.`);
                for (let i = 0; i < toEvictCount; i++) {
                    const snap = activeSnapshots[i];
                    if (snap) {
                        await this.deleteSnapshot(snap.snapshotId);
                    }
                }
            }
        }
        catch (err) {
            console.error(`[OfflineStorage] Eviction check failed:`, err);
        }
    }
}
