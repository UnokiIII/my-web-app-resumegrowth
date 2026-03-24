import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://www.resumegrowth.ink'),
  title: 'ResumeGrowth | 一人企业成长方案',
  description:
    '上传简历，找到最适合自己的主定位、备选路径、第一单打法和 90 天行动建议。',
  openGraph: {
    title: 'ResumeGrowth | 上传简历，找到最短变现路径',
    description:
      '不是帮你找下一份工作，而是帮你找到主定位、备选路径和第一单打法。',
    url: 'https://www.resumegrowth.ink',
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
    title: 'ResumeGrowth | 上传简历，找到最短变现路径',
    description:
      '主定位、备选路径、第一单打法、90 天行动建议，一次生成你的执行版成长方案。',
    images: ['/og-cover.png'],
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
      <body className={`${inter.variable} antialiased`}>{children}</body>
    </html>
  )
}
