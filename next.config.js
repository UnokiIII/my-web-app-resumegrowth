const rawFrontendVersion =
  process.env.NEXT_PUBLIC_FRONTEND_VERSION || process.env.VERCEL_GIT_COMMIT_SHA || 'local-dev'

const frontendVersion = rawFrontendVersion === 'local-dev' ? rawFrontendVersion : rawFrontendVersion.slice(0, 7)

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_FRONTEND_VERSION: frontendVersion,
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
