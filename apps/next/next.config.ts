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

  

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};



export default nextConfig;
