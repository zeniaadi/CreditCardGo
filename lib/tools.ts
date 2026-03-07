import { tool } from 'ai'
import { z } from 'zod'
import { getCachedCard, setCachedCard } from './cache'
import { scrapeCardInfo, scrapeFromGoogle } from './scrape-card'
import type { CardData, RewardCategory, SpendingProfile, AnnualValueEstimate } from './types'

// Schema for structured card data
const CardDataSchema = z.object({
  name: z.string(),
  bank: z.string(),
  annualFee: z.number(),
  rewardCategories: z.array(z.object({
    category: z.string(),
    rate: z.string(),
    cap: z.string().optional(),
  })),
  signUpBonus: z.object({
    value: z.string(),
    requirement: z.string(),
    estimatedCashValue: z.string().optional(),
  }).optional(),
  foreignTransactionFee: z.string(),
  creditScoreRequired: z.string().optional(),
  perks: z.array(z.string()).optional(),
})

// Parse raw scraped text into structured CardData
function parseCardData(rawText: string, cardName: string, bank: string): CardData {
  const data: CardData = {
    name: cardName,
    bank: bank,
    annualFee: 0,
    rewardCategories: [],
    foreignTransactionFee: 'Unknown',
    lastUpdated: new Date().toISOString(),
  }

  // Extract annual fee
  const feeMatch = rawText.match(/annual\s*fee[:\s]*\$?(\d+)/i)
  if (feeMatch) {
    data.annualFee = parseInt(feeMatch[1], 10)
  } else if (/no\s*annual\s*fee/i.test(rawText)) {
    data.annualFee = 0
  }

  // Extract reward categories
  const rewardPatterns = [
    /(\d+)[x%]\s*(points?|cash\s*back|miles?)?\s*(on|for|at)?\s*(dining|restaurants?|food)/gi,
    /(\d+)[x%]\s*(points?|cash\s*back|miles?)?\s*(on|for|at)?\s*(groceries|supermarkets?|grocery)/gi,
    /(\d+)[x%]\s*(points?|cash\s*back|miles?)?\s*(on|for|at)?\s*(travel|flights?|hotels?|airfare)/gi,
    /(\d+)[x%]\s*(points?|cash\s*back|miles?)?\s*(on|for|at)?\s*(gas|fuel|gas\s*stations?)/gi,
    /(\d+)[x%]\s*(points?|cash\s*back|miles?)?\s*(on|for|at)?\s*(streaming|entertainment)/gi,
    /(\d+)[x%]\s*(points?|cash\s*back|miles?)?\s*(on|for|everything\s*else|all\s*other)/gi,
  ]

  const categoryMap: Record<string, string> = {
    'dining': 'Dining',
    'restaurants': 'Dining',
    'food': 'Dining',
    'groceries': 'Groceries',
    'supermarkets': 'Groceries',
    'grocery': 'Groceries',
    'travel': 'Travel',
    'flights': 'Travel',
    'hotels': 'Travel',
    'airfare': 'Travel',
    'gas': 'Gas',
    'fuel': 'Gas',
    'streaming': 'Streaming',
    'entertainment': 'Streaming',
    'everything': 'Other',
    'all other': 'Other',
  }

  const seenCategories = new Set<string>()

  for (const pattern of rewardPatterns) {
    const matches = rawText.matchAll(pattern)
    for (const match of matches) {
      const rate = match[1]
      const type = match[2] || 'points'
      const categoryRaw = match[4]?.toLowerCase() || 'other'
      
      const category = Object.entries(categoryMap).find(([key]) => 
        categoryRaw.includes(key)
      )?.[1] || 'Other'

      if (!seenCategories.has(category)) {
        seenCategories.add(category)
        data.rewardCategories.push({
          category,
          rate: `${rate}${type.includes('cash') ? '% cash back' : 'x points'}`,
        })
      }
    }
  }

  // Extract sign-up bonus
  const bonusMatch = rawText.match(/(?:earn|get|receive)\s*(\d{1,3},?\d{3})\s*(points?|miles?|dollars?|\$)/i)
  const spendMatch = rawText.match(/spend\s*\$?([\d,]+)\s*(?:in|within)?\s*(?:the\s*)?(?:first\s*)?(\d+)\s*months?/i)
  
  if (bonusMatch) {
    data.signUpBonus = {
      value: `${bonusMatch[1]} ${bonusMatch[2]}`,
      requirement: spendMatch ? `Spend $${spendMatch[1]} in first ${spendMatch[2]} months` : 'See terms',
    }
  }

  // Extract foreign transaction fee
  if (/no\s*foreign\s*transaction\s*fee/i.test(rawText)) {
    data.foreignTransactionFee = 'None'
  } else {
    const ftfMatch = rawText.match(/foreign\s*transaction\s*fee[:\s]*(\d+(?:\.\d+)?%)/i)
    if (ftfMatch) {
      data.foreignTransactionFee = ftfMatch[1]
    }
  }

  // Extract perks
  const perks: string[] = []
  const perkPatterns = [
    /airport\s*lounge\s*access/i,
    /TSA\s*PreCheck/i,
    /Global\s*Entry/i,
    /travel\s*insurance/i,
    /purchase\s*protection/i,
    /cell\s*phone\s*protection/i,
    /rental\s*car\s*insurance/i,
    /extended\s*warranty/i,
    /concierge/i,
  ]

  for (const pattern of perkPatterns) {
    if (pattern.test(rawText)) {
      const match = rawText.match(pattern)
      if (match) perks.push(match[0])
    }
  }
  if (perks.length > 0) {
    data.perks = perks
  }

  return data
}

