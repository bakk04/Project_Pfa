import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import {
  createResponse,
  createErrorResponse,
  verifyAuth,
  checkRateLimit,
} from '@/app/(main)/api/_lib/api-utils'
import { ClinicalFormSchema } from '@/utils/validation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { sendPredictionEmail } from '@/lib/mail'

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const auth = verifyAuth(request)
    if (!auth.valid) {
      const { response } = createErrorResponse(401, 'Unauthorized', 'Authentication required')
      return response
    }

    // Check rate limit: 5 requests per hour per user
    const userId = auth.userId || 'anonymous'
    const rateLimitKey = `prediction-${userId}`
    const rateLimit = checkRateLimit(rateLimitKey, 5, 3600000)

    if (!rateLimit.allowed) {
      const { response } = createErrorResponse(
        429,
        'Too Many Requests',
        'You have reached the prediction limit. Try again later.'
      )
      return response
    }

    const body = await request.json()

    const validationResult = ClinicalFormSchema.safeParse(body)
    if (!validationResult.success) {
      const { response } = createErrorResponse(
        400,
        'Validation Error',
        validationResult.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
      )
      return response
    }

    const validatedData = validationResult.data

    const fastApiUrl = process.env.FASTAPI_URL || 'http://localhost:8000';
    
    // Enforce REAL AI Model Inference
    const fastApiResponse = await fetch(`${fastApiUrl}/predict/diabetes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validatedData),
      // Set a strict timeout to ensure we don't hang if model is offline
      signal: AbortSignal.timeout(8000) 
    });

    if (!fastApiResponse.ok) {
      console.error(`[API Prediction] FastAPI returned ${fastApiResponse.status}`);
      return NextResponse.json(
        { error: 'Model Unavailable', message: 'FastAPI model is offline or unreachable. No analysis performed.' },
        { status: 503 }
      );
    }

    const prediction = await fastApiResponse.json();

    console.log('[v0] Real AI diabetes prediction generated for user:', userId);

    try {
      const session = await getServerSession(authOptions);
      if (session?.user?.email && prediction.probability !== undefined) {
        await sendPredictionEmail(
          session.user.email, 
          session.user.name?.split(' ')[0] || 'User', 
          prediction
        );
      }
    } catch (mailError) {
      console.error('Failed to send prediction email:', mailError);
    }

    const { response } = createResponse(200, prediction)
    return response
  } catch (error: unknown) {
    console.error('[v0] Prediction error:', error)

    if (error instanceof SyntaxError) {
      const { response } = createErrorResponse(400, 'Invalid JSON', 'Request body must be valid JSON')
      return response
    }

    // Explicitly fail if the AI model fetch throws an error (e.g. ECONNREFUSED)
    return NextResponse.json(
      { error: 'Model Unavailable', message: 'FastAPI model is offline or unreachable. No analysis performed.' },
      { status: 503 }
    );
  }
}
