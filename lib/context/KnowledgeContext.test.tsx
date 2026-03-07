import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("@/lib/context/AuthContext", () => ({
    useAuth: vi.fn(),
    // PassThrough so that KnowledgeProvider (which calls useAuth) can be used
    AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/supabase/knowledgeService", () => ({
    getTrackedRoots: vi.fn(),
    upsertRoot: vi.fn(),
    updateRoot: vi.fn(),
    removeRoot: vi.fn(),
    batchUpsertRoots: vi.fn(),
}));

vi.mock("@/lib/cache/knowledgeCache", () => ({
    knowledgeCache: {
        getAllRoots: vi.fn(),
        trackRoot: vi.fn(),
        updateRoot: vi.fn(),
        removeRoot: vi.fn(),
        importKnowledge: vi.fn(),
    },
}));

import { useAuth } from "@/lib/context/AuthContext";
import * as knowledgeService from "@/lib/supabase/knowledgeService";
import { knowledgeCache } from "@/lib/cache/knowledgeCache";
import { KnowledgeProvider, useKnowledge } from "./KnowledgeContext";

const mockUseAuth = vi.mocked(useAuth);
const mockGetTrackedRoots = vi.mocked(knowledgeService.getTrackedRoots);
const mockUpsertRoot = vi.mocked(knowledgeService.upsertRoot);
const mockCacheGetAll = vi.mocked(knowledgeCache.getAllRoots);
const mockCacheTrack = vi.mocked(knowledgeCache.trackRoot);
const mockCacheRemove = vi.mocked(knowledgeCache.removeRoot);
const mockBatchUpsertRoots = vi.mocked(knowledgeService.batchUpsertRoots);

// ── Test helpers ──────────────────────────────────────────────────────────────

function KnowledgeConsumer({ onAction }: { onAction?: string }) {
    const ctx = useKnowledge();
    return (
        <div>
            <span data-testid="loading">{String(ctx.loading)}</span>
            <span data-testid="roots-count">{ctx.roots.size}</span>
            <span data-testid="pending">{String(ctx.pendingMigration)}</span>
            <span data-testid="total">{ctx.stats.total}</span>
            <span data-testid="learning">{ctx.stats.learning}</span>
            {onAction === "trackRoot" && (
                <button onClick={() => ctx.trackRoot("كتب")}>track</button>
            )}
            {onAction === "acceptMigration" && (
                <button onClick={() => ctx.acceptMigration()}>accept</button>
            )}
            {onAction === "declineMigration" && (
                <button onClick={() => ctx.declineMigration()}>decline</button>
            )}
        </div>
    );
}

function Wrapper({ children }: { children: ReactNode }) {
    return <KnowledgeProvider>{children}</KnowledgeProvider>;
}

function anonUser() {
    mockUseAuth.mockReturnValue({ user: null, session: null, loading: false } as any);
}

function authedUser(id = "uid-1", email = "u@test.com") {
    mockUseAuth.mockReturnValue({ user: { id, email }, session: {}, loading: false } as any);
}

const fakeRoot = (root: string, state: "learning" | "learned" = "learning") =>
    ({ root, state, notes: "", addedAt: 0, lastReviewedAt: 0 } as const);

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("KnowledgeContext — anonymous (IndexedDB) path", () => {
    beforeEach(() => { vi.clearAllMocks(); anonUser(); });

    it("loads roots from IndexedDB", async () => {
        mockCacheGetAll.mockResolvedValue([fakeRoot("كتب"), fakeRoot("علم", "learned")]);

        await act(async () => {
            render(<KnowledgeConsumer />, { wrapper: Wrapper });
        });

        expect(mockCacheGetAll).toHaveBeenCalled();
        expect(screen.getByTestId("roots-count").textContent).toBe("2");
        expect(screen.getByTestId("learning").textContent).toBe("1");
    });

    it("does not call knowledgeService.getTrackedRoots", async () => {
        mockCacheGetAll.mockResolvedValue([]);

        await act(async () => {
            render(<KnowledgeConsumer />, { wrapper: Wrapper });
        });

        expect(mockGetTrackedRoots).not.toHaveBeenCalled();
    });

    it("trackRoot calls knowledgeCache, not knowledgeService", async () => {
        mockCacheGetAll.mockResolvedValue([]);
        mockCacheTrack.mockResolvedValue(fakeRoot("كتب"));

        await act(async () => {
            render(<KnowledgeConsumer onAction="trackRoot" />, { wrapper: Wrapper });
        });

        await userEvent.click(screen.getByText("track"));

        expect(mockCacheTrack).toHaveBeenCalledWith("كتب", "learning");
        expect(mockUpsertRoot).not.toHaveBeenCalled();
    });
});

