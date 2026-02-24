"use client"

import React from "react"

import { useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { CreditCard, ArrowRight, Wallet, ShieldCheck, Lightbulb } from "lucide-react"
import { CardInput } from "@/components/card-input"
import { ResultsDisplay } from "@/components/results-display"

const transport = new DefaultChatTransport({ api: "/api/optimize" })

export default function Page() {
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { messages, sendMessage, status } = useChat({
    transport,
    onError(err) {
      console.log("[v0] useChat onError:", err)
      setError(err.message || "Something went wrong. Please try again.")
    },
  })

  const isLoading = status === "streaming" || status === "submitted"

  function handleSubmit(cards: string[]) {
    const formatted = cards.map((c) => `- ${c}`).join("\n")
    const userMessage = `Here are my credit cards:\n\n${formatted}`
    setHasSubmitted(true)
    sendMessage({ text: userMessage })
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary">
            <CreditCard className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight">
              CardPilot
            </h1>
            <p className="text-xs text-muted-foreground">
              Credit Card Optimizer
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {!hasSubmitted ? (
          <div className="flex flex-col gap-10">
            {/* Hero */}
            <section className="flex flex-col gap-4 text-center pt-8 pb-2">
              <h2 className="text-3xl font-bold text-foreground text-balance md:text-4xl">
                Maximize every dollar you spend
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed text-pretty">
                Add the credit cards you already own, and get an AI-powered
                breakdown of which card to use for every spending category —
                plus optional advice if you want to level up.
              </p>
            </section>

            {/* Features */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FeatureCard
                icon={<Wallet className="h-5 w-5" />}
                title="Card Comparison"
                description="See how your cards stack up side-by-side with fees, rewards, and benefits."
              />
              <FeatureCard
                icon={<ShieldCheck className="h-5 w-5" />}
                title="Category Mapping"
                description="Know exactly which card to pull out for groceries, dining, travel, and more."
              />
              <FeatureCard
                icon={<Lightbulb className="h-5 w-5" />}
                title="Smart Advice"
                description="Optional suggestions for cards that could fill gaps in your current lineup."
              />
            </section>

            {/* Input Section */}
            <section className="rounded-xl border border-border bg-card p-6 md:p-8">
              <div className="flex items-center gap-2 mb-6">
                <ArrowRight className="h-4 w-4 text-accent" />
                <h3 className="text-base font-semibold text-foreground">
                  Enter your wallet
                </h3>
              </div>
              <CardInput onSubmit={handleSubmit} isLoading={isLoading} />
            </section>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Results Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Your Optimization Report
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Personalized recommendations based on your wallet
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setHasSubmitted(false)
                  window.location.reload()
                }}
                className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              >
                Start over
              </button>
            </div>

            {/* Error State */}
            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Results Content */}
            <div className="rounded-xl border border-border bg-card p-6 md:p-8">
              <ResultsDisplay messages={messages} isStreaming={isLoading} />
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-border mt-16">
        <div className="mx-auto max-w-4xl px-4 py-6 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            CardPilot is informational only. Not financial advice.
          </span>
          <span>
            Powered by AI. Rates and benefits may vary.
          </span>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-secondary text-foreground">
        {icon}
      </div>
      <h3 className="font-semibold text-foreground text-sm">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  )
}
