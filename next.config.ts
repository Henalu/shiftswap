import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Registration sends the employee ID card through a Server Action.
      // Allow enough room for the 5 MB file plus multipart overhead.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
