import { MetadataRoute } from 'next';
import { routing } from '../i18n/routing';

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = 'https://quran.pluragate.org';

    // Base routes for each locale
    const routes = routing.locales.map((locale) => ({
        url: `${baseUrl}/${locale}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 1,
    }));

    // Root route (redirects)
    const root = {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 1,
    };

    return [root, ...routes];
}
