/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // Enable Next.js Image Optimization
    remotePatterns: [
      {
        // Google Cloud Storage for tenant logos
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: '/**',
      },
      {
        // Google Cloud Storage alternative domain
        protocol: 'https',
        hostname: '*.storage.googleapis.com',
        pathname: '/**',
      },
    ],
    // Optimize images with these formats
    formats: ['image/avif', 'image/webp'],
    // Cache optimized images for 60 seconds in dev, 1 year in prod
    minimumCacheTTL: process.env.NODE_ENV === 'development' ? 60 : 31536000,
  },
}

export default nextConfig