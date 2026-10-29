/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // PGlite (local-only database) ships WebAssembly; keep it out of the server bundle.
    serverComponentsExternalPackages: ['@electric-sql/pglite'],
  },
  poweredByHeader: false,
  async headers() {
    return [
      // 3D office models, textures and motions: public (free licences) and never edited in place (a change gets a new
      // file name), so browsers keep them for a month instead of checking each one on every visit.
      {
        source: '/office3d/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=604800' }],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Keep every page, file and API response out of search engines.
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet, noimageindex' },
        ],
      },
    ];
  },
};

export default nextConfig;
