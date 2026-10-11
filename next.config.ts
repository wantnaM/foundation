import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["sharp", "pdfjs-dist", "@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/.pnpm/@img+sharp-*/node_modules/@img/sharp-*/lib/*.dll",
      "./node_modules/.pnpm/@napi-rs+canvas-*/node_modules/@napi-rs/canvas-*/icudtl.dat",
    ],
  },
};

export default nextConfig;
