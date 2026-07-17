import type { NextConfig } from "next";
import path from "path";

// Monorepo root (pnpm workspace). Both tracing + turbopack roots must match.
const root = path.join(__dirname, "../..");

const nextConfig: NextConfig = {
  outputFileTracingRoot: root,
  turbopack: {
    root,
  },
  serverExternalPackages: ["mongoose"],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
