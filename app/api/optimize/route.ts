import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  type UIMessage,
  type CoreMessage,
} from "ai"
import { agentTools } from "@/lib/tools"
import type { AgentRole } from "@/lib/types"

export const maxDuration = 60

// Agent-specific system prompts
const AGENT_PROMPTS: Record<AgentRole, string> = {
  research: `You are the **Research Agent** for CreditCardGo, a credit card optimization tool.

## Your Role
You gather accurate, up-to-date information about credit cards. You are methodical and thorough.

## Your Tools
- \`lookupCard\`: Look up detailed card information (rewards, fees, perks). Results are cached for 24 hours.
- \`checkSignUpBonus\`: Get current sign-up bonus offers.
- \`getCardFees\`: Get comprehensive fee breakdown.
- \`handoff\`: Pass control to the Analysis Agent when research is complete.

## Your Process
1. For each card the user mentions, use \`lookupCard\` to get structured data
2. If the user asks about bonuses specifically, also use \`checkSignUpBonus\`
3. If fees are a concern, use \`getCardFees\` for detailed breakdown
4. Once you have gathered all card data, use \`handoff\` to pass to the Analysis Agent

## Guidelines
- Always gather data for ALL cards mentioned before handing off
- Report any cards you couldn't find information for
- Be efficient - don't look up the same card twice
- Show the user brief progress updates as you research each card

When you have finished researching all cards, call the handoff tool with:
- targetAgent: "analysis"
- reason: "Research complete for all cards"
- context: { cardCount: N, cards: [...card names...] }`,

  analysis: `You are the **Analysis Agent** for CreditCardGo, a credit card optimization tool.

## Your Role
You analyze and compare credit cards to find the optimal card for each spending category.

## Your Tools
- \`compareRewards\`: Compare reward rates across multiple cards for specific categories
- \`calculateAnnualValue\`: Estimate annual value based on spending patterns
- \`handoff\`: Pass control to the Recommendation Agent when analysis is complete

## Context
You have access to card data gathered by the Research Agent in the context provided.

## Your Process
1. Review the card data gathered by the Research Agent
2. Use \`compareRewards\` to identify the best card for each spending category:
   - Dining, Groceries, Travel, Gas, Streaming, General purchases
3. If the user provided spending amounts, use \`calculateAnnualValue\` for each card
4. Identify any gaps in the user's wallet (categories with no bonus earning)
5. Hand off to the Recommendation Agent with your analysis

When analysis is complete, call handoff with:
- targetAgent: "recommendation"
- reason: "Analysis complete"
- context: { categoryWinners: {...}, gaps: [...] }`,

  recommendation: `You are the **Recommendation Agent** for CreditCardGo, a credit card optimization tool.

## Your Role
You synthesize research and analysis into clear, actionable recommendations.

## Context
You have access to card data and analysis from previous agents.

## Output Format
Structure your response with these sections:

### Executive Summary
2-3 sentence overview of the strategy

### Your Optimal Card Strategy
| Category | Best Card | Reward Rate |
|----------|-----------|-------------|
| Dining   | Card X    | 4x points   |
| Groceries | Card Y   | 6% cash back |
| Travel   | Card Z    | 3x points   |
| Gas      | Card A    | 3% cash back |
| Streaming | Card B   | 3% cash back |
| Everything Else | Card C | 2% cash back |

### Sign-Up Bonus Opportunities
List any valuable bonuses worth pursuing from cards they already own

### Wallet Optimization
- **Cards pulling their weight**: List the MVPs
- **Consider replacing**: Cards that are underperforming
- **Gaps to fill**: Categories where a new card could help (optional)

### Quick Reference
End with a memorable one-liner like:
"Chase for dining, Amex for groceries, Citi for everything else"

## Guidelines
- Be direct and actionable
- Use tables for easy reference
- Keep total response under 600 words
- Don't overwhelm with options - give clear recommendations`,
}

