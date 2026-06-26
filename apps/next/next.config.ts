import path from "path";
import type { NextConfig } from 'next';


const nextConfig :NextConfig ={
  turbopack: {
    root: path.join(/*turbopackIgnore: true*/__dirname, '../..'),
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