// Tool 1: Lookup card with caching and structured output
export const lookupCardTool = tool({
  description: 'Look up detailed information about a specific credit card. Returns structured data including rewards, fees, and perks. Results are cached for 24 hours.',
  parameters: z.object({
    cardName: z.string().describe('The name of the credit card (e.g., "Sapphire Preferred")'),
    bank: z.string().describe('The bank or issuer (e.g., "Chase", "American Express")'),
  }),
  execute: async ({ cardName, bank }) => {
    // Check cache first
    const cached = await getCachedCard(cardName, bank)
    if (cached) {
      return {
        ...cached,
        source: 'cache',
      }
    }

    // Scrape fresh data
    let rawText = await scrapeCardInfo(cardName, bank)
    
    // Fallback to Google if primary scrape fails
    if (!rawText || rawText.length < 100) {
      rawText = await scrapeFromGoogle(`${bank} ${cardName} credit card rewards annual fee`)
    }

    if (!rawText) {
      return {
        error: `Could not find information for ${bank} ${cardName}`,
        name: cardName,
        bank: bank,
      }
    }

    // Parse into structured data
    const cardData = parseCardData(rawText, cardName, bank)
    
    // Cache the result
    await setCachedCard(cardData)

    return {
      ...cardData,
      source: 'fresh',
    }
  },
})

// Tool 2: Compare reward rates across categories
export const compareRewardsTool = tool({
  description: 'Compare reward rates between multiple cards for specific spending categories. Identifies the best card for each category.',
  parameters: z.object({
    cards: z.array(CardDataSchema).describe('Array of card data to compare'),
    categories: z.array(z.string()).describe('Spending categories to compare (e.g., ["Dining", "Travel", "Groceries"])'),
  }),
  execute: async ({ cards, categories }) => {
    const comparison: Record<string, { winner: string; rate: string; cards: { name: string; rate: string }[] }> = {}

    for (const category of categories) {
      const categoryRates = cards.map(card => {
        const reward = card.rewardCategories.find(r => 
          r.category.toLowerCase() === category.toLowerCase()
        )
        const rateNum = reward ? parseFloat(reward.rate) : 1
        return {
          name: `${card.bank} ${card.name}`,
          rate: reward?.rate || '1x points',
          rateNum,
        }
      }).sort((a, b) => b.rateNum - a.rateNum)

      comparison[category] = {
        winner: categoryRates[0]?.name || 'Unknown',
        rate: categoryRates[0]?.rate || '1x',
        cards: categoryRates.map(({ name, rate }) => ({ name, rate })),
      }
    }

    return comparison
  },
})

