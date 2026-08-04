import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // unpdf uses WASM internally — no special config needed
  // Removed pdf-parse (caused native canvas dependency crashes on Vercel)
};

export default nextConfig;
