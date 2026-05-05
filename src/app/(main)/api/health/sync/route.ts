import type { NextRequest } from 'next/server'
import { createResponse, createErrorResponse, verifyAuth, checkRateLimit } from '@/app/(main)/api/_lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = verifyAuth(request)
    if (!auth.valid) {
      const { response, status } = createErrorResponse(401, 'Unauthorized', 'Authentication required')
      return response
    }

    // Check rate limit: 1 per minute per user
    const userId = auth.userId || 'anonymous'
    const rateLimitKey = `health-sync-${userId}`
    const rateLimit = checkRateLimit(rateLimitKey, 1, 60000) // 1 request per 60 seconds

    if (!rateLimit.allowed) {
      const { response, status } = createErrorResponse(
        429,
        'Too Many Requests',
        `Rate limit exceeded. Try again in ${Math.ceil((rateLimit.resetAt - Date.now()) / 1000)}s`
      )
      return response
    }

    console.log('[API] Health sync triggered for user:', userId)

    // In a real scenario, this endpoint might trigger a backend job or return server-persisted data.
    // For now, it acknowledges the sync request. The frontend should rely on the Native Health Provider
    // for real-time data from Capacitor.
    const { response } = createResponse(200, {
      synced: true,
      message: 'Sync acknowledged. Relying on local Capacitor bridge for real-time data.',
    })

    return response
  } catch (error) {
    console.error('[API] Health sync error:', error)
    const { response } = createErrorResponse(500, 'Internal Server Error', 'Failed to process sync request')
    return response
  }
}