// Tool 3: Calculate annual value estimate
export const calculateAnnualValueTool = tool({
  description: 'Calculate estimated annual rewards value based on spending patterns. Accounts for reward rates, caps, and annual fees.',
  parameters: z.object({
    card: CardDataSchema.describe('Card data to calculate value for'),
    spending: z.object({
      dining: z.number().optional().describe('Annual dining spend'),
      groceries: z.number().optional().describe('Annual grocery spend'),
      travel: z.number().optional().describe('Annual travel spend'),
      gas: z.number().optional().describe('Annual gas spend'),
      streaming: z.number().optional().describe('Annual streaming spend'),
      other: z.number().optional().describe('Annual other spend'),
    }).describe('Annual spending by category'),
    pointValue: z.number().default(0.01).describe('Value per point/mile in dollars (default 0.01 = 1 cent)'),
  }),
  execute: async ({ card, spending, pointValue }) => {
    const breakdown: AnnualValueEstimate['breakdown'] = []
    let totalRewardsValue = 0

    const spendingMap: Record<string, number> = {
      'Dining': spending.dining || 0,
      'Groceries': spending.groceries || 0,
      'Travel': spending.travel || 0,
      'Gas': spending.gas || 0,
      'Streaming': spending.streaming || 0,
      'Other': spending.other || 0,
    }

    for (const [category, spend] of Object.entries(spendingMap)) {
      if (spend === 0) continue

      const reward = card.rewardCategories.find(r => 
        r.category.toLowerCase() === category.toLowerCase()
      )
      
      const rateStr = reward?.rate || '1x points'
      const rateNum = parseFloat(rateStr) || 1
      const isCashBack = rateStr.includes('%')
      
      let earnedValue: number
      if (isCashBack) {
        earnedValue = (spend * rateNum) / 100
      } else {
        const pointsEarned = spend * rateNum
        earnedValue = pointsEarned * pointValue
      }

      totalRewardsValue += earnedValue
      breakdown.push({
        category,
        spend,
        rewardRate: rateStr,
        estimatedValue: Math.round(earnedValue * 100) / 100,
      })
    }

    const netValue = totalRewardsValue - card.annualFee

    return {
      cardName: `${card.bank} ${card.name}`,
      totalRewardsValue: Math.round(totalRewardsValue * 100) / 100,
      annualFee: card.annualFee,
      netValue: Math.round(netValue * 100) / 100,
      breakdown,
      worthIt: netValue > 0,
    }
  },
})

// Tool 4: Check sign-up bonus details
export const checkSignUpBonusTool = tool({
  description: 'Get detailed sign-up bonus information for a card, including current offer value, spending requirement, and time limit.',
  parameters: z.object({
    cardName: z.string().describe('The name of the credit card'),
    bank: z.string().describe('The bank or issuer'),
  }),
  execute: async ({ cardName, bank }) => {
    // First try to get from cache
    const cached = await getCachedCard(cardName, bank)
    
    if (cached?.signUpBonus) {
      return {
        cardName: `${bank} ${cardName}`,
        hasBonus: true,
        ...cached.signUpBonus,
        source: 'cache',
      }
    }

    // Scrape specifically for bonus info
    const rawText = await scrapeFromGoogle(`${bank} ${cardName} credit card sign up bonus offer ${new Date().getFullYear()}`)
    
    if (!rawText) {
      return {
        cardName: `${bank} ${cardName}`,
        hasBonus: false,
        message: 'Could not find current sign-up bonus information',
      }
    }

    // Parse bonus details
    const bonusMatch = rawText.match(/(?:earn|get|receive|bonus[:\s]*)\s*(\d{1,3},?\d{3})\s*(points?|miles?|dollars?|\$)/i)
    const spendMatch = rawText.match(/spend\s*\$?([\d,]+)\s*(?:in|within)?\s*(?:the\s*)?(?:first\s*)?(\d+)\s*months?/i)
    const valueMatch = rawText.match(/worth\s*(?:up\s*to\s*)?\$?([\d,]+)/i)

    if (bonusMatch) {
      return {
        cardName: `${bank} ${cardName}`,
        hasBonus: true,
        value: `${bonusMatch[1]} ${bonusMatch[2]}`,
        requirement: spendMatch ? `Spend $${spendMatch[1]} in first ${spendMatch[2]} months` : 'See terms',
        estimatedCashValue: valueMatch ? `$${valueMatch[1]}` : undefined,
        source: 'fresh',
      }
    }

    return {
      cardName: `${bank} ${cardName}`,
      hasBonus: false,
      message: 'No sign-up bonus currently available or could not parse details',
    }
  },
})

