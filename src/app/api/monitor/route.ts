import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting: 5 requests per minute per user
    const { success } = await rateLimit(`ratelimit:monitor:${session.user.id}`, 5, 60);
    if (!success) {
      return NextResponse.json({ 
        error: 'Too Many Requests', 
        message: 'You have exceeded the analysis limit. Please wait a minute.' 
      }, { status: 429 });
    }

    const body = await request.json();
    
    // In a real production environment, this would be an environment variable
    // like process.env.FASTAPI_URL or similar.
    const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';
    
    const response = await fetch(`${FASTAPI_URL}/monitor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: 'FastAPI error', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[API Monitor] Proxy error:', error);
    
    return NextResponse.json(
      { error: 'Model Unavailable', message: 'FastAPI model is offline or unreachable. No analysis performed.' },
      { status: 503 }
    );
  }
}
