"use client"

import React from "react"
import { useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import {
  CreditCard,
  ArrowRight,
  Wallet,
  ShieldCheck,
  Lightbulb,
  BarChart3,
  Grid3X3,
  MessageSquare,
} from "lucide-react"
import { CardInput } from "@/components/card-input"
import { ResultsDisplay } from "@/components/results-display"

const transport = new DefaultChatTransport({ api: "/api/optimize" })

export default function Page() {
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { messages, sendMessage, status } = useChat({
    transport,
    onError(err) {
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
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      {/* Soft gradient background blobs */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden="true"
      >
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-secondary/20 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
      </div>

      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary">
              <CreditCard className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground">
              CreditCardGo
            </span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            <a
              href="#how-it-works"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              How it works
            </a>
            <a
              href="#features"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Features
            </a>
            <a
              href="#wallet"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              My Wallet
            </a>
          </div>
          <a
            href="#wallet"
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground shadow-sm transition-all hover:brightness-105 active:scale-[0.97] active:shadow-none"
          >
            Get Recommendations
          </a>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        {!hasSubmitted ? (
          <div className="flex flex-col gap-16 pb-20">
            {/* Hero Section */}
            <section className="flex flex-col items-center gap-6 pt-16 text-center md:pt-24">
              <h1 className="text-balance text-4xl font-bold leading-tight text-foreground md:text-5xl lg:text-6xl">
                Play the credit card game{" "}
                <span className="text-primary">&#8212; smarter.</span>
              </h1>
              <p className="max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground md:text-xl">
                Tool for those who passionate to play the credit card system.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <a
                  href="#wallet"
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3 text-sm font-semibold text-accent-foreground shadow-md transition-all hover:brightness-105 active:scale-[0.97] active:shadow-sm"
                >
                  <Wallet className="h-4 w-4" />
                  Connect Wallet
                </a>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 rounded-full bg-secondary px-7 py-3 text-sm font-semibold text-secondary-foreground shadow-sm transition-all hover:brightness-[0.97] active:scale-[0.97] active:shadow-none"
                >
                  See Demo
                </a>
              </div>

              {/* Category pills */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
                {[
                  "Groceries",
                  "Travel",
                  "Rent",
                  "Dining",
                  "Gas",
                  "Online Shopping",
                ].map((cat) => (
                  <span
                    key={cat}
                    className="rounded-full border border-border/80 bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </section>

            {/* How it works */}
            <section id="how-it-works" className="flex flex-col gap-8">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-foreground md:text-3xl">
                  How it works
                </h2>
                <p className="mt-2 text-muted-foreground">
                  Three simple steps to optimize your wallet
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <StepCard
                  step="1"
                  title="Add your cards"
                  description="Select the credit cards you already carry from our catalog of 100+ popular cards."
                />
                <StepCard
                  step="2"
                  title="AI researches"
                  description="Our agents scrape real-time rewards rates, fees, and perks for each card you own."
                />
                <StepCard
                  step="3"
                  title="Get your playbook"
                  description="Receive a category-by-category guide on which card to use for maximum rewards."
                />
              </div>
            </section>

            {/* Feature Cards */}
            <section id="features" className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FeatureCard
                icon={<BarChart3 className="h-5 w-5" />}
                title="Compare Benefits"
                description="Side-by-side comparison of annual fees, reward rates, and key perks across your entire wallet."
              />
              <FeatureCard
                icon={<Grid3X3 className="h-5 w-5" />}
                title="Category-by-Category Picks"
                description="Know exactly which card to pull out for groceries, dining, travel, gas, rent, and more."
              />
              <FeatureCard
                icon={<MessageSquare className="h-5 w-5" />}
                title="Explainable Recommendations"
                description="Every recommendation comes with clear reasoning so you understand the why, not just the what."
              />
            </section>

            {/* Wallet Input Section */}
            <section
              id="wallet"
              className="scroll-mt-24 rounded-3xl border border-border/60 bg-card p-6 shadow-sm md:p-10"
            >
              <div className="mb-8 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/20">
                  <ArrowRight className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    Your Wallet
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Select the cards you carry, then let our AI do the rest.
                  </p>
                </div>
              </div>
              <CardInput onSubmit={handleSubmit} isLoading={isLoading} />
            </section>
          </div>
        ) : (
          <div className="flex flex-col gap-6 py-10">
            {/* Results Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  Your Optimization Report
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Personalized recommendations based on your wallet
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setHasSubmitted(false)
                  window.location.reload()
                }}
                className="rounded-full border border-border bg-card px-5 py-2 text-sm font-medium text-muted-foreground shadow-sm transition-all hover:text-foreground active:scale-[0.97]"
              >
                Start over
              </button>
            </div>

            {/* Error State */}
            {error && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Results Content */}
            <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm md:p-10">
              <ResultsDisplay messages={messages} isStreaming={isLoading} />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-10 border-t border-border/60">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-muted-foreground md:flex-row">
          <div className="flex items-center gap-6">
            <a href="#" className="transition-colors hover:text-foreground">
              Privacy
            </a>
            <a href="#" className="transition-colors hover:text-foreground">
              Terms
            </a>
            <a href="#" className="transition-colors hover:text-foreground">
              Contact
            </a>
          </div>
          <span className="text-center">
            Built for people who love playing the credit card system —
            responsibly.
          </span>
        </div>
      </footer>
    </div>
  )
}

function StepCard({
  step,
  title,
  description,
}: {
  step: string
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/30 text-sm font-bold text-foreground">
        {step}
      </span>
      <h3 className="font-bold text-foreground">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
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
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary/60 text-foreground">
        {icon}
      </div>
      <h3 className="font-bold text-foreground">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  )
}
