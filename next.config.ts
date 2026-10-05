import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray package-lock.json exists in the home directory; pin the workspace root to this repo.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
