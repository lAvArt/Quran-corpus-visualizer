"use client";

import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";

type MobileSurface = "none" | "context" | "tools" | "search" | "nav";

interface VizControlContextType {
    activeMobileSurface: MobileSurface;
    isMobileViewport: boolean;
    isLeftSidebarOpen: boolean;
    isRightSidebarOpen: boolean;
    isMobileNavOpen: boolean;
    isMobileSearchOpen: boolean;
    closeMobileSurface: () => void;
    openMobileSurface: (surface: Exclude<MobileSurface, "none">) => void;
    toggleMobileSurface: (surface: Exclude<MobileSurface, "none">) => void;
    toggleLeftSidebar: () => void;
    toggleRightSidebar: () => void;
    toggleMobileNav: () => void;
    toggleMobileSearch: () => void;
    setLeftSidebarOpen: (isOpen: boolean) => void;
    setRightSidebarOpen: (isOpen: boolean) => void;
    setMobileNavOpen: (isOpen: boolean) => void;
    setMobileSearchOpen: (isOpen: boolean) => void;
}

const VizControlContext = createContext<VizControlContextType | undefined>(undefined);

export function VizControlProvider({ children }: { children: ReactNode }) {
    // Start closed, then sync to viewport after mount:
    // desktop => open, mobile => closed
    const [isMobileViewport, setIsMobileViewport] = useState(false);
    const [activeMobileSurface, setActiveMobileSurface] = useState<MobileSurface>("none");
    const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
    const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const media = window.matchMedia("(max-width: 900px)");
        const syncLeftSidebar = () => {
            const isMobile = media.matches;
            setIsMobileViewport(isMobile);
            if (isMobile) {
                setIsLeftSidebarOpen(false);
                setIsRightSidebarOpen(false);
                setActiveMobileSurface("none");
                return;
            }

            setIsLeftSidebarOpen(true);
            setIsRightSidebarOpen(false);
            setActiveMobileSurface("none");
        };

        syncLeftSidebar();
        media.addEventListener("change", syncLeftSidebar);
        return () => {
            media.removeEventListener("change", syncLeftSidebar);
        };
    }, []);

    const closeMobileSurface = useCallback(() => {
        setActiveMobileSurface("none");
        setIsLeftSidebarOpen(false);
        setIsRightSidebarOpen(false);
    }, []);

    const openMobileSurface = useCallback((surface: Exclude<MobileSurface, "none">) => {
        setActiveMobileSurface(surface);
        setIsLeftSidebarOpen(surface === "context");
        setIsRightSidebarOpen(surface === "tools");
    }, []);

    const toggleMobileSurface = useCallback((surface: Exclude<MobileSurface, "none">) => {
        setActiveMobileSurface((prev) => {
            const next = prev === surface ? "none" : surface;
            setIsLeftSidebarOpen(next === "context");
            setIsRightSidebarOpen(next === "tools");
            return next;
        });
    }, []);

    const setLeftSidebarOpen = useCallback((isOpen: boolean) => {
        if (isMobileViewport) {
            if (isOpen) {
                openMobileSurface("context");
                return;
            }
            if (activeMobileSurface === "context") {
                closeMobileSurface();
            }
            return;
        }

        setIsLeftSidebarOpen(isOpen);
    }, [activeMobileSurface, closeMobileSurface, isMobileViewport, openMobileSurface]);

    const setRightSidebarOpen = useCallback((isOpen: boolean) => {
        if (isMobileViewport) {
            if (isOpen) {
                openMobileSurface("tools");
                return;
            }
            if (activeMobileSurface === "tools") {
                closeMobileSurface();
            }
            return;
        }

        setIsRightSidebarOpen(isOpen);
    }, [activeMobileSurface, closeMobileSurface, isMobileViewport, openMobileSurface]);

    const setMobileNavOpen = useCallback((isOpen: boolean) => {
        if (!isMobileViewport) return;
        if (isOpen) {
            openMobileSurface("nav");
            return;
        }
        if (activeMobileSurface === "nav") {
            closeMobileSurface();
        }
    }, [activeMobileSurface, closeMobileSurface, isMobileViewport, openMobileSurface]);

    const setMobileSearchOpen = useCallback((isOpen: boolean) => {
        if (!isMobileViewport) return;
        if (isOpen) {
            openMobileSurface("search");
            return;
        }
        if (activeMobileSurface === "search") {
            closeMobileSurface();
        }
    }, [activeMobileSurface, closeMobileSurface, isMobileViewport, openMobileSurface]);

    const toggleLeftSidebar = useCallback(() => {
        if (isMobileViewport) {
            toggleMobileSurface("context");
            return;
        }
        setIsLeftSidebarOpen(prev => !prev);
    }, [isMobileViewport, toggleMobileSurface]);

    const toggleRightSidebar = useCallback(() => {
        if (isMobileViewport) {
            toggleMobileSurface("tools");
            return;
        }
        setIsRightSidebarOpen(prev => !prev);
    }, [isMobileViewport, toggleMobileSurface]);

    const toggleMobileNav = useCallback(() => {
        if (!isMobileViewport) return;
        toggleMobileSurface("nav");
    }, [isMobileViewport, toggleMobileSurface]);

    const toggleMobileSearch = useCallback(() => {
        if (!isMobileViewport) return;
        toggleMobileSurface("search");
    }, [isMobileViewport, toggleMobileSurface]);

    const isMobileNavOpen = activeMobileSurface === "nav";
    const isMobileSearchOpen = activeMobileSurface === "search";

    return (
        <VizControlContext.Provider
            value={{
                activeMobileSurface,
                isMobileViewport,
                isLeftSidebarOpen,
                isRightSidebarOpen,
                isMobileNavOpen,
                isMobileSearchOpen,
                closeMobileSurface,
                openMobileSurface,
                toggleMobileSurface,
                toggleLeftSidebar,
                toggleRightSidebar,
                toggleMobileNav,
                toggleMobileSearch,
                setLeftSidebarOpen,
                setRightSidebarOpen,
                setMobileNavOpen,
                setMobileSearchOpen,
            }}
        >
            {children}
        </VizControlContext.Provider>
    );
}

export function useVizControl() {
    const context = useContext(VizControlContext);
    if (context === undefined) {
        throw new Error("useVizControl must be used within a VizControlProvider");
    }
    return context;
}
