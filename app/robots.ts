import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo/site';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            // /embed/* is intentionally NOT disallowed: those pages carry a
            // robots noindex meta, and crawlers must be able to fetch them to
            // see it. Blocking them here would hide the noindex.
            disallow: ['/private/', '/pseudo/', '/api/'],
        },
        sitemap: `${SITE_URL}/sitemap.xml`,
    };
}
