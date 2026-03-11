import type { Metadata, Viewport } from "next";
import { Amiri, Fraunces, Space_Grotesk } from "next/font/google";
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

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${fraunces.variable} ${amiri.variable}`}
      suppressHydrationWarning
    >
      <body className="body-root">{children}</body>
    </html>
  );
}
