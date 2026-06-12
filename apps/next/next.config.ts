import path from "path";

const nextConfig = {
  turbopack: {
    root: path.join(__dirname, '../..'),
  },

  serverExternalPackages: [
    "@google/generative-ai",
    "scribe.js-ocr",
    "@scribe.js/canvas",
    "@scribe.js/canvas-win32-x64-msvc",
  ],
};


export default nextConfig;
