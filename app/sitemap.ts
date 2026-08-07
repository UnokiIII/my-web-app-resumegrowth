import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://www.resumegrowth.ink/',
      changeFrequency: 'monthly',
      priority: 1,
    },
  ]
}
