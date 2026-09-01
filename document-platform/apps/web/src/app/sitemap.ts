import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://apptoolkitlab.com').replace(/\/$/, '');
  const paths = [
    '',
    '/tools',
    '/software',
    '/automations',
    '/saas',
    '/pricing',
    '/about',
    '/blog',
    '/faq',
    '/contact',
    '/policies',
    '/privacy',
    '/data-policy',
    '/terms',
    '/refund-policy',
  ];

  return paths.map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '' || path === '/blog' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : path === '/tools' || path === '/software' ? 0.9 : 0.7,
  }));
}
