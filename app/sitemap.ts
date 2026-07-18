import { MetadataRoute } from 'next';
import { SITE_URL, LOCALES } from '@/lib/seo/site';

const PAGES = [
    { path: '',              changeFrequency: 'daily'   as const, priority: 1.0 },
    { path: '/search',       changeFrequency: 'weekly'  as const, priority: 0.9 },
    { path: '/study',        changeFrequency: 'weekly'  as const, priority: 0.8 },
    { path: '/quiz',         changeFrequency: 'weekly'  as const, priority: 0.7 },
    { path: '/auth/login',   changeFrequency: 'monthly' as const, priority: 0.3 },
];

// NOTE: /embed/* routes are deliberately NOT listed — app/embed/layout.tsx
// sets robots noindex on them (they're iframe payloads, not landing pages),
// and a sitemap that lists noindexed URLs generates Search Console errors.

export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date();
    const entries: MetadataRoute.Sitemap = [];

    for (const locale of LOCALES) {
        for (const page of PAGES) {
            entries.push({
                url: `${SITE_URL}/${locale}${page.path}`,
                lastModified: now,
                changeFrequency: page.changeFrequency,
                priority: page.priority,
                // hreflang cross-links so Google treats en/ar as one page in
                // two languages instead of duplicate content.
                alternates: {
                    languages: {
                        en: `${SITE_URL}/en${page.path}`,
                        ar: `${SITE_URL}/ar${page.path}`,
                    },
                },
            });
        }
    }

    return entries;
}
