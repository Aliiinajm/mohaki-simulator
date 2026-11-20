import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server to be reached from another host (e.g. a phone or a
  // browser on the LAN) without Next.js rejecting the cross-origin request.
  // Start the server with:  npm run dev -- -H 0.0.0.0 -p 8080
  allowedDevOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://10.162.197.167:8080",
    "http://10.162.197.167:3000",
  ],
};

export default nextConfig;
