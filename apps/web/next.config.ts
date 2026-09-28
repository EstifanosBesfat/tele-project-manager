import type { NextConfig } from 'next';
import path from 'path';

const vercelApiUrl = 'https://teleprojectmanager-three.vercel.app/api';
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL;
const nextPublicApiUrl =
  rawApiUrl && !rawApiUrl.includes('railway.app')
    ? rawApiUrl.replace(/\/$/, '')
    : process.env.VERCEL || process.env.NODE_ENV === 'production'
      ? vercelApiUrl
      : (rawApiUrl ?? 'http://localhost:4000/api');

const nextConfig: NextConfig = {
  // Standalone is for Docker; Vercel uses its own Next.js output.
  ...(process.env.VERCEL ? {} : { output: 'standalone' as const }),
  env: {
    // Force-correct a stale Railway URL left in the Vercel project env.
    NEXT_PUBLIC_API_URL: nextPublicApiUrl,
  },
  // Monorepo: trace files from repo root
  outputFileTracingRoot: path.join(__dirname, '../..'),
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