// Tool sets for each agent
const AGENT_TOOL_SETS: Record<AgentRole, Record<string, typeof agentTools[keyof typeof agentTools]>> = {
  research: {
    lookupCard: agentTools.lookupCard,
    checkSignUpBonus: agentTools.checkSignUpBonus,
    getCardFees: agentTools.getCardFees,
    handoff: agentTools.handoff,
  },
  analysis: {
    compareRewards: agentTools.compareRewards,
    calculateAnnualValue: agentTools.calculateAnnualValue,
    handoff: agentTools.handoff,
  },
  recommendation: {
    // No tools - just synthesizes and writes
  },
}

// Run a single agent
async function runAgent(
  role: AgentRole,
  messages: CoreMessage[],
  context?: Record<string, unknown>,
  signal?: AbortSignal
) {
  const systemPrompt = AGENT_PROMPTS[role]
  const tools = AGENT_TOOL_SETS[role]

  const fullSystemPrompt = context
    ? `${systemPrompt}\n\n## Context from Previous Agent\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\``
    : systemPrompt

  return streamText({
    model: "openai/gpt-4o" as any,
    system: fullSystemPrompt,
    messages,
    tools: Object.keys(tools).length > 0 ? tools : undefined,
    maxSteps: 15,
    stopWhen: stepCountIs(15),
    abortSignal: signal,
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { messages }: { messages: UIMessage[] } = body

    if (!messages || messages.length === 0) {
      return new Response("No messages provided", { status: 400 })
    }

    const converted = await convertToModelMessages(messages)

    // Create a TransformStream for the multi-agent response
    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()

    // Run the multi-agent orchestration
    ;(async () => {
      try {
        let currentAgent: AgentRole = 'research'
        let agentContext: Record<string, unknown> = {}
        let iteration = 0
        const maxIterations = 3

        while (iteration < maxIterations) {
          iteration++

          // Send agent switch indicator
          await writer.write(encoder.encode(`0:"\\n\\n---\\n**[${currentAgent.toUpperCase()} AGENT]**\\n\\n"\n`))

          const result = await runAgent(currentAgent, converted, agentContext, req.signal)

          let handoffDetected: { targetAgent: AgentRole; reason: string; context: Record<string, unknown> } | null = null
          let collectedCardData: Record<string, unknown>[] = []

          // Stream the result
          for await (const chunk of result.fullStream) {
            if (chunk.type === 'text-delta') {
              // Escape the text for SSE format
              const escaped = JSON.stringify(chunk.textDelta)
              await writer.write(encoder.encode(`0:${escaped}\n`))
            } else if (chunk.type === 'tool-result') {
              const toolResult = chunk.result as any
              
              // Collect card data for context
              if (chunk.toolName === 'lookupCard' && toolResult && !toolResult.error) {
                collectedCardData.push(toolResult)
              }
              
              // Check for handoff
              if (toolResult?.handoff === true) {
                handoffDetected = {
                  targetAgent: toolResult.targetAgent,
                  reason: toolResult.reason,
                  context: toolResult.context || {},
                }
              }
              
              // Send tool result indicator
              const toolMsg = `\n> Completed: ${chunk.toolName}\n`
              await writer.write(encoder.encode(`0:${JSON.stringify(toolMsg)}\n`))
            } else if (chunk.type === 'tool-call') {
              // Send tool call indicator
              const toolMsg = `\n> Calling: ${chunk.toolName}...\n`
              await writer.write(encoder.encode(`0:${JSON.stringify(toolMsg)}\n`))
            }
          }

          // Handle agent handoff
          if (handoffDetected) {
            agentContext = {
              ...agentContext,
              ...handoffDetected.context,
              previousAgent: currentAgent,
              cardData: collectedCardData,
            }
            currentAgent = handoffDetected.targetAgent
          } else {
            // No handoff - we're done
            break
          }
        }

        await writer.write(encoder.encode(`0:"\\n\\n---\\n**Analysis Complete**\\n"\n`))
        await writer.close()
      } catch (error) {
        console.error("[v0] Agent orchestration error:", error)
        const errorMsg = JSON.stringify(`\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}\n`)
        await writer.write(encoder.encode(`0:${errorMsg}\n`))
        await writer.close()
      }
    })()

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error("[v0] API route error:", error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
