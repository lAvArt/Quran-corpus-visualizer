import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Session, User } from "@supabase/supabase-js";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("@/lib/context/AuthContext", () => ({
    useAuth: vi.fn(),
}));

vi.mock("next-intl", () => ({
    useTranslations: vi.fn(() => (key: string) => key),
}));

vi.mock("@/i18n/routing", () => ({
    // Minimal Link that renders a plain anchor so href is testable
    Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));

import { useAuth } from "@/lib/context/AuthContext";
import { AuthButton } from "./AuthButton";

const mockUseAuth = vi.mocked(useAuth);

type MockAuthValue = ReturnType<typeof useAuth>;

function createMockUser(email: string, id = "uid-1"): User {
    return {
        id,
        aud: "authenticated",
        role: "authenticated",
        email,
        email_confirmed_at: undefined,
        phone: "",
        confirmed_at: undefined,
        last_sign_in_at: undefined,
        app_metadata: {},
        user_metadata: {},
        identities: [],
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        is_anonymous: false,
    };
}

function createMockSession(user: User): Session {
    return {
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        expires_at: 1893456000,
        token_type: "bearer",
        user,
    };
}

function createAuthValue(overrides: Partial<MockAuthValue>): MockAuthValue {
    return {
        user: null,
        session: null,
        loading: false,
        signIn: vi.fn(async () => ({ error: null })),
        signUp: vi.fn(async () => ({ error: null })),
        signOut: vi.fn(async () => {}),
        resetPassword: vi.fn(async () => ({ error: null })),
        updatePassword: vi.fn(async () => ({ error: null })),
        ...overrides,
    };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("AuthButton", () => {
    const mockSignOut = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders nothing while loading", () => {
        mockUseAuth.mockReturnValue(createAuthValue({ loading: true }));

        const { container } = render(<AuthButton />);

        expect(container.firstChild).toBeNull();
    });

    it("renders Sign In link when user is anonymous", () => {
        mockUseAuth.mockReturnValue(createAuthValue({}));

        render(<AuthButton />);

        const link = screen.getByRole("link");
        expect(link).toBeTruthy();
        // Translation key "signIn" is returned as-is by the mock
        expect(link.textContent).toBe("signIn");
        expect(link.getAttribute("href")).toBe("/auth/login");
    });

    it("renders user initials button when authenticated", () => {
        const user = createMockUser("hello@example.com");
        mockUseAuth.mockReturnValue(createAuthValue({
            user,
            session: createMockSession(user),
            loading: false,
            signOut: mockSignOut,
        }));

        render(<AuthButton />);

        const button = screen.getByRole("button", { expanded: false });
        expect(button.textContent).toBe("HE"); // first 2 chars of "hello"
    });

    it("shows dropdown with email and profile link on button click", async () => {
        const user = createMockUser("user@test.com");
        mockUseAuth.mockReturnValue(createAuthValue({
            user,
            session: createMockSession(user),
            loading: false,
            signOut: mockSignOut,
        }));

        render(<AuthButton />);

        const initButton = screen.getByRole("button");
        await userEvent.click(initButton);

        // Email displayed in dropdown header
        expect(screen.getByText("user@test.com")).toBeTruthy();
        // Profile menu item
        const profileLink = screen.getByRole("menuitem", { name: "profile" });
        expect(profileLink.getAttribute("href")).toBe("/profile");
    });

    it("hides dropdown after clicking Sign Out", async () => {
        const user = createMockUser("user@test.com");
        mockUseAuth.mockReturnValue(createAuthValue({
            user,
            session: createMockSession(user),
            loading: false,
            signOut: mockSignOut,
        }));

        render(<AuthButton />);

        await userEvent.click(screen.getByRole("button"));
        // Dropdown is visible
        expect(screen.getByRole("menu")).toBeTruthy();

        const signOutBtn = screen.getByRole("menuitem", { name: "signOut" });
        await userEvent.click(signOutBtn);

        expect(mockSignOut).toHaveBeenCalled();
        expect(screen.queryByRole("menu")).toBeNull();
    });

    it("closes dropdown via outside pointer click", async () => {
        const user = createMockUser("user@test.com");
        mockUseAuth.mockReturnValue(createAuthValue({
            user,
            session: createMockSession(user),
            loading: false,
            signOut: mockSignOut,
        }));

        render(
            <div>
                <AuthButton />
                <span data-testid="outside">outside</span>
            </div>
        );

        await userEvent.click(screen.getByRole("button"));
        expect(screen.getByRole("menu")).toBeTruthy();

        // Click outside
        await userEvent.pointer({ target: screen.getByTestId("outside"), keys: "[MouseLeft]" });

        expect(screen.queryByRole("menu")).toBeNull();
    });

    it("builds initials from single-char email prefix", () => {
        const user = createMockUser("a@short.com", "uid-2");
        mockUseAuth.mockReturnValue(createAuthValue({
            user,
            session: createMockSession(user),
            loading: false,
            signOut: mockSignOut,
        }));

        render(<AuthButton />);

        const button = screen.getByRole("button");
        expect(button.textContent).toBe("A");
    });
});