// Tool 5: Get card fees breakdown
export const getCardFeesTool = tool({
  description: 'Get comprehensive fee information for a card including annual fee, foreign transaction fee, balance transfer fee, and other charges.',
  parameters: z.object({
    cardName: z.string().describe('The name of the credit card'),
    bank: z.string().describe('The bank or issuer'),
  }),
  execute: async ({ cardName, bank }) => {
    const cached = await getCachedCard(cardName, bank)
    
    const fees: Record<string, string | number> = {
      cardName: `${bank} ${cardName}`,
      annualFee: cached?.annualFee ?? 'Unknown',
      foreignTransactionFee: cached?.foreignTransactionFee ?? 'Unknown',
    }

    // If not fully cached, scrape for more fee details
    if (!cached) {
      const rawText = await scrapeFromGoogle(`${bank} ${cardName} credit card fees APR`)
      
      if (rawText) {
        // Annual fee
        const annualMatch = rawText.match(/annual\s*fee[:\s]*\$?(\d+)/i)
        if (annualMatch) fees.annualFee = parseInt(annualMatch[1], 10)
        else if (/no\s*annual\s*fee/i.test(rawText)) fees.annualFee = 0

        // Foreign transaction fee
        if (/no\s*foreign\s*transaction\s*fee/i.test(rawText)) {
          fees.foreignTransactionFee = 'None'
        } else {
          const ftfMatch = rawText.match(/foreign\s*transaction\s*fee[:\s]*(\d+(?:\.\d+)?%)/i)
          if (ftfMatch) fees.foreignTransactionFee = ftfMatch[1]
        }

        // Balance transfer fee
        const btMatch = rawText.match(/balance\s*transfer\s*fee[:\s]*(\d+(?:\.\d+)?%)/i)
        if (btMatch) fees.balanceTransferFee = btMatch[1]

        // Cash advance fee
        const caMatch = rawText.match(/cash\s*advance\s*fee[:\s]*(\d+(?:\.\d+)?%)/i)
        if (caMatch) fees.cashAdvanceFee = caMatch[1]

        // Late payment fee
        const lateMatch = rawText.match(/late\s*(?:payment\s*)?fee[:\s]*(?:up\s*to\s*)?\$?(\d+)/i)
        if (lateMatch) fees.latePaymentFee = `$${lateMatch[1]}`

        // APR
        const aprMatch = rawText.match(/(?:purchase\s*)?APR[:\s]*(\d+(?:\.\d+)?%?\s*[-–]\s*\d+(?:\.\d+)?%?)/i)
        if (aprMatch) fees.purchaseAPR = aprMatch[1]
      }
    }

    return fees
  },
})

// Tool 6: Handoff to next agent
export const handoffTool = tool({
  description: 'Hand off the conversation to a different specialized agent. Use this when the current task is complete and a different agent should continue.',
  parameters: z.object({
    targetAgent: z.enum(['research', 'analysis', 'recommendation']).describe('The agent to hand off to'),
    reason: z.string().describe('Why the handoff is happening'),
    context: z.record(z.unknown()).describe('Any context to pass to the next agent'),
  }),
  execute: async ({ targetAgent, reason, context }) => {
    return {
      handoff: true,
      targetAgent,
      reason,
      context,
      timestamp: new Date().toISOString(),
    }
  },
})

// Export all tools
export const agentTools = {
  lookupCard: lookupCardTool,
  compareRewards: compareRewardsTool,
  calculateAnnualValue: calculateAnnualValueTool,
  checkSignUpBonus: checkSignUpBonusTool,
  getCardFees: getCardFeesTool,
  handoff: handoffTool,
}
