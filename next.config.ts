import type { NextConfig } from 'next'; 

const nextConfig: NextConfig = {
  // Updated: moved from experimental to top-level config
  serverExternalPackages: ["sharp", "puppeteer"],
  // Add this to increase the memory limit for image processing and puppeteer
  webpack: (config) => {
    config.externals = [...(config.externals || []), "sharp", "puppeteer"]
    return config
  },
}

module.exports = nextConfig