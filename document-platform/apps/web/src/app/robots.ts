import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:5173').replace(/\/$/, '');
  return { rules: { userAgent: '*', allow: '/', disallow: ['/app/', '/admin/'] }, sitemap: `${base}/sitemap.xml` };
}
