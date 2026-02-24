import React from "react"
import type { Metadata, Viewport } from 'next'
import { DM_Sans, DM_Mono } from 'next/font/google'

import './globals.css'

const _dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' })
const _dmMono = DM_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-dm-mono',
})

export const metadata: Metadata = {
  title: 'CardPilot — Credit Card Optimizer',
  description:
    'AI-powered credit card optimization. Find the best card for every spending category using your existing wallet.',
}

export const viewport: Viewport = {
  themeColor: '#1e2430',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${_dmSans.variable} ${_dmMono.variable} font-sans antialiased`} suppressHydrationWarning>{children}</body>
    </html>
  )
}
