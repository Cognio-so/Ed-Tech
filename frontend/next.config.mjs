/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    authInterrupts: true,
    serverActions: {
      bodySizeLimit: '100mb', // Increased from 10mb to 100mb
    },
  },
  eslint:{
    ignoreDuringBuilds: true,
  }
};

export default nextConfig;
