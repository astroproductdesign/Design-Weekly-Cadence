import type { NextConfig } from "next";

// Everything now lives on one board at "/". Old links keep working.
const OLD_ROUTES = ["/me", "/actions", "/present", "/settings", "/lead"];

const nextConfig: NextConfig = {
  async redirects() {
    return OLD_ROUTES.map((source) => ({ source, destination: "/", permanent: false }));
  },
};

export default nextConfig;
