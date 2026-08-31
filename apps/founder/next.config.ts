import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // Static export has no server to run the Image Optimization API on, so
  // next/image must serve images as-is instead of trying to route through it.
  images: { unoptimized: true },
};

export default nextConfig;
