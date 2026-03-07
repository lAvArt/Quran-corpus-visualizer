/**
 * API route handler tests.
 *
 * Each handler imports `createClient` from `@/lib/supabase/server` (async, uses
 * next/headers cookies). We mock the entire module so `cookies()` is never called
 * and we can control what `rpc()` returns.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock @/lib/supabase/server ────────────────────────────────────────────────

const mockRpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(async () => ({ rpc: mockRpc })),
}));

// ── Import handlers after mock registration ───────────────────────────────────

import { GET as searchGET } from "@/app/api/search/route";
import { GET as collocationsGET } from "@/app/api/collocations/route";
import { GET as crossRefGET } from "@/app/api/cross-reference/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(path: string): NextRequest {
    return new NextRequest(`http://localhost${path}`);
}

// ── /api/search ───────────────────────────────────────────────────────────────

describe("GET /api/search", () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it("returns 400 when q param is missing", async () => {
        const res = await searchGET(makeRequest("/api/search"));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toMatch(/q param/);
    });

    it("calls search_corpus_fts by default and returns results", async () => {
        const rows = [{ root: "كتب", rank: 0.9 }];
        mockRpc.mockResolvedValue({ data: rows, error: null });

        const res = await searchGET(makeRequest("/api/search?q=كتب"));

        expect(mockRpc).toHaveBeenCalledWith("search_corpus_fts", expect.objectContaining({ query: "كتب" }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.results).toEqual(rows);
    });

    it("calls search_corpus_trigram when mode=trigram", async () => {
        mockRpc.mockResolvedValue({ data: [], error: null });

        await searchGET(makeRequest("/api/search?q=كتب&mode=trigram&threshold=0.3"));

        expect(mockRpc).toHaveBeenCalledWith("search_corpus_trigram", expect.objectContaining({
            query: "كتب",
            threshold: 0.3,
        }));
    });

    it("caps limit at 100", async () => {
        mockRpc.mockResolvedValue({ data: [], error: null });

        await searchGET(makeRequest("/api/search?q=test&limit=999"));

        expect(mockRpc).toHaveBeenCalledWith("search_corpus_fts", expect.objectContaining({ limit_n: 100 }));
    });

    it("returns 500 on Supabase error", async () => {
        mockRpc.mockResolvedValue({ data: null, error: { message: "DB error" } });

        const res = await searchGET(makeRequest("/api/search?q=كتب"));

        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toBe("Search failed");
    });

    it("returns empty results array when data is null", async () => {
        mockRpc.mockResolvedValue({ data: null, error: null });

        const res = await searchGET(makeRequest("/api/search?q=كتب"));
        const body = await res.json();
        expect(body.results).toEqual([]);
    });
});

// ── /api/collocations ─────────────────────────────────────────────────────────

describe("GET /api/collocations", () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it("returns 400 when root param is missing", async () => {
        const res = await collocationsGET(makeRequest("/api/collocations"));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toMatch(/root param/);
    });

    it("calls get_collocates with correct params and returns collocates", async () => {
        const rows = [{ co_root: "علم", pmi: 3.2 }];
        mockRpc.mockResolvedValue({ data: rows, error: null });

        const res = await collocationsGET(makeRequest("/api/collocations?root=صلو&min_pmi=1.5&limit=10"));

        expect(mockRpc).toHaveBeenCalledWith("get_collocates", expect.objectContaining({
            target_root: "صلو",
            min_pmi: 1.5,
            limit_n: 10,
        }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.collocates).toEqual(rows);
    });

    it("returns 500 on Supabase error", async () => {
        mockRpc.mockResolvedValue({ data: null, error: { message: "fail" } });

        const res = await collocationsGET(makeRequest("/api/collocations?root=صلو"));
        expect(res.status).toBe(500);
    });

    it("returns empty array when data is null", async () => {
        mockRpc.mockResolvedValue({ data: null, error: null });

        const res = await collocationsGET(makeRequest("/api/collocations?root=صلو"));
        const body = await res.json();
        expect(body.collocates).toEqual([]);
    });
});

// ── /api/cross-reference ─────────────────────────────────────────────────────

describe("GET /api/cross-reference", () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it("returns 400 when root_a is missing", async () => {
        const res = await crossRefGET(makeRequest("/api/cross-reference?root_b=زكو"));
        expect(res.status).toBe(400);
    });

    it("returns 400 when root_b is missing", async () => {
        const res = await crossRefGET(makeRequest("/api/cross-reference?root_a=صلو"));
        expect(res.status).toBe(400);
    });

    it("calls cross_reference_roots with both roots and returns ayahs", async () => {
        const rows = [{ surah: 2, ayah: 43, text: "..." }];
        mockRpc.mockResolvedValue({ data: rows, error: null });

        const res = await crossRefGET(makeRequest("/api/cross-reference?root_a=صلو&root_b=زكو"));

        expect(mockRpc).toHaveBeenCalledWith("cross_reference_roots", {
            root_a: "صلو",
            root_b: "زكو",
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ayahs).toEqual(rows);
    });

    it("returns 500 on Supabase error", async () => {
        mockRpc.mockResolvedValue({ data: null, error: { message: "fail" } });

        const res = await crossRefGET(makeRequest("/api/cross-reference?root_a=صلو&root_b=زكو"));
        expect(res.status).toBe(500);
    });

    it("returns empty array when data is null", async () => {
        mockRpc.mockResolvedValue({ data: null, error: null });

        const res = await crossRefGET(makeRequest("/api/cross-reference?root_a=صلو&root_b=زكو"));
        const body = await res.json();
        expect(body.ayahs).toEqual([]);
    });
});
