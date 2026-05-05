import type { NextRequest } from 'next/server'

export class APIResponse<T = unknown> {
  constructor(
    public status: number,
    public data?: T,
    public message?: string,
    public error?: string
  ) {}

  toJSON() {
    return {
      status: this.status,
      ...(this.data !== undefined && { data: this.data }),
      ...(this.message && { message: this.message }),
      ...(this.error && { error: this.error }),
    }
  }
}

export function createResponse<T>(
  status: number,
  data?: T,
  message?: string
): { response: Response; status: number } {
  const apiResponse = new APIResponse(status, data, message)
  return {
    response: new Response(JSON.stringify(apiResponse.toJSON()), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
    status,
  }
}

export function createErrorResponse(
  status: number,
  error: string,
  message?: string
): { response: Response; status: number } {
  const apiResponse = new APIResponse(status, undefined, message, error)
  return {
    response: new Response(JSON.stringify(apiResponse.toJSON()), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
    status,
  }
}

// Mock authentication check (replace with real JWT/session validation)
export function verifyAuth(request: NextRequest): { valid: boolean; userId?: string } {
  const authHeader = request.headers.get('authorization')

  // In production, validate JWT token here
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // For development, allow requests without auth
    // In production, return { valid: false }
    return { valid: true, userId: 'demo-user' }
  }

  try {
    const token = authHeader.substring(7)
    // Validate token (mock)
    if (token.length > 0) {
      return { valid: true, userId: 'authenticated-user' }
    }
  } catch (error) {
    console.error('[v0] Auth verification error:', error)
  }

  return { valid: false }
}

// Simple rate limiter using memory (replace with Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs }
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}

// Sanitize string inputs
export function sanitizeString(input: string | unknown): string {
  if (typeof input !== 'string') {
    throw new Error('Invalid string input')
  }

  return input.trim().substring(0, 1000) // Max 1000 chars, trim whitespace
}

// Sanitize number inputs
export function sanitizeNumber(input: unknown, min = -Infinity, max = Infinity): number {
  if (typeof input !== 'number') {
    throw new Error('Invalid number input')
  }

  if (!Number.isFinite(input)) {
    throw new Error('Invalid number value')
  }

  if (input < min || input > max) {
    throw new Error(`Number must be between ${min} and ${max}`)
  }

  return input
}
