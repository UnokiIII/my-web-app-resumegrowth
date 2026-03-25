/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_FRONTEND_VERSION: '2.1.2',
  },
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
