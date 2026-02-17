"use client";

import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";

interface VizControlContextType {
    isLeftSidebarOpen: boolean;
    isRightSidebarOpen: boolean;
    isMobileNavOpen: boolean;
    toggleLeftSidebar: () => void;
    toggleRightSidebar: () => void;
    toggleMobileNav: () => void;
    setLeftSidebarOpen: (isOpen: boolean) => void;
    setRightSidebarOpen: (isOpen: boolean) => void;
    setMobileNavOpen: (isOpen: boolean) => void;
}

const VizControlContext = createContext<VizControlContextType | undefined>(undefined);

export function VizControlProvider({ children }: { children: ReactNode }) {
    // Start closed, then sync to viewport after mount:
    // desktop => open, mobile => closed
    const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
    const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false); // Tools sidebar usually starts closed or controlled by page
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const media = window.matchMedia("(max-width: 900px)");
        const syncLeftSidebar = () => {
            setIsLeftSidebarOpen(!media.matches);
        };

        syncLeftSidebar();
        media.addEventListener("change", syncLeftSidebar);
        return () => {
            media.removeEventListener("change", syncLeftSidebar);
        };
    }, []);

    const toggleLeftSidebar = useCallback(() => setIsLeftSidebarOpen(prev => !prev), []);
    const toggleRightSidebar = useCallback(() => setIsRightSidebarOpen(prev => !prev), []);
    const toggleMobileNav = useCallback(() => setIsMobileNavOpen(prev => !prev), []);

    return (
        <VizControlContext.Provider
            value={{
                isLeftSidebarOpen,
                isRightSidebarOpen,
                isMobileNavOpen,
                toggleLeftSidebar,
                toggleRightSidebar,
                toggleMobileNav,
                setLeftSidebarOpen: setIsLeftSidebarOpen,
                setRightSidebarOpen: setIsRightSidebarOpen,
                setMobileNavOpen: setIsMobileNavOpen,
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
