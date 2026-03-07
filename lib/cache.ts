import { Redis } from '@upstash/redis'
import type { CardData } from './types'

// Initialize Redis client (with fallback for missing credentials)
const redis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
  ? new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    })
  : null

// Cache TTL: 24 hours
const CACHE_TTL = 60 * 60 * 24

// Generate cache key for a card
function getCardCacheKey(cardName: string, bank: string): string {
  const normalized = `${bank}:${cardName}`.toLowerCase().replace(/\s+/g, '-')
  return `card:${normalized}`
}

// Get cached card data
export async function getCachedCard(cardName: string, bank: string): Promise<CardData | null> {
  if (!redis) return null
  try {
    const key = getCardCacheKey(cardName, bank)
    const cached = await redis.get<CardData>(key)
    return cached
  } catch (error) {
    console.error('[Cache] Error reading from cache:', error)
    return null
  }
}

// Set cached card data
export async function setCachedCard(cardData: CardData): Promise<void> {
  if (!redis) return
  try {
    const key = getCardCacheKey(cardData.name, cardData.bank)
    await redis.set(key, cardData, { ex: CACHE_TTL })
  } catch (error) {
    console.error('[Cache] Error writing to cache:', error)
  }
}

// Get multiple cached cards
export async function getCachedCards(cards: { name: string; bank: string }[]): Promise<Map<string, CardData>> {
  const result = new Map<string, CardData>()
  if (!redis) return result
  
  try {
    const pipeline = redis.pipeline()
    const keys: string[] = []
    
    for (const card of cards) {
      const key = getCardCacheKey(card.name, card.bank)
      keys.push(key)
      pipeline.get(key)
    }
    
    const responses = await pipeline.exec<(CardData | null)[]>()
    
    responses.forEach((data, index) => {
      if (data) {
        result.set(keys[index], data)
      }
    })
  } catch (error) {
    console.error('[Cache] Error reading multiple cards:', error)
  }
  
  return result
}

// Invalidate cached card
export async function invalidateCachedCard(cardName: string, bank: string): Promise<void> {
  if (!redis) return
  try {
    const key = getCardCacheKey(cardName, bank)
    await redis.del(key)
  } catch (error) {
    console.error('[Cache] Error invalidating cache:', error)
  }
}

// Cache research results for a session
export async function cacheResearchSession(
  sessionId: string, 
  data: Record<string, CardData>
): Promise<void> {
  if (!redis) return
  try {
    await redis.set(`session:${sessionId}`, data, { ex: 60 * 30 }) // 30 min TTL
  } catch (error) {
    console.error('[Cache] Error caching session:', error)
  }
}

// Get cached research session
export async function getCachedSession(
  sessionId: string
): Promise<Record<string, CardData> | null> {
  if (!redis) return null
  try {
    return await redis.get<Record<string, CardData>>(`session:${sessionId}`)
  } catch (error) {
    console.error('[Cache] Error reading session:', error)
    return null
  }
}
