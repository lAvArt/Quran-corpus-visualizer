import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("AuthButton", () => {
    const mockSignOut = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders nothing while loading", () => {
        mockUseAuth.mockReturnValue({
            user: null,
            session: null,
            loading: true,
        } as any);

        const { container } = render(<AuthButton />);

        expect(container.firstChild).toBeNull();
    });

    it("renders Sign In link when user is anonymous", () => {
        mockUseAuth.mockReturnValue({
            user: null,
            session: null,
            loading: false,
        } as any);

        render(<AuthButton />);

        const link = screen.getByRole("link");
        expect(link).toBeTruthy();
        // Translation key "signIn" is returned as-is by the mock
        expect(link.textContent).toBe("signIn");
        expect(link.getAttribute("href")).toBe("/auth/login");
    });

    it("renders user initials button when authenticated", () => {
        mockUseAuth.mockReturnValue({
            user: { id: "uid-1", email: "hello@example.com" },
            session: {},
            loading: false,
            signOut: mockSignOut,
        } as any);

        render(<AuthButton />);

        const button = screen.getByRole("button", { expanded: false });
        expect(button.textContent).toBe("HE"); // first 2 chars of "hello"
    });

    it("shows dropdown with email and profile link on button click", async () => {
        mockUseAuth.mockReturnValue({
            user: { id: "uid-1", email: "user@test.com" },
            session: {},
            loading: false,
            signOut: mockSignOut,
        } as any);

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
        mockUseAuth.mockReturnValue({
            user: { id: "uid-1", email: "user@test.com" },
            session: {},
            loading: false,
            signOut: mockSignOut,
        } as any);

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
        mockUseAuth.mockReturnValue({
            user: { id: "uid-1", email: "user@test.com" },
            session: {},
            loading: false,
            signOut: mockSignOut,
        } as any);

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
        mockUseAuth.mockReturnValue({
            user: { id: "uid-2", email: "a@short.com" },
            session: {},
            loading: false,
            signOut: mockSignOut,
        } as any);

        render(<AuthButton />);

        const button = screen.getByRole("button");
        expect(button.textContent).toBe("A");
    });
});
