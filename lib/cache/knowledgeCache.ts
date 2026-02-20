/**
 * Knowledge Cache – IndexedDB wrapper for personal root tracking & notes.
 * Completely local, no auth required. Supports export/import as JSON.
 */

const DB_NAME = 'quran-knowledge';
const DB_VERSION = 1;
const STORE_ROOTS = 'tracked_roots';

// ── Types ──────────────────────────────────────────────────────────

export type KnowledgeState = 'learning' | 'learned';

export interface TrackedRoot {
    root: string;               // primary key
    state: KnowledgeState;
    notes: string;
    addedAt: number;             // epoch ms
    lastReviewedAt: number;      // epoch ms
}

export interface KnowledgeExport {
    version: 1;
    exportedAt: number;
    roots: TrackedRoot[];
}

// ── Cache class ────────────────────────────────────────────────────

class KnowledgeCache {
    private db: IDBDatabase | null = null;
    private initPromise: Promise<IDBDatabase> | null = null;

    private isBrowser(): boolean {
        return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
    }

    async init(): Promise<IDBDatabase> {
        if (!this.isBrowser()) {
            throw new Error('IndexedDB is not available in this environment');
        }
        if (this.db) return this.db;
        if (this.initPromise) return this.initPromise;

        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                if (!db.objectStoreNames.contains(STORE_ROOTS)) {
                    const store = db.createObjectStore(STORE_ROOTS, { keyPath: 'root' });
                    store.createIndex('by_state', 'state', { unique: false });
                }
            };
        });

        return this.initPromise;
    }

    // ── CRUD ───────────────────────────────────────────────────────

    async trackRoot(root: string, state: KnowledgeState = 'learning'): Promise<TrackedRoot> {
        const db = await this.init();
        const now = Date.now();
        const entry: TrackedRoot = {
            root,
            state,
            notes: '',
            addedAt: now,
            lastReviewedAt: now,
        };

        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_ROOTS, 'readwrite');
            tx.objectStore(STORE_ROOTS).put(entry);
            tx.oncomplete = () => resolve(entry);
            tx.onerror = () => reject(tx.error);
        });
    }

    async updateRoot(root: string, patch: Partial<Pick<TrackedRoot, 'state' | 'notes'>>): Promise<TrackedRoot | null> {
        const existing = await this.getRoot(root);
        if (!existing) return null;

        const updated: TrackedRoot = {
            ...existing,
            ...patch,
            lastReviewedAt: Date.now(),
        };

        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_ROOTS, 'readwrite');
            tx.objectStore(STORE_ROOTS).put(updated);
            tx.oncomplete = () => resolve(updated);
            tx.onerror = () => reject(tx.error);
        });
    }

    async getRoot(root: string): Promise<TrackedRoot | null> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_ROOTS, 'readonly');
            const req = tx.objectStore(STORE_ROOTS).get(root);
            req.onsuccess = () => resolve((req.result as TrackedRoot) ?? null);
            req.onerror = () => reject(req.error);
        });
    }

    async getAllRoots(): Promise<TrackedRoot[]> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_ROOTS, 'readonly');
            const req = tx.objectStore(STORE_ROOTS).getAll();
            req.onsuccess = () => resolve(req.result as TrackedRoot[]);
            req.onerror = () => reject(req.error);
        });
    }

    async removeRoot(root: string): Promise<void> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_ROOTS, 'readwrite');
            tx.objectStore(STORE_ROOTS).delete(root);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    // ── Export / Import ────────────────────────────────────────────

    async exportKnowledge(): Promise<string> {
        const roots = await this.getAllRoots();
        const payload: KnowledgeExport = {
            version: 1,
            exportedAt: Date.now(),
            roots,
        };
        return JSON.stringify(payload, null, 2);
    }

    async importKnowledge(jsonString: string, merge = true): Promise<number> {
        const payload = JSON.parse(jsonString) as KnowledgeExport;
        if (payload.version !== 1 || !Array.isArray(payload.roots)) {
            throw new Error('Invalid knowledge export format');
        }

        const db = await this.init();
        const tx = db.transaction(STORE_ROOTS, 'readwrite');
        const store = tx.objectStore(STORE_ROOTS);

        if (!merge) {
            store.clear();
        }

        for (const entry of payload.roots) {
            store.put(entry);
        }

        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(payload.roots.length);
            tx.onerror = () => reject(tx.error);
        });
    }
}

export const knowledgeCache = new KnowledgeCache();
