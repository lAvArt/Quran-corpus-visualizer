import type { Metadata } from "next";
import { Amiri, Fraunces, Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "./providers";
import "./globals.css";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '../../i18n/routing';

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

export const metadata: Metadata = {
  metadataBase: new URL('https://quran-corpus-visualizer.vercel.app'), // Replace with actual domain if different
  title: {
    default: "Quran Corpus Visualizer",
    template: "%s | Quran Corpus Visualizer"
  },
  description: "Explore the Quran through interactive linguistic graphs, root-to-word flows, and advanced corpus visualization tools.",
  keywords: ["Quran", "Corpus", "Visualization", "Linguistics", "Arabic", "Islam", "Data Visualization", "Graph", "Roots", "Morphology"],
  authors: [{ name: "Quran Corpus Visualizer Team" }],
  creator: "Quran Corpus Visualizer",
  publisher: "Quran Corpus Visualizer",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://quran-corpus-visualizer.vercel.app",
    title: "Quran Corpus Visualizer",
    description: "Interactive exploration of Quranic linguistic structure and morphology.",
    siteName: "Quran Corpus Visualizer",
    images: [
      {
        url: "/og-image.jpg", // Ensure this image exists in public/
        width: 1200,
        height: 630,
        alt: "Quran Corpus Visualizer Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Quran Corpus Visualizer",
    description: "Deep dive into Quranic linguistics with interactive visualizations.",
    images: ["/og-image.jpg"], // Ensure this image exists in public/
  },
  alternates: {
    canonical: "/",
    languages: {
      'en-US': '/en',
      'ar-SA': '/ar',
    },
  },
};

export default async function RootLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  // Ensure that the incoming `locale` is valid
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  const direction = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html
      lang={locale}
      dir={direction}
      className={`${spaceGrotesk.variable} ${fraunces.variable} ${amiri.variable}`}
    >
      <body className="body-root">
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
        <Analytics />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "Quran Corpus Visualizer",
              "url": "https://quran-corpus-visualizer.vercel.app",
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://quran-corpus-visualizer.vercel.app/?q={search_term_string}", // Updated target to match app structure
                "query-input": "required name=search_term_string"
              }
            })
          }}
        />
      </body>
    </html>
  );
}
