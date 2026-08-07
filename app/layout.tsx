import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://www.resumegrowth.ink'),
  title: 'ResumeGrowth｜把经历变成一条可执行的路',
  description:
    '上传一份简历，找到你的主定位、第一单打法和 90 天行动路线。ResumeGrowth 面向一人企业与自由职业者，帮助你从经历走到行动。',
  keywords: ['一人企业', '自由职业', '个人商业化', '职业转型', '简历分析', '副业定位'],
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'ResumeGrowth｜把经历变成一条可执行的路',
    description:
      '从简历经历出发，梳理主定位、第一单打法和 90 天行动路线。',
    url: 'https://www.resumegrowth.ink/',
    siteName: 'ResumeGrowth',
    locale: 'zh_CN',
    type: 'website',
    images: [
      {
        url: '/og-cover.png',
        width: 1200,
        height: 630,
        alt: 'ResumeGrowth 一人企业成长方案封面图',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ResumeGrowth｜把经历变成一条可执行的路',
    description:
      '主定位、第一单打法、90 天行动路线，一次生成你的执行版成长方案。',
    images: ['/og-cover.png'],
  },
}

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'ResumeGrowth',
  url: 'https://www.resumegrowth.ink/',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: '从简历经历出发，生成一人企业主定位、第一单打法和 90 天行动路线。',
  inLanguage: 'zh-CN',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'CNY',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className={`${inter.variable} antialiased`}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
        {children}
      </body>
    </html>
  )
}
