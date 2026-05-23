/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,

  images: {
    domains: ["res.cloudinary.com"], // ✅ Cloudinary domain allow
  },
};

export default nextConfig;