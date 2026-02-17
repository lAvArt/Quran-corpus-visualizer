"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

interface PwaContextValue {
  canInstall: boolean;
  isInstalled: boolean;
  isInstallSupported: boolean;
  promptInstall: () => Promise<boolean>;
}

const PwaContext = createContext<PwaContextValue>({
  canInstall: false,
  isInstalled: false,
  isInstallSupported: false,
  promptInstall: async () => false,
});

function isRunningStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const isStandaloneDisplayMode = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return isStandaloneDisplayMode || iosStandalone;
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsInstalled(isRunningStandalone());

    const media = window.matchMedia("(display-mode: standalone)");
    const syncInstallState = () => setIsInstalled(isRunningStandalone());
    syncInstallState();

    media.addEventListener("change", syncInstallState);
    return () => {
      media.removeEventListener("change", syncInstallState);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      setDeferredPrompt(installEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch (error) {
        console.warn("[PWA] Service worker registration failed:", error);
      }
    };

    if (document.readyState === "complete") {
      void registerServiceWorker();
      return;
    }

    window.addEventListener("load", registerServiceWorker, { once: true });
    return () => {
      window.removeEventListener("load", registerServiceWorker);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt || isInstalled) return false;

    setDeferredPrompt(null);
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    return choice.outcome === "accepted";
  }, [deferredPrompt, isInstalled]);

  const value = useMemo<PwaContextValue>(() => {
    const isInstallSupported = typeof window !== "undefined" && "serviceWorker" in navigator;

    return {
      canInstall: Boolean(deferredPrompt) && !isInstalled,
      isInstalled,
      isInstallSupported,
      promptInstall,
    };
  }, [deferredPrompt, isInstalled, promptInstall]);

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

export function usePwaInstall(): PwaContextValue {
  return useContext(PwaContext);
}
