// Structured card data types for the agent system

export interface RewardCategory {
  category: string
  rate: string // e.g., "3x points", "5% cash back"
  cap?: string // e.g., "$6,000/year", "unlimited"
}

export interface CardData {
  name: string
  bank: string
  annualFee: number
  rewardCategories: RewardCategory[]
  signUpBonus?: {
    value: string // e.g., "60,000 points"
    requirement: string // e.g., "Spend $4,000 in first 3 months"
    estimatedCashValue?: string
  }
  foreignTransactionFee: string // e.g., "None", "3%"
  creditScoreRequired?: string // e.g., "Good to Excellent (670+)"
  perks?: string[]
  lastUpdated: string // ISO date
}

export interface CardComparison {
  cards: CardData[]
  categoryWinners: {
    category: string
    winner: string
    reason: string
  }[]
  overallRecommendation: string
}

export interface SpendingProfile {
  dining?: number
  groceries?: number
  travel?: number
  gas?: number
  streaming?: number
  rent?: number
  other?: number
}

export interface AnnualValueEstimate {
  cardName: string
  totalRewardsValue: number
  annualFee: number
  netValue: number
  breakdown: {
    category: string
    spend: number
    rewardRate: string
    estimatedValue: number
  }[]
}

// Agent types for multi-agent system
export type AgentRole = 'research' | 'analysis' | 'recommendation'

export interface AgentContext {
  currentAgent: AgentRole
  cardData: Map<string, CardData>
  researchComplete: boolean
  analysisComplete: boolean
}

export interface AgentHandoff {
  from: AgentRole
  to: AgentRole
  context: Record<string, unknown>
  reason: string
}
