import type { NextRequest } from 'next/server'
import {
  createResponse,
  createErrorResponse,
  verifyAuth,
  checkRateLimit,
  sanitizeString,
} from '@/app/(main)/api/_lib/api-utils'
import { GoogleGenerativeAI } from '@google/generative-ai'

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

    // Gemini API Call
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      const { response } = createErrorResponse(500, 'Configuration Error', 'Gemini API key not configured')
      return response
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest' })

    // Build chat history for Gemini
    const history = conversationHistory.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }))

    const chat = model.startChat({
      history: history,
      generationConfig: {
        maxOutputTokens: 500,
      },
    })

    const result = await chat.sendMessage(userMessage)
    const aiResponse = result.response.text()

    console.log('[Gemini Chat] message processed for user:', userId)

    const { response } = createResponse(200, {
      message: aiResponse,
      tokens: 0, // Token count not directly available from simple response
    })

    return response
  } catch (error: any) {
    console.error('[Gemini Chat] Error:', error)

    if (error instanceof SyntaxError) {
      const { response } = createErrorResponse(400, 'Invalid JSON', 'Request body must be valid JSON')
      return response
    }

    const { response } = createErrorResponse(500, 'Internal Server Error', 'Failed to process chat message')
    return response
  }
}
