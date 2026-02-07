"use client";

import { createContext, useContext, useState, ReactNode, useCallback } from "react";

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
    // Default states:
    // Left Sidebar (Legend/Details) defaults to CLOSED on mobile, OPEN on desktop (handled by responsive CSS mostly, but state-wise we start closed to be safe on mobile)
    // We'll trust the components to set initial state or responsive effects if needed, but for now defaulting to false prevents flash of content on mobile.
    // Actually, existing components had `useEffect` to close on mobile.
    // Let's start with TRUE as that matches previous default, but we'll add a mount effect to check width?
    // Simpler: Start TRUE, let the consumer components (or a central effect here) handle resize.
    const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
    const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false); // Tools sidebar usually starts closed or controlled by page
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

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
