import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@docconv/shared-types',
    '@docconv/tool-registry',
    '@docconv/processing-core',
  ],
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.INTERNAL_API_URL || 'http://localhost:4201'}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
