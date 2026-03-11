import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TrackedRoot } from "@/lib/cache/knowledgeCache";

// ── Supabase client mock ───────────────────────────────────────────────────────
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
    createClient: vi.fn(() => ({ from: mockFrom })),
}));

import {
    getTrackedRoots,
    upsertRoot,
    updateRoot,
    removeRoot,
    batchUpsertRoots,
} from "./knowledgeService";

// ── Helpers ────────────────────────────────────────────────────────────────────
const AT = "2024-01-01T00:00:00.000Z";
const AT_MS = new Date(AT).getTime();

const makeRow = (root: string, state = "learning", notes = "") => ({
    root,
    state,
    notes,
    added_at: AT,
    last_reviewed_at: AT,
});

const makeTrackedRoot = (root: string, state: "learning" | "learned" = "learning"): TrackedRoot => ({
    root,
    state,
    notes: "",
    addedAt: AT_MS,
    lastReviewedAt: AT_MS,
});

// ── Tests ──────────────────────────────────────────────────────────────────────
describe("knowledgeService", () => {
    beforeEach(() => {
        mockFrom.mockReset();
    });

    // ── getTrackedRoots ──────────────────────────────────────────────────────
    describe("getTrackedRoots", () => {
        it("maps rows to TrackedRoot objects", async () => {
            mockFrom.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({ data: [makeRow("ك-ت-ب"), makeRow("ع-ل-م", "learned")], error: null }),
                }),
            });

            const roots = await getTrackedRoots();

            expect(roots).toHaveLength(2);
            expect(roots[0].root).toBe("ك-ت-ب");
            expect(roots[0].state).toBe("learning");
            expect(roots[0].addedAt).toBe(AT_MS);
            expect(roots[1].state).toBe("learned");
        });

        it("returns empty array when data is null", async () => {
            mockFrom.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
            });

            expect(await getTrackedRoots()).toEqual([]);
        });

        it("throws when Supabase returns an error", async () => {
            mockFrom.mockReturnValue({
                select: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({ data: null, error: { message: "connection refused" } }),
                }),
            });

            await expect(getTrackedRoots()).rejects.toThrow("connection refused");
        });
    });

    // ── upsertRoot ───────────────────────────────────────────────────────────
    describe("upsertRoot", () => {
        it("returns a TrackedRoot on success", async () => {
            mockFrom.mockReturnValue({
                upsert: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: makeRow("ع-ل-م", "learned"), error: null }),
                    }),
                }),
            });

            const result = await upsertRoot("uid", "ع-ل-م", "learned");

            expect(result.root).toBe("ع-ل-م");
            expect(result.state).toBe("learned");
            expect(result.addedAt).toBe(AT_MS);
        });

        it("defaults state to learning", async () => {
            const upsertMock = vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: makeRow("ر-ح-م"), error: null }),
                }),
            });
            mockFrom.mockReturnValue({ upsert: upsertMock });

            await upsertRoot("uid", "ر-ح-م");

            expect(upsertMock).toHaveBeenCalledWith(
                expect.objectContaining({ state: "learning" }),
                expect.any(Object)
            );
        });

        it("throws on error", async () => {
            mockFrom.mockReturnValue({
                upsert: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: null, error: { message: "unique conflict" } }),
                    }),
                }),
            });

            await expect(upsertRoot("uid", "root", "learning")).rejects.toThrow("unique conflict");
        });
    });

    // ── updateRoot ───────────────────────────────────────────────────────────
    describe("updateRoot", () => {
        it("includes patch fields and last_reviewed_at in update", async () => {
            const updateMock = vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: makeRow("ف-ع-ل", "learned"), error: null }),
                    }),
                }),
            });
            mockFrom.mockReturnValue({ update: updateMock });

            const result = await updateRoot("ف-ع-ل", { state: "learned" });

            expect(updateMock).toHaveBeenCalledWith(
                expect.objectContaining({ state: "learned", last_reviewed_at: expect.any(String) })
            );
            expect(result.state).toBe("learned");
        });

        it("throws on error", async () => {
            mockFrom.mockReturnValue({
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({ data: null, error: { message: "row not found" } }),
                        }),
                    }),
                }),
            });

            await expect(updateRoot("x", { notes: "test" })).rejects.toThrow("row not found");
        });
    });

    // ── removeRoot ───────────────────────────────────────────────────────────
    describe("removeRoot", () => {
        it("calls delete with the correct root value", async () => {
            const eqMock = vi.fn().mockResolvedValue({ error: null });
            mockFrom.mockReturnValue({ delete: vi.fn().mockReturnValue({ eq: eqMock }) });

            await removeRoot("ع-ل-م");

            expect(eqMock).toHaveBeenCalledWith("root", "ع-ل-م");
        });

        it("throws on error", async () => {
            mockFrom.mockReturnValue({
                delete: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ error: { message: "delete failed" } }),
                }),
            });

            await expect(removeRoot("x")).rejects.toThrow("delete failed");
        });
    });

    // ── batchUpsertRoots ─────────────────────────────────────────────────────
    describe("batchUpsertRoots", () => {
        it("returns 0 and skips Supabase for empty input", async () => {
            const result = await batchUpsertRoots("uid", []);

            expect(result).toBe(0);
            expect(mockFrom).not.toHaveBeenCalled();
        });

        it("upserts correctly shaped rows and returns count", async () => {
            const upsertMock = vi.fn().mockResolvedValue({ error: null });
            mockFrom.mockReturnValue({ upsert: upsertMock });

            const roots: TrackedRoot[] = [
                makeTrackedRoot("ك-ت-ب"),
                makeTrackedRoot("ع-ل-م", "learned"),
            ];

            const count = await batchUpsertRoots("uid", roots);

            expect(count).toBe(2);
            expect(upsertMock).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ user_id: "uid", root: "ك-ت-ب", state: "learning" }),
                    expect.objectContaining({ user_id: "uid", root: "ع-ل-م", state: "learned" }),
                ]),
                expect.any(Object)
            );
        });

        it("includes addedAt and lastReviewedAt as ISO strings", async () => {
            const upsertMock = vi.fn().mockResolvedValue({ error: null });
            mockFrom.mockReturnValue({ upsert: upsertMock });

            await batchUpsertRoots("uid", [makeTrackedRoot("ك-ت-ب")]);

            const [[rows]] = upsertMock.mock.calls;
            expect(rows[0].added_at).toBe(new Date(AT_MS).toISOString());
            expect(rows[0].last_reviewed_at).toBe(new Date(AT_MS).toISOString());
        });

        it("throws when Supabase returns an error", async () => {
            mockFrom.mockReturnValue({
                upsert: vi.fn().mockResolvedValue({ error: { message: "bulk insert failed" } }),
            });

            await expect(
                batchUpsertRoots("uid", [makeTrackedRoot("ك-ت-ب")])
            ).rejects.toThrow("bulk insert failed");
        });
    });
});
