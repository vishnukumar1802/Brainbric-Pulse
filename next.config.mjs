/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // PGlite (local-only database) ships WebAssembly; keep it out of the server bundle.
    serverComponentsExternalPackages: ['@electric-sql/pglite'],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
