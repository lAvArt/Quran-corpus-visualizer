import { MetadataRoute } from 'next';

const BASE_URL = 'https://quran.pluragate.org';
const LOCALES = ['en', 'ar'] as const;

const PAGES = [
    { path: '',              changeFrequency: 'daily'   as const, priority: 1.0 },
    { path: '/search',       changeFrequency: 'weekly'  as const, priority: 0.9 },
    { path: '/study',        changeFrequency: 'weekly'  as const, priority: 0.8 },
    { path: '/quiz',         changeFrequency: 'weekly'  as const, priority: 0.7 },
    { path: '/auth/login',   changeFrequency: 'monthly' as const, priority: 0.3 },
];

const VIZ_MODES = [
    'radial-sura',
    'root-network',
    'arc-flow',
    'dependency-tree',
    'sankey-flow',
    'surah-distribution',
    'corpus-architecture',
    'knowledge-graph',
    'collocation-network',
    'heatmap',
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date();
    const entries: MetadataRoute.Sitemap = [];

    // Root URL
    entries.push({
        url: BASE_URL,
        lastModified: now,
        changeFrequency: 'daily',
        priority: 1.0,
    });

    // Locale pages
    for (const locale of LOCALES) {
        for (const page of PAGES) {
            entries.push({
                url: `${BASE_URL}/${locale}${page.path}`,
                lastModified: now,
                changeFrequency: page.changeFrequency,
                priority: page.priority,
            });
        }
    }

    // Embed visualization routes (useful for SEO as standalone content pages)
    for (const mode of VIZ_MODES) {
        entries.push({
            url: `${BASE_URL}/embed/${mode}`,
            lastModified: now,
            changeFrequency: 'monthly',
            priority: 0.4,
        });
    }

    return entries;
}
