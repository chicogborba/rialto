import type { NextConfig } from "next";

// STATIC_EXPORT=1 builds the landing page as plain files for GitHub Pages (see scripts/build-pages.mjs).
const isStatic = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  // A stray package-lock.json may exist in a parent directory; pin the workspace root to this repo.
  turbopack: { root: import.meta.dirname },
  ...(isStatic
    ? {
        output: "export" as const,
        trailingSlash: true,
        basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
