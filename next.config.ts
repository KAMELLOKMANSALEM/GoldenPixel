import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project (a stray package-lock.json in the home
  // dir otherwise confuses Next's root inference).
  outputFileTracingRoot: path.join(__dirname),
  // Supabase Storage serves the uploaded art; allow it through next/image.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  // sharp runs on the server only.
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
