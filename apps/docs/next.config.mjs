import { createMDX } from "fumadocs-mdx/next";

/** @type {import('next').NextConfig} */
const config = {
  output: "export",
  reactStrictMode: true,
  // next/image is unsupported under `output: export` without a custom loader.
  images: { unoptimized: true },
};

const withMDX = createMDX();

export default withMDX(config);