describe("KnowledgeContext — authenticated (Supabase) path", () => {
    beforeEach(() => { vi.clearAllMocks(); authedUser(); });

    it("loads roots from Supabase", async () => {
        mockGetTrackedRoots.mockResolvedValue([fakeRoot("علم"), fakeRoot("درس")]);
        mockCacheGetAll.mockResolvedValue([]);

        await act(async () => {
            render(<KnowledgeConsumer />, { wrapper: Wrapper });
        });

        expect(mockGetTrackedRoots).toHaveBeenCalled();
        expect(screen.getByTestId("roots-count").textContent).toBe("2");
    });

    it("trackRoot calls knowledgeService.upsertRoot with userId", async () => {
        mockGetTrackedRoots.mockResolvedValue([]);
        mockCacheGetAll.mockResolvedValue([]);
        mockUpsertRoot.mockResolvedValue(fakeRoot("كتب"));

        await act(async () => {
            render(<KnowledgeConsumer onAction="trackRoot" />, { wrapper: Wrapper });
        });

        await userEvent.click(screen.getByText("track"));

        expect(mockUpsertRoot).toHaveBeenCalledWith("uid-1", "كتب", "learning");
        expect(mockCacheTrack).not.toHaveBeenCalled();
    });

    it("does not offer migration when cloud already has roots", async () => {
        mockGetTrackedRoots.mockResolvedValue([fakeRoot("علم")]);
        mockCacheGetAll.mockResolvedValue([fakeRoot("درس")]);

        await act(async () => {
            render(<KnowledgeConsumer />, { wrapper: Wrapper });
        });

        expect(screen.getByTestId("pending").textContent).toBe("false");
    });
});

describe("KnowledgeContext — migration flow", () => {
    beforeEach(() => { vi.clearAllMocks(); authedUser(); });

    it("sets pendingMigration=true when cloud empty and local has roots", async () => {
        mockGetTrackedRoots.mockResolvedValue([]);
        mockCacheGetAll.mockResolvedValue([fakeRoot("درس")]);

        await act(async () => {
            render(<KnowledgeConsumer />, { wrapper: Wrapper });
        });

        expect(screen.getByTestId("pending").textContent).toBe("true");
    });

    it("declineMigration clears pendingMigration", async () => {
        mockGetTrackedRoots.mockResolvedValue([]);
        mockCacheGetAll.mockResolvedValue([fakeRoot("درس")]);

        await act(async () => {
            render(<KnowledgeConsumer onAction="declineMigration" />, { wrapper: Wrapper });
        });

        expect(screen.getByTestId("pending").textContent).toBe("true");

        await userEvent.click(screen.getByText("decline"));

        expect(screen.getByTestId("pending").textContent).toBe("false");
    });

    it("acceptMigration calls batchUpsertRoots, removes local roots, clears pending", async () => {
        const local = fakeRoot("درس");
        mockGetTrackedRoots
            .mockResolvedValueOnce([])          // initial hydrate
            .mockResolvedValueOnce([local]);    // after migration reload
        mockCacheGetAll.mockResolvedValue([local]);
        mockBatchUpsertRoots.mockResolvedValue(1);
        mockCacheRemove.mockResolvedValue(undefined);

        await act(async () => {
            render(<KnowledgeConsumer onAction="acceptMigration" />, { wrapper: Wrapper });
        });

        expect(screen.getByTestId("pending").textContent).toBe("true");

        await act(async () => {
            await userEvent.click(screen.getByText("accept"));
        });

        expect(mockBatchUpsertRoots).toHaveBeenCalledWith("uid-1", [local]);
        expect(mockCacheRemove).toHaveBeenCalledWith("درس");
        expect(screen.getByTestId("pending").textContent).toBe("false");
        // cloud roots are now loaded
        expect(screen.getByTestId("roots-count").textContent).toBe("1");
    });
});

describe("KnowledgeContext — guard", () => {
    it("useKnowledge throws when used outside KnowledgeProvider", () => {
        function Bare() {
            useKnowledge();
            return null;
        }

        mockUseAuth.mockReturnValue({ user: null, session: null, loading: false } as any);
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        expect(() => render(<Bare />)).toThrow("useKnowledge must be used within a KnowledgeProvider");

        errorSpy.mockRestore();
    });
});
