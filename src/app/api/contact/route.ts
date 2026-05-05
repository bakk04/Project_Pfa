import { NextRequest, NextResponse } from 'next/server';
import { sendContactEmail } from '@/lib/mail';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';

const ContactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  subject: z.string().min(1, 'Subject is required'),
  message: z.string().min(1, 'Message is required'),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 3 requests per hour per IP
    const ip = request.ip || 'anonymous';
    const { success } = await rateLimit(`ratelimit:contact:${ip}`, 3, 3600);
    if (!success) {
      return NextResponse.json({ 
        error: 'Too Many Requests', 
        message: 'You have sent too many messages. Please try again later.' 
      }, { status: 429 });
    }

    const body = await request.json();
    console.log('[Contact API] Received body:', body);
    
    const result = ContactSchema.safeParse(body);
    if (!result.success) {
      console.error('[Contact API] Validation failed:', result.error.format());
      return NextResponse.json({ 
        error: 'Validation failed', 
        details: result.error.issues 
      }, { status: 400 });
    }

    await sendContactEmail(result.data);

    return NextResponse.json({ 
      success: true, 
      message: 'Your message has been sent. Thank you!' 
    });
  } catch (error) {
    console.error('Contact API error:', error);
    return NextResponse.json({ 
      error: 'Failed to send message. Please try again later.' 
    }, { status: 500 });
  }
}
