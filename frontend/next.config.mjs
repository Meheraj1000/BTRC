/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Docker uses a standalone server. Vercel builds and hosts Next itself.
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
  async redirects() {
    return [];
  },
};

export default nextConfig;
