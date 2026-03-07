import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Supabase client mock ───────────────────────────────────────────────────────
const mockSubscription = { unsubscribe: vi.fn() };
const mockAuth = {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
};

vi.mock("@/lib/supabase/client", () => ({
    createClient: vi.fn(() => ({ auth: mockAuth })),
}));

import { AuthProvider, useAuth } from "./AuthContext";

// ── Helper consumer component ─────────────────────────────────────────────────
function AuthConsumer() {
    const { user, loading, signIn, signUp, signOut, resetPassword, updatePassword } = useAuth();
    return (
        <div>
            <span data-testid="loading">{String(loading)}</span>
            <span data-testid="email">{user?.email ?? "none"}</span>
            <button onClick={() => signIn("a@b.com", "pw")}>sign-in</button>
            <button onClick={() => signUp("a@b.com", "pw")}>sign-up</button>
            <button onClick={() => signOut()}>sign-out</button>
            <button onClick={() => resetPassword("a@b.com")}>reset</button>
            <button onClick={() => updatePassword("newpw")}>update-pw</button>
        </div>
    );
}

// ── Tests ──────────────────────────────────────────────────────────────────────
describe("AuthContext", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuth.onAuthStateChange.mockReturnValue({
            data: { subscription: mockSubscription },
        });
        mockAuth.getSession.mockResolvedValue({ data: { session: null } });
    });

    it("starts with loading=true and resolves to no user when no session", async () => {
        await act(async () => {
            render(<AuthProvider><AuthConsumer /></AuthProvider>);
        });

        expect(screen.getByTestId("loading").textContent).toBe("false");
        expect(screen.getByTestId("email").textContent).toBe("none");
    });

    it("sets user from existing session on mount", async () => {
        mockAuth.getSession.mockResolvedValue({
            data: { session: { user: { email: "user@test.com", id: "uid-1" } } },
        });

        await act(async () => {
            render(<AuthProvider><AuthConsumer /></AuthProvider>);
        });

        expect(screen.getByTestId("email").textContent).toBe("user@test.com");
    });

    it("updates user when onAuthStateChange fires a SIGNED_IN event", async () => {
        let capturedCallback: ((event: string, session: unknown) => void) | null = null;
        mockAuth.onAuthStateChange.mockImplementation((cb) => {
            capturedCallback = cb;
            return { data: { subscription: mockSubscription } };
        });

        await act(async () => {
            render(<AuthProvider><AuthConsumer /></AuthProvider>);
        });

        expect(screen.getByTestId("email").textContent).toBe("none");

        await act(async () => {
            capturedCallback?.("SIGNED_IN", { user: { email: "new@user.com", id: "uid-2" } });
        });

        expect(screen.getByTestId("email").textContent).toBe("new@user.com");
    });

    it("clears user on SIGNED_OUT event", async () => {
        mockAuth.getSession.mockResolvedValue({
            data: { session: { user: { email: "user@test.com", id: "uid-1" } } },
        });
        let capturedCallback: ((event: string, session: unknown) => void) | null = null;
        mockAuth.onAuthStateChange.mockImplementation((cb) => {
            capturedCallback = cb;
            return { data: { subscription: mockSubscription } };
        });

        await act(async () => {
            render(<AuthProvider><AuthConsumer /></AuthProvider>);
        });

        expect(screen.getByTestId("email").textContent).toBe("user@test.com");

        await act(async () => {
            capturedCallback?.("SIGNED_OUT", null);
        });

        expect(screen.getByTestId("email").textContent).toBe("none");
    });

    it("signIn calls signInWithPassword with credentials", async () => {
        mockAuth.signInWithPassword.mockResolvedValue({ error: null });
        await act(async () => {
            render(<AuthProvider><AuthConsumer /></AuthProvider>);
        });

        await userEvent.click(screen.getByText("sign-in"));

        expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
            email: "a@b.com",
            password: "pw",
        });
    });

    it("signIn returns error message on failure", async () => {
        mockAuth.signInWithPassword.mockResolvedValue({ error: { message: "Invalid credentials" } });
        let result: { error: string | null } | undefined;

        function SignInConsumer() {
            const { signIn } = useAuth();
            return (
                <button onClick={async () => { result = await signIn("a@b.com", "pw"); }}>
                    sign-in
                </button>
            );
        }

        await act(async () => {
            render(<AuthProvider><SignInConsumer /></AuthProvider>);
        });
        await userEvent.click(screen.getByText("sign-in"));

        expect(result?.error).toBe("Invalid credentials");
    });

    it("signIn returns null error on success", async () => {
        mockAuth.signInWithPassword.mockResolvedValue({ error: null });
        let result: { error: string | null } | undefined;

        function SignInConsumer() {
            const { signIn } = useAuth();
            return (
                <button onClick={async () => { result = await signIn("a@b.com", "pw"); }}>
                    sign-in
                </button>
            );
        }

        await act(async () => {
            render(<AuthProvider><SignInConsumer /></AuthProvider>);
        });
        await userEvent.click(screen.getByText("sign-in"));

        expect(result?.error).toBeNull();
    });

    it("signUp includes emailRedirectTo pointing to /auth/callback", async () => {
        mockAuth.signUp.mockResolvedValue({ error: null });
        await act(async () => {
            render(<AuthProvider><AuthConsumer /></AuthProvider>);
        });

        await userEvent.click(screen.getByText("sign-up"));

        expect(mockAuth.signUp).toHaveBeenCalledWith(
            expect.objectContaining({
                email: "a@b.com",
                options: expect.objectContaining({
                    emailRedirectTo: expect.stringContaining("/auth/callback"),
                }),
            })
        );
    });

    it("signOut calls supabase.auth.signOut", async () => {
        mockAuth.signOut.mockResolvedValue({});
        await act(async () => {
            render(<AuthProvider><AuthConsumer /></AuthProvider>);
        });

        await userEvent.click(screen.getByText("sign-out"));

        expect(mockAuth.signOut).toHaveBeenCalled();
    });

    it("resetPassword includes redirectTo with update-password path", async () => {
        mockAuth.resetPasswordForEmail.mockResolvedValue({ error: null });
        await act(async () => {
            render(<AuthProvider><AuthConsumer /></AuthProvider>);
        });

        await userEvent.click(screen.getByText("reset"));

        expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith(
            "a@b.com",
            expect.objectContaining({
                redirectTo: expect.stringContaining("update-password"),
            })
        );
    });

    it("updatePassword calls updateUser with new password", async () => {
        mockAuth.updateUser.mockResolvedValue({ error: null });
        await act(async () => {
            render(<AuthProvider><AuthConsumer /></AuthProvider>);
        });

        await userEvent.click(screen.getByText("update-pw"));

        expect(mockAuth.updateUser).toHaveBeenCalledWith({ password: "newpw" });
    });

    it("useAuth throws when used outside AuthProvider", () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        expect(() => render(<AuthConsumer />)).toThrow("useAuth must be used within AuthProvider");
        consoleSpy.mockRestore();
    });
});
