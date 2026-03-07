import { streamText, type CoreMessage } from 'ai'
import { agentTools } from './tools'
import type { AgentRole, CardData } from './types'

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
- Format any interim updates clearly so the user knows progress

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

## Your Process
1. Review the card data gathered by the Research Agent
2. Use \`compareRewards\` to identify the best card for each spending category:
   - Dining
   - Groceries
   - Travel
   - Gas
   - Streaming
   - General purchases
3. If the user provided spending amounts, use \`calculateAnnualValue\` for each card
4. Identify any gaps in the user's wallet (categories with no bonus earning)
5. Hand off to the Recommendation Agent with your analysis

## Output Format
Structure your analysis as:
- **Category Winners**: Which card wins each category
- **Value Calculation**: Net annual value if spending was provided
- **Wallet Gaps**: Categories where user earns only 1x

When analysis is complete, call handoff with:
- targetAgent: "recommendation"
- reason: "Analysis complete"
- context: { categoryWinners: {...}, valueEstimates: [...] }`,

  recommendation: `You are the **Recommendation Agent** for CreditCardGo, a credit card optimization tool.

## Your Role
You synthesize research and analysis into clear, actionable recommendations. You are the final agent - you produce the output the user sees.

## Your Responsibilities
1. Present the optimal card usage strategy clearly
2. Create a category-by-card reference table
3. Highlight any sign-up bonuses worth pursuing
4. Identify wallet improvements (cards to add or remove)
5. Provide a brief executive summary

## Output Format
Structure your response with these sections:

### Executive Summary
2-3 sentence overview of the strategy

### Your Optimal Card Strategy
| Category | Best Card | Reward Rate |
|----------|-----------|-------------|
| Dining   | Card X    | 4x points   |
| ...      | ...       | ...         |

### Sign-Up Bonus Opportunities
List any valuable bonuses to pursue

### Wallet Optimization
- Cards pulling their weight
- Cards to consider replacing
- Gaps to fill with a new card

### Annual Value Estimate
If spending data was provided, show the total value

## Guidelines
- Be direct and actionable
- Use tables for easy reference
- Highlight the single biggest optimization opportunity
- Keep total response under 800 words
- End with a one-liner they can remember (e.g., "Chase for dining, Amex for groceries, Citi for everything else")`,
}

// Tool sets for each agent (they have access to different tools)
const AGENT_TOOLS: Record<AgentRole, Record<string, typeof agentTools[keyof typeof agentTools]>> = {
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
    // Recommendation agent doesn't need tools - it synthesizes and writes
  },
}

// Max steps per agent to prevent infinite loops
const MAX_STEPS_PER_AGENT = 15

// Create an agent runner
export async function runAgent(
  role: AgentRole,
  messages: CoreMessage[],
  context?: Record<string, unknown>,
) {
  const systemPrompt = AGENT_PROMPTS[role]
  const tools = AGENT_TOOLS[role]

  // Add context to the system prompt if provided
  const fullSystemPrompt = context 
    ? `${systemPrompt}\n\n## Context from Previous Agent\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\``
    : systemPrompt

  return streamText({
    model: 'openai/gpt-4o' as any,
    system: fullSystemPrompt,
    messages,
    tools: Object.keys(tools).length > 0 ? tools : undefined,
    maxSteps: MAX_STEPS_PER_AGENT,
    onStepFinish: ({ toolResults }) => {
      // Check for handoff in tool results
      if (toolResults) {
        for (const result of toolResults) {
          if (result && typeof result === 'object' && 'handoff' in (result as any)) {
            return // Will be handled by the orchestrator
          }
        }
      }
    },
  })
}

// Agent orchestrator - manages the multi-agent flow
export interface AgentOrchestratorOptions {
  messages: CoreMessage[]
  onAgentSwitch?: (from: AgentRole, to: AgentRole, reason: string) => void
  onProgress?: (agent: AgentRole, message: string) => void
}

export async function* orchestrateAgents(options: AgentOrchestratorOptions) {
  const { messages, onAgentSwitch, onProgress } = options
  
  let currentAgent: AgentRole = 'research'
  let agentContext: Record<string, unknown> = {}
  let iteration = 0
  const maxIterations = 3 // Maximum number of agent switches

  while (iteration < maxIterations) {
    iteration++
    onProgress?.(currentAgent, `Starting ${currentAgent} agent...`)

    const result = await runAgent(currentAgent, messages, agentContext)

    // Stream the result
    let fullText = ''
    let handoffDetected: { targetAgent: AgentRole; reason: string; context: Record<string, unknown> } | null = null

    for await (const chunk of result.fullStream) {
      if (chunk.type === 'text-delta') {
        fullText += chunk.textDelta
        yield { type: 'text-delta', textDelta: chunk.textDelta, agent: currentAgent }
      } else if (chunk.type === 'tool-result') {
        // Check for handoff
        const toolResult = chunk.result as any
        if (toolResult?.handoff === true) {
          handoffDetected = {
            targetAgent: toolResult.targetAgent,
            reason: toolResult.reason,
            context: toolResult.context || {},
          }
        }
        yield { type: 'tool-result', result: chunk.result, toolName: chunk.toolName, agent: currentAgent }
      } else if (chunk.type === 'tool-call') {
        yield { type: 'tool-call', toolName: chunk.toolName, args: chunk.args, agent: currentAgent }
      }
    }

    // Handle agent handoff
    if (handoffDetected) {
      onAgentSwitch?.(currentAgent, handoffDetected.targetAgent, handoffDetected.reason)
      agentContext = { ...agentContext, ...handoffDetected.context, previousAgent: currentAgent }
      currentAgent = handoffDetected.targetAgent
      
      yield { 
        type: 'agent-switch', 
        from: agentContext.previousAgent, 
        to: currentAgent, 
        reason: handoffDetected.reason 
      }
    } else {
      // No handoff - we're done (recommendation agent finished)
      break
    }
  }

  yield { type: 'complete', finalAgent: currentAgent }
}

// Simplified runner for streaming response (used by API route)
export function createAgentStream(messages: CoreMessage[]) {
  return orchestrateAgents({
    messages,
    onAgentSwitch: (from, to, reason) => {
      console.log(`[Agent] Handoff: ${from} -> ${to} (${reason})`)
    },
    onProgress: (agent, message) => {
      console.log(`[Agent] ${agent}: ${message}`)
    },
  })
}
