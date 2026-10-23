import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  allowedDevOrigins: ["192.168.100.124"],
  reactStrictMode: true,
  typedRoutes: true
};

export default nextConfig;
