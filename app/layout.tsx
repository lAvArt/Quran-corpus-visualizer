import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { Amiri, Fraunces, Space_Grotesk } from "next/font/google";
import { cookies } from "next/headers";
import {
  THEME_COOKIE_NAME,
  buildThemeDocumentState,
  getThemeBootstrapScript,
  parseThemePreferenceCookie,
} from "@/lib/theme/themePreferences";
import "./[locale]/globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const amiri = Amiri({
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  variable: "--font-arabic",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://quran.pluragate.org"),
};

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const themeDocumentState = buildThemeDocumentState(
    parseThemePreferenceCookie(cookieStore.get(THEME_COOKIE_NAME)?.value)
  );

  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${fraunces.variable} ${amiri.variable}`}
      data-theme={themeDocumentState.theme}
      data-color-theme={themeDocumentState.colorThemeId}
      style={themeDocumentState.style as CSSProperties}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: getThemeBootstrapScript() }} />
      </head>
      <body className="body-root">{children}</body>
    </html>
  );
}
