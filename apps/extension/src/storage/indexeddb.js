export class IDBQueue {
    dbName;
    storeName;
    db = null;
    initialized = null;
    constructor(dbName, storeName) {
        this.dbName = dbName;
        this.storeName = storeName;
    }
    async init() {
        if (this.initialized)
            return this.initialized;
        this.initialized = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains(this.storeName)) {
                    request.result.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            request.onerror = () => {
                this.initialized = null;
                reject(request.error);
            };
        });
        return this.initialized;
    }
    async enqueue(item) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.put(item);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    async peekFirst() {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const request = store.openCursor();
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    resolve(cursor.value);
                }
                else {
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }
    async remove(id) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}
