/** @type {import('next').NextConfig} */
const apiOrigin = (process.env.API_ORIGIN ?? "").replace(/\/$/, "");

const nextConfig = {
  reactStrictMode: true,
  // Socket.IO calls /socket.io/ with the slash. The default slash redirect breaks that handshake.
  skipTrailingSlashRedirect: true,
  // Docker uses a standalone server. Vercel builds and hosts Next itself.
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
  async headers() {
    return [
      {
        // The phone keeps a saved copy of the site. Pages must be fetched again
        // so sign-in never keeps calling an expired public address.
        source: "/((?!_next/static|_next/image).*)",
        headers: [
          { key: "Cache-Control", value: "private, no-cache, no-store, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
  async redirects() {
    return [];
  },
  async rewrites() {
    // Live map sockets stay on this site. The browser never calls the temporary tunnel host.
    if (!apiOrigin) return [];
    return [
      { source: "/socket.io", destination: `${apiOrigin}/socket.io/` },
      { source: "/socket.io/", destination: `${apiOrigin}/socket.io/` },
      { source: "/socket.io/:path*", destination: `${apiOrigin}/socket.io/:path*` },
    ];
  },
};

export default nextConfig;
