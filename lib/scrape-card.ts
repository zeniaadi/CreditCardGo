const SEARCH_URL = "https://www.google.com/search"

/**
 * Scrapes the web for credit card details.
 * Searches Google for the card's rewards info and extracts text from the top results.
 */
export async function scrapeCardDetails(
  cardName: string,
  bank: string
): Promise<string> {
  const query = `${cardName} ${bank} credit card rewards rate annual fee benefits 2025 2026`

  try {
    // Attempt to fetch card info from NerdWallet (reliable structured data)
    const nerdwalletSlug = `${cardName} ${bank}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")

    const sources = [
      `https://www.nerdwallet.com/article/credit-cards/${nerdwalletSlug}`,
      `https://www.nerdwallet.com/reviews/credit-cards/${nerdwalletSlug}`,
    ]

    for (const url of sources) {
      try {
        const resp = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; CardPilot/1.0; +https://cardpilot.app)",
            Accept: "text/html",
          },
          signal: AbortSignal.timeout(5000),
        })

        if (resp.ok) {
          const html = await resp.text()
          const text = extractTextFromHtml(html)
          if (text.length > 200) {
            return truncate(
              `Source: ${url}\n\n${text}`,
              4000
            )
          }
        }
      } catch {
        // try next source
      }
    }

    // Fallback: fetch Google search results and extract snippets
    const searchResp = await fetch(
      `${SEARCH_URL}?q=${encodeURIComponent(query)}&num=5`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; CardPilot/1.0; +https://cardpilot.app)",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(8000),
      }
    )

    if (!searchResp.ok) {
      return buildFallbackInfo(cardName, bank)
    }

    const html = await searchResp.text()
    const snippets = extractSearchSnippets(html)

    if (snippets.length > 0) {
      return truncate(
        `Search results for "${cardName} - ${bank}":\n\n${snippets.join("\n\n")}`,
        4000
      )
    }

    return buildFallbackInfo(cardName, bank)
  } catch (error) {
    console.error(`[scrape] Error scraping ${cardName} - ${bank}:`, error)
    return buildFallbackInfo(cardName, bank)
  }
}

function extractTextFromHtml(html: string): string {
  // Remove script and style tags
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")

  // Replace tags with spaces
  text = text.replace(/<[^>]+>/g, " ")

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")

  // Collapse whitespace
  text = text.replace(/\s+/g, " ").trim()

  return text
}

function extractSearchSnippets(html: string): string[] {
  const snippets: string[] = []

  // Extract text blocks that look like search result snippets
  // Google wraps snippets in various div structures
  const blocks = html.split(/<div[^>]*class="[^"]*"[^>]*>/i)
  for (const block of blocks) {
    const text = block
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim()

    // Keep blocks that look like informative snippets about credit cards
    if (
      text.length > 80 &&
      text.length < 600 &&
      /(%|annual fee|\$|reward|cashback|cash back|point|benefit|earn|bonus)/i.test(text)
    ) {
      snippets.push(text)
    }

    if (snippets.length >= 8) break
  }

  return snippets
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + "..."
}

function buildFallbackInfo(cardName: string, bank: string): string {
  return `Could not retrieve live data for "${cardName} - ${bank}". Please use your training knowledge for this card's typical rewards rates, annual fee, benefits, and bonus categories. Mark any inferred details with [estimated].`
}
