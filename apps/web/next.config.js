/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@twick/video-editor",
    "@twick/timeline",
    "@twick/live-player",
    "@twick/canvas",
    "@twick/media-utils",
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
  },
};

export default nextConfig;
