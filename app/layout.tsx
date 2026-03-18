import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

export const metadata: Metadata = {
  title: 'Resume Analyzer | 一人企业成长方案',
  description: '上传简历，获取AI生成的一人企业成长方案。分析你的优势资产，规划清晰的增长路径。',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className={`${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}