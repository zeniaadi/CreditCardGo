/**
 * CreditCardGo Agent Tools - AI SDK 6
 * Tools use inputSchema with simple Zod types for OpenAI strict mode
 */
import { tool } from 'ai'
import { z } from 'zod'
import { getCachedCard, setCachedCard } from './cache'
import { scrapeCardDetails } from './scrape-card'
import type { CardData, AnnualValueEstimate } from './types'

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
const lookupCard = tool({
  description: 'Look up detailed information about a specific credit card including rewards, fees, and perks. Results are cached for 24 hours.',
  inputSchema: z.object({
    cardName: z.string().describe('The name of the credit card'),
    bank: z.string().describe('The bank or issuer'),
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
    const rawText = await scrapeCardDetails(cardName, bank)

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

// Tool 2: Compare reward rates (accepts JSON string of card data)
const compareRewards = tool({
  description: 'Compare reward rates between cards for specific spending categories. Pass previously looked up card data as JSON.',
  inputSchema: z.object({
    cardDataJson: z.string().describe('JSON string array of card data from lookupCard results'),
    categories: z.string().describe('Comma-separated spending categories to compare (e.g., "Dining,Travel,Groceries")'),
  }),
  execute: async ({ cardDataJson, categories }) => {
    let cards: CardData[]
    try {
      cards = JSON.parse(cardDataJson)
    } catch {
      return { error: 'Invalid card data JSON' }
    }

    const categoryList = categories.split(',').map(c => c.trim())
    const comparison: Record<string, { winner: string; rate: string; allCards: { name: string; rate: string }[] }> = {}

    for (const category of categoryList) {
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
        allCards: categoryRates.map(({ name, rate }) => ({ name, rate })),
      }
    }

    return comparison
  },
})

// Tool 3: Calculate annual value estimate
const calculateAnnualValue = tool({
  description: 'Calculate estimated annual rewards value based on spending. Pass card data as JSON and spending amounts.',
  inputSchema: z.object({
    cardDataJson: z.string().describe('JSON string of card data from lookupCard result'),
    diningSpend: z.number().describe('Annual dining spend in dollars'),
    groceriesSpend: z.number().describe('Annual groceries spend in dollars'),
    travelSpend: z.number().describe('Annual travel spend in dollars'),
    gasSpend: z.number().describe('Annual gas spend in dollars'),
    otherSpend: z.number().describe('Annual other spend in dollars'),
    pointValue: z.number().describe('Value per point in cents (e.g., 1.5 for 1.5 cents)'),
  }),
  execute: async ({ cardDataJson, diningSpend, groceriesSpend, travelSpend, gasSpend, otherSpend, pointValue }) => {
    let card: CardData
    try {
      card = JSON.parse(cardDataJson)
    } catch {
      return { error: 'Invalid card data JSON' }
    }

    const pointValueDollars = pointValue / 100
    const breakdown: AnnualValueEstimate['breakdown'] = []
    let totalRewardsValue = 0

    const spendingMap: Record<string, number> = {
      'Dining': diningSpend,
      'Groceries': groceriesSpend,
      'Travel': travelSpend,
      'Gas': gasSpend,
      'Other': otherSpend,
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
        earnedValue = pointsEarned * pointValueDollars
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
const checkSignUpBonus = tool({
  description: 'Get sign-up bonus information for a card including offer value, spending requirement, and time limit.',
  inputSchema: z.object({
    cardName: z.string().describe('The name of the credit card'),
    bank: z.string().describe('The bank or issuer'),
  }),
  execute: async ({ cardName, bank }) => {
    const cached = await getCachedCard(cardName, bank)
    
    if (cached?.signUpBonus) {
      return {
        cardName: `${bank} ${cardName}`,
        hasBonus: true,
        ...cached.signUpBonus,
        source: 'cache',
      }
    }

    const rawText = await scrapeCardDetails(cardName, bank)
    
    if (!rawText) {
      return {
        cardName: `${bank} ${cardName}`,
        hasBonus: false,
        message: 'Could not find current sign-up bonus information',
      }
    }

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
      message: 'No sign-up bonus currently available',
    }
  },
})

// Tool 5: Get card fees breakdown
const getCardFees = tool({
  description: 'Get fee information for a card including annual fee, foreign transaction fee, and other charges.',
  inputSchema: z.object({
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

    if (!cached) {
      const rawText = await scrapeCardDetails(cardName, bank)
      
      if (rawText) {
        const annualMatch = rawText.match(/annual\s*fee[:\s]*\$?(\d+)/i)
        if (annualMatch) fees.annualFee = parseInt(annualMatch[1], 10)
        else if (/no\s*annual\s*fee/i.test(rawText)) fees.annualFee = 0

        if (/no\s*foreign\s*transaction\s*fee/i.test(rawText)) {
          fees.foreignTransactionFee = 'None'
        } else {
          const ftfMatch = rawText.match(/foreign\s*transaction\s*fee[:\s]*(\d+(?:\.\d+)?%)/i)
          if (ftfMatch) fees.foreignTransactionFee = ftfMatch[1]
        }

        const btMatch = rawText.match(/balance\s*transfer\s*fee[:\s]*(\d+(?:\.\d+)?%)/i)
        if (btMatch) fees.balanceTransferFee = btMatch[1]

        const aprMatch = rawText.match(/(?:purchase\s*)?APR[:\s]*(\d+(?:\.\d+)?%?\s*[-–]\s*\d+(?:\.\d+)?%?)/i)
        if (aprMatch) fees.purchaseAPR = aprMatch[1]
      }
    }

    return fees
  },
})

// Export all tools
export const agentTools = {
  lookupCard,
  compareRewards,
  calculateAnnualValue,
  checkSignUpBonus,
  getCardFees,
}
