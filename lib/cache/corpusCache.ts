/**
 * Corpus Cache - IndexedDB wrapper for storing and retrieving corpus data
 * Provides persistent caching for the full Quran corpus (~77,000 tokens)
 */

const DB_NAME = 'quran-corpus-cache';
const DB_VERSION = 2; // Incremented for verses store
const STORE_TOKENS = 'tokens';
const STORE_VERSES = 'verses';
const STORE_METADATA = 'metadata';

interface CacheMetadata {
    key: string;
    lastUpdated: number;
    tokenCount: number;
    hasMorphology?: boolean;
    morphologyVersion?: string;
}

class CorpusCache {
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

        console.log('[CorpusCache] Initializing IndexedDB...');

        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('[CorpusCache] Failed to open database:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                console.log('[CorpusCache] Database opened successfully');
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                console.log('[CorpusCache] Upgrading database schema...');
                const db = (event.target as IDBOpenDBRequest).result;

                // Store for tokens (keyed by surah:ayah:position)
                if (!db.objectStoreNames.contains(STORE_TOKENS)) {
                    const tokenStore = db.createObjectStore(STORE_TOKENS, { keyPath: 'id' });
                    tokenStore.createIndex('by_sura', 'sura', { unique: false });
                    tokenStore.createIndex('by_root', 'root', { unique: false });
                    tokenStore.createIndex('by_lemma', 'lemma', { unique: false });
                    tokenStore.createIndex('by_pos', 'pos', { unique: false });
                }

                // Store for full verses (keyed by surah:ayah)
                if (!db.objectStoreNames.contains(STORE_VERSES)) {
                    const verseStore = db.createObjectStore(STORE_VERSES, { keyPath: 'id' });
                    verseStore.createIndex('by_sura', 'suraId', { unique: false });
                }

                // Store for metadata
                if (!db.objectStoreNames.contains(STORE_METADATA)) {
                    db.createObjectStore(STORE_METADATA, { keyPath: 'key' });
                }
            };
        });

        return this.initPromise;
    }

    async storeTokens(tokens: unknown[]): Promise<void> {
        const db = await this.init();
        const tx = db.transaction(STORE_TOKENS, 'readwrite');
        const store = tx.objectStore(STORE_TOKENS);

        for (const token of tokens) {
            store.put(token);
        }

        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async storeVerses(verses: unknown[]): Promise<void> {
        const db = await this.init();
        const tx = db.transaction(STORE_VERSES, 'readwrite');
        const store = tx.objectStore(STORE_VERSES);

        for (const verse of verses) {
            store.put(verse);
        }

        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async getTokensBySura(suraId: number): Promise<unknown[]> {
        const db = await this.init();
        const tx = db.transaction(STORE_TOKENS, 'readonly');
        const store = tx.objectStore(STORE_TOKENS);
        const index = store.index('by_sura');

        return new Promise((resolve, reject) => {
            const request = index.getAll(suraId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getTokensByRoot(root: string): Promise<unknown[]> {
        const db = await this.init();
        const tx = db.transaction(STORE_TOKENS, 'readonly');
        const store = tx.objectStore(STORE_TOKENS);
        const index = store.index('by_root');

        return new Promise((resolve, reject) => {
            const request = index.getAll(root);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllTokens(): Promise<unknown[]> {
        const db = await this.init();
        const tx = db.transaction(STORE_TOKENS, 'readonly');
        const store = tx.objectStore(STORE_TOKENS);

        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getVerse(verseId: string): Promise<unknown | null> {
        const db = await this.init();
        const tx = db.transaction(STORE_VERSES, 'readonly');
        const store = tx.objectStore(STORE_VERSES);

        return new Promise((resolve, reject) => {
            const request = store.get(verseId);
            request.onsuccess = () => resolve(request.result ?? null);
            request.onerror = () => reject(request.error);
        });
    }

    async getVersesBySura(suraId: number): Promise<unknown[]> {
        const db = await this.init();
        const tx = db.transaction(STORE_VERSES, 'readonly');
        const store = tx.objectStore(STORE_VERSES);
        const index = store.index('by_sura');

        return new Promise((resolve, reject) => {
            const request = index.getAll(suraId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getTokenCount(): Promise<number> {
        const db = await this.init();
        const tx = db.transaction(STORE_TOKENS, 'readonly');
        const store = tx.objectStore(STORE_TOKENS);

        return new Promise((resolve, reject) => {
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async setMetadata(key: string, data: Partial<CacheMetadata>): Promise<void> {
        const db = await this.init();
        const tx = db.transaction(STORE_METADATA, 'readwrite');
        const store = tx.objectStore(STORE_METADATA);

        store.put({ key, ...data, lastUpdated: Date.now() });

        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async getMetadata(key: string): Promise<CacheMetadata | null> {
        const db = await this.init();
        const tx = db.transaction(STORE_METADATA, 'readonly');
        const store = tx.objectStore(STORE_METADATA);

        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result ?? null);
            request.onerror = () => reject(request.error);
        });
    }

    async clearAll(): Promise<void> {
        const db = await this.init();
        const tx = db.transaction([STORE_TOKENS, STORE_VERSES, STORE_METADATA], 'readwrite');
        tx.objectStore(STORE_TOKENS).clear();
        tx.objectStore(STORE_VERSES).clear();
        tx.objectStore(STORE_METADATA).clear();

        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
}

export const corpusCache = new CorpusCache();
