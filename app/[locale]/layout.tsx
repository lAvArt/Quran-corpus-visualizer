import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { Providers } from "./providers";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '../../i18n/routing';
import { Footer } from "@/components/ui/Footer";

function isRoutingLocale(locale: string): locale is (typeof routing.locales)[number] {
  return routing.locales.includes(locale as (typeof routing.locales)[number]);
}

export const metadata: Metadata = {
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
    url: "https://quran.pluragate.org",
    title: "Quran Corpus Visualizer",
    description: "Interactive exploration of Quranic linguistic structure and morphology.",
    siteName: "Quran Corpus Visualizer",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Quran Corpus Visualizer – Interactive Quranic linguistic exploration",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Quran Corpus Visualizer",
    description: "Deep dive into Quranic linguistics with interactive visualizations.",
    images: ["/twitter-image"],
    creator: "@pluragate",
  },
  alternates: {
    canonical: "/",
    languages: {
      'en-US': '/en',
      'ar-SA': '/ar',
    },
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/icon-any.svg',
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
  if (!isRoutingLocale(locale)) {
    notFound();
  }

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  const direction = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <>
      <NextIntlClientProvider messages={messages}>
        <Providers>
          <div dir={direction} lang={locale} className="locale-shell">
            {children}
            <Footer />
          </div>
        </Providers>
      </NextIntlClientProvider>
      <Analytics />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "Quran Corpus Visualizer",
            "url": "https://quran.pluragate.org",
            "potentialAction": {
              "@type": "SearchAction",
              "target": "https://quran.pluragate.org/?q={search_term_string}",
              "query-input": "required name=search_term_string"
            }
          })
        }}
      />
    </>
  );
}
