import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quran Corpus Visualizer",
  description: "Linguistic graph exploration with root-to-word flow and corpus filters."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
