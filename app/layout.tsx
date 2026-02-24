import React from "react"
import type { Metadata, Viewport } from 'next'
import { Inter, DM_Mono } from 'next/font/google'

import './globals.css'

const _inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const _dmMono = DM_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-dm-mono',
})

export const metadata: Metadata = {
  title: 'CreditCardGo — Play the Credit Card Game Smarter',
  description:
    'Tool for those who passionate to play the credit card system.',
}

export const viewport: Viewport = {
  themeColor: '#F4F3EE',
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
      <body className={`${_inter.variable} ${_dmMono.variable} font-sans antialiased`} suppressHydrationWarning>{children}</body>
    </html>
  )
}
