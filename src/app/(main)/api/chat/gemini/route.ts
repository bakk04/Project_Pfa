import type { NextRequest } from 'next/server'
import {
  createResponse,
  createErrorResponse,
  verifyAuth,
  checkRateLimit,
  sanitizeString,
} from '@/app/(main)/api/_lib/api-utils'
import type { ChatMessage } from '@/store/ai-store'

// Mock chat response generator (replace with actual Gemini API call)
function generateMockChatResponse(userMessage: string): string {
  const responses: Record<string, string> = {
    hello: "Hi! I'm here to help with your health questions. What would you like to know?",
    vitals:
      'Your recent vitals look good. Keep monitoring them regularly for the best health outcomes.',
    glucose: 'Blood glucose levels are important for diabetes prevention. Aim to maintain fasting glucose below 100 mg/dL.',
    exercise:
      'Regular exercise (150 min/week) is recommended. It helps improve heart health and blood sugar control.',
    diet: 'A balanced diet with whole grains, lean proteins, and vegetables is essential for good health.',
  }

  const lowerMessage = userMessage.toLowerCase()

  for (const [keyword, response] of Object.entries(responses)) {
    if (lowerMessage.includes(keyword)) {
      return response
    }
  }

  return "Thanks for your question! Based on your health data, I recommend consulting with your healthcare provider for personalized advice."
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const auth = verifyAuth(request)
    if (!auth.valid) {
      const { response } = createErrorResponse(401, 'Unauthorized', 'Authentication required')
      return response
    }

    // Check rate limit: 20 requests per hour per user
    const userId = auth.userId || 'anonymous'
    const rateLimitKey = `chat-${userId}`
    const rateLimit = checkRateLimit(rateLimitKey, 20, 3600000) // 20 per hour

    if (!rateLimit.allowed) {
      const { response } = createErrorResponse(
        429,
        'Too Many Requests',
        'You have reached the chat message limit. Try again later.'
      )
      return response
    }

    // Parse request body
    const body = await request.json()

    // Validate and sanitize message
    if (!body.message || typeof body.message !== 'string') {
      const { response } = createErrorResponse(400, 'Invalid Input', 'Message is required')
      return response
    }

    const userMessage = sanitizeString(body.message)

    if (!userMessage) {
      const { response } = createErrorResponse(400, 'Invalid Input', 'Message cannot be empty')
      return response
    }

    // Get conversation history (optional context for AI)
    const conversationHistory = Array.isArray(body.conversationHistory) ? body.conversationHistory : []

    // Generate response (replace with actual Gemini API call)
    const aiResponse = generateMockChatResponse(userMessage)

    console.log('[v0] Chat message processed for user:', userId)

    const { response } = createResponse(200, {
      message: aiResponse,
      tokens: 150, // Mock token count
    })

    return response
  } catch (error) {
    console.error('[v0] Chat error:', error)

    if (error instanceof SyntaxError) {
      const { response } = createErrorResponse(400, 'Invalid JSON', 'Request body must be valid JSON')
      return response
    }

    const { response } = createErrorResponse(500, 'Internal Server Error', 'Failed to process chat message')
    return response
  }
}
