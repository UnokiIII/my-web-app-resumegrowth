/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [],
  },
  experimental: {
    outputFileTracingIncludes: {
      '/api/analyze': ['./scripts/pdf_parse_runner.cjs', './scripts/pdf_to_images.py'],
    },
  },
}

module.exports = nextConfig
