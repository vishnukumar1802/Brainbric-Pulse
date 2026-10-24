import type { MetadataRoute } from 'next';

// Private portal: ask every crawler to stay out of the whole site.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  };
}
