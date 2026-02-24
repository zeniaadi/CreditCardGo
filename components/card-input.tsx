"use client"

import { useState } from "react"
import {
  Plus,
  X,
  CreditCard,
  ChevronDown,
  ChevronRight,
  Search,
  Plane,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface CardInputProps {
  onSubmit: (cards: string[]) => void
  isLoading: boolean
}

interface BankCards {
  bank: string
  cards: string[]
}

const BANK_CATALOG: BankCards[] = [
  {
    bank: "Chase",
    cards: [
      "Sapphire Preferred",
      "Sapphire Reserve",
      "Freedom Unlimited",
      "Freedom Flex",
      "Freedom Rise",
      "Ink Business Preferred",
      "Ink Business Cash",
      "Ink Business Unlimited",
      "United Explorer",
      "United Club Infinite",
      "United Gateway",
      "United Quest",
      "Southwest Rapid Rewards Plus",
      "Southwest Rapid Rewards Priority",
      "Southwest Rapid Rewards Premier",
      "Marriott Bonvoy Boundless",
      "IHG One Rewards Premier",
      "Amazon Prime Visa",
      "Aeroplan Card",
    ],
  },
  {
    bank: "American Express",
    cards: [
      "Gold Card",
      "Platinum Card",
      "Green Card",
      "Blue Cash Preferred",
      "Blue Cash Everyday",
      "Cash Magnet",
      "EveryDay Preferred",
      "Delta SkyMiles Blue",
      "Delta SkyMiles Gold",
      "Delta SkyMiles Platinum",
      "Delta SkyMiles Reserve",
      "Hilton Honors",
      "Hilton Honors Surpass",
      "Hilton Honors Aspire",
      "Marriott Bonvoy Brilliant",
      "Business Gold Card",
      "Business Platinum Card",
      "Blue Business Plus",
      "Blue Business Cash",
    ],
  },
  {
    bank: "Citi",
    cards: [
      "Double Cash",
      "Custom Cash",
      "Strata Premier",
      "Diamond Preferred",
      "Rewards+",
      "AAdvantage Platinum Select",
      "AAdvantage Executive",
      "Costco Anywhere Visa",
    ],
  },
  {
    bank: "Capital One",
    cards: [
      "Venture X",
      "Venture",
      "VentureOne",
      "SavorOne",
      "Savor",
      "Quicksilver",
      "QuicksilverOne",
      "Platinum",
      "Spark Cash Plus",
      "Spark Miles",
    ],
  },
  {
    bank: "Bank of America",
    cards: [
      "Customized Cash Rewards",
      "Unlimited Cash Rewards",
      "Travel Rewards",
      "Premium Rewards",
      "Premium Rewards Elite",
      "Alaska Airlines Visa Signature",
      "Alaska Airlines Business",
    ],
  },
  {
    bank: "Discover",
    cards: ["it Cash Back", "it Miles", "it Chrome", "it Student Cash Back"],
  },
  {
    bank: "Wells Fargo",
    cards: [
      "Active Cash",
      "Autograph",
      "Autograph Journey",
      "Reflect",
      "Bilt Rewards (Wells Fargo)",
    ],
  },
  {
    bank: "US Bank",
    cards: [
      "Altitude Go",
      "Altitude Reserve",
      "Altitude Connect",
      "Cash+",
      "Platinum",
    ],
  },
  {
    bank: "Bilt",
    cards: ["Bilt Mastercard"],
  },
  {
    bank: "Apple / Goldman Sachs",
    cards: ["Apple Card"],
  },
  {
    bank: "Barclays",
    cards: [
      "AAdvantage Aviator Red",
      "AAdvantage Aviator Silver",
      "JetBlue Card",
      "JetBlue Plus Card",
      "Hawaiian Airlines World Elite",
      "Wyndham Rewards Earner Plus",
      "View",
    ],
  },
  {
    bank: "Alaska Airlines (Bank of America)",
    cards: [
      "Alaska Airlines Visa Signature",
      "Alaska Airlines Business",
    ],
  },
  {
    bank: "Delta (American Express)",
    cards: [
      "Delta SkyMiles Blue",
      "Delta SkyMiles Gold",
      "Delta SkyMiles Platinum",
      "Delta SkyMiles Reserve",
    ],
  },
  {
    bank: "United (Chase)",
    cards: [
      "United Explorer",
      "United Quest",
      "United Club Infinite",
      "United Gateway",
    ],
  },
  {
    bank: "Southwest (Chase)",
    cards: [
      "Southwest Rapid Rewards Plus",
      "Southwest Rapid Rewards Priority",
      "Southwest Rapid Rewards Premier",
    ],
  },
  {
    bank: "Frontier / Spirit",
    cards: [
      "Frontier Airlines World Mastercard",
      "Spirit Airlines World Mastercard",
    ],
  },
  {
    bank: "Hotel Cards",
    cards: [
      "Marriott Bonvoy Boundless — Chase",
      "Marriott Bonvoy Bold — Chase",
      "Marriott Bonvoy Brilliant — Amex",
      "Hilton Honors — Amex",
      "Hilton Honors Surpass — Amex",
      "Hilton Honors Aspire — Amex",
      "IHG One Rewards Premier — Chase",
      "IHG One Rewards Traveler — Chase",
      "Hyatt Credit Card — Chase",
      "Wyndham Rewards Earner Plus — Barclays",
    ],
  },
]

// Group banks into categories for visual separation
const BANK_CATEGORIES = [
  {
    label: "Major Banks",
    banks: [
      "Chase",
      "American Express",
      "Citi",
      "Capital One",
      "Bank of America",
      "Discover",
      "Wells Fargo",
      "US Bank",
      "Bilt",
      "Apple / Goldman Sachs",
      "Barclays",
    ],
  },
  {
    label: "Airline Cards",
    banks: [
      "Alaska Airlines (Bank of America)",
      "Delta (American Express)",
      "United (Chase)",
      "Southwest (Chase)",
      "Frontier / Spirit",
    ],
  },
  {
    label: "Hotel Cards",
    banks: ["Hotel Cards"],
  },
]

export function CardInput({ onSubmit, isLoading }: CardInputProps) {
  const [selectedCards, setSelectedCards] = useState<string[]>([])
  const [expandedBanks, setExpandedBanks] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [customCard, setCustomCard] = useState("")
  const [showCustomInput, setShowCustomInput] = useState(false)

  function toggleBank(bank: string) {
    setExpandedBanks((prev) =>
      prev.includes(bank) ? prev.filter((b) => b !== bank) : [...prev, bank]
    )
  }

  function toggleCard(cardLabel: string) {
    setSelectedCards((prev) =>
      prev.includes(cardLabel)
        ? prev.filter((c) => c !== cardLabel)
        : [...prev, cardLabel]
    )
  }

  function addCustomCard() {
    const trimmed = customCard.trim()
    if (trimmed && !selectedCards.includes(trimmed)) {
      setSelectedCards((prev) => [...prev, trimmed])
      setCustomCard("")
    }
  }

  function removeCard(card: string) {
    setSelectedCards((prev) => prev.filter((c) => c !== card))
  }

  function handleSubmit() {
    if (selectedCards.length > 0) {
      onSubmit(selectedCards)
    }
  }

  const filteredBanks = searchQuery.trim()
    ? BANK_CATALOG.map((bank) => ({
        ...bank,
        cards: bank.cards.filter(
          (card) =>
            card.toLowerCase().includes(searchQuery.toLowerCase()) ||
            bank.bank.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter((bank) => bank.cards.length > 0)
    : BANK_CATALOG

  function loadExamples() {
    setSelectedCards([
      "Sapphire Preferred — Chase",
      "Gold Card — American Express",
      "Double Cash — Citi",
      "Freedom Flex — Chase",
    ])
  }

  function getBanksForCategory(categoryBanks: string[]) {
    return filteredBanks.filter((b) => categoryBanks.includes(b.bank))
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search banks or cards..."
          className="pl-10 rounded-xl border-border/80 bg-muted/40 shadow-inner focus-visible:ring-primary"
          disabled={isLoading}
        />
      </div>

      {/* Bank accordion list grouped by category */}
      <div className="flex flex-col gap-4 max-h-[480px] overflow-y-auto pr-1">
        {BANK_CATEGORIES.map((category) => {
          const categoryBanks = getBanksForCategory(category.banks)
          if (categoryBanks.length === 0) return null

          return (
            <div key={category.label} className="flex flex-col gap-1">
              <div className="flex items-center gap-2 px-1 pb-1">
                {category.label === "Airline Cards" && (
                  <Plane className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                {category.label === "Hotel Cards" && (
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {category.label}
                </span>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card shadow-sm">
                {categoryBanks.map((bankGroup, idx) => {
                  const isExpanded =
                    expandedBanks.includes(bankGroup.bank) ||
                    searchQuery.trim().length > 0
                  const selectedCount = bankGroup.cards.filter((card) => {
                    const cardLabel = card.includes(" — ")
                      ? card
                      : `${card} — ${bankGroup.bank}`
                    return selectedCards.includes(cardLabel)
                  }).length

                  return (
                    <div
                      key={bankGroup.bank}
                      className={
                        idx < categoryBanks.length - 1
                          ? "border-b border-border"
                          : ""
                      }
                    >
                      <button
                        type="button"
                        onClick={() => toggleBank(bankGroup.bank)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-secondary/50 transition-colors"
                        disabled={isLoading}
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm font-semibold text-foreground">
                            {bankGroup.bank}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {bankGroup.cards.length} cards
                          </span>
                        </div>
                        {selectedCount > 0 && (
                          <span className="flex items-center justify-center h-5 min-w-5 rounded-full bg-primary text-primary-foreground text-xs font-medium px-1.5">
                            {selectedCount}
                          </span>
                        )}
                      </button>

                      {isExpanded && (
                        <div className="flex flex-col pb-2">
                          {bankGroup.cards.map((card) => {
                            const cardLabel = card.includes(" — ")
                              ? card
                              : `${card} — ${bankGroup.bank}`
                            const isChecked = selectedCards.includes(cardLabel)

                            return (
                              <label
                                key={card}
                                className="flex items-center gap-3 px-4 py-2 pl-11 cursor-pointer hover:bg-secondary/30 transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleCard(cardLabel)}
                                  disabled={isLoading}
                                  className="h-4 w-4 rounded border-border text-accent accent-[hsl(var(--accent))] focus:ring-accent"
                                />
                                <span
                                  className={`text-sm ${
                                    isChecked
                                      ? "text-foreground font-medium"
                                      : "text-foreground/70"
                                  }`}
                                >
                                  {card.includes(" — ") ? card : card}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {filteredBanks.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No matching cards found. Add it manually below.
          </div>
        )}
      </div>

      {/* Custom card entry */}
      <div>
        {!showCustomInput ? (
          <button
            type="button"
            onClick={() => setShowCustomInput(true)}
            className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
            disabled={isLoading}
          >
            {"Don't see your card? Add it manually"}
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <label
              htmlFor="custom-card-input"
              className="text-sm font-medium text-muted-foreground"
            >
              Add a card manually (Card Name — Bank)
            </label>
            <div className="flex gap-2">
              <Input
                id="custom-card-input"
                value={customCard}
                onChange={(e) => setCustomCard(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addCustomCard()
                  }
                }}
                placeholder="e.g. My Rewards Card — My Bank"
                className="flex-1 rounded-xl border-border/80 bg-muted/40 shadow-inner focus-visible:ring-primary"
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={addCustomCard}
                disabled={!customCard.trim() || isLoading}
                aria-label="Add card"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Selected cards summary */}
      {selectedCards.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Your wallet ({selectedCards.length} card
            {selectedCards.length !== 1 ? "s" : ""})
          </span>
          <div className="flex flex-wrap gap-2">
            {selectedCards.map((card) => (
              <div
                key={card}
                className="flex items-center gap-2 rounded-full bg-secondary/60 border border-border/60 px-3.5 py-2 text-sm text-secondary-foreground shadow-sm"
              >
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{card}</span>
                <button
                  type="button"
                  onClick={() => removeCard(card)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  disabled={isLoading}
                  aria-label={`Remove ${card}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSubmit}
          disabled={selectedCards.length === 0 || isLoading}
          className="rounded-full bg-accent text-accent-foreground shadow-md hover:brightness-105 active:scale-[0.97] active:shadow-sm px-7 py-3 font-semibold"
        >
          {isLoading ? (
            <>
              <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-accent-foreground border-t-transparent" />
              Analyzing...
            </>
          ) : (
            "Optimize My Wallet"
          )}
        </Button>
        {selectedCards.length === 0 && (
          <button
            type="button"
            onClick={loadExamples}
            className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Try an example
          </button>
        )}
      </div>
    </div>
  )
}
