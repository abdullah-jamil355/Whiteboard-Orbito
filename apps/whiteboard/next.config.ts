import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  allowedDevOrigins: ["192.168.100.124"],
  reactStrictMode: true,
  transpilePackages: ["@workspace/whiteboard", "@workspace/ui"],
  typedRoutes: true
};

export default nextConfig;
