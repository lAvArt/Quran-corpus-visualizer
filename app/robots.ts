import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/private/', '/pseudo/'],
        },
        sitemap: 'https://quran.pluragate.org/sitemap.xml',
    };
}
