import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';

import { sendWelcomeEmail } from '@/lib/mail';

const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  dateOfBirth: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date of birth',
  }),
  weight: z.string().optional(),
  height: z.string().optional(),
  smoking: z.string().optional(),
  diabetic: z.string().optional(),
  familyHistory: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 5 registrations per hour per IP
    const ip = request.ip || 'anonymous';
    const { success } = await rateLimit(`ratelimit:register:${ip}`, 5, 3600);
    if (!success) {
      return NextResponse.json({ 
        error: 'Too Many Requests', 
        message: 'Too many registration attempts. Please try again later.' 
      }, { status: 429 });
    }

    await dbConnect();
    const body = await request.json();

    // Validate input
    const validatedData = registerSchema.parse(body);

    // Check if user already exists
    const existingUser = await User.findOne({ email: validatedData.email });
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists with this email' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 12);

    // Create user
    const user = await User.create({
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      email: validatedData.email,
      password: hashedPassword,
      dateOfBirth: new Date(validatedData.dateOfBirth),
      healthData: {
        weight: validatedData.weight,
        height: validatedData.height,
        smoking: validatedData.smoking,
        diabetic: validatedData.diabetic,
        familyHistory: validatedData.familyHistory,
      }
    });

    // Send professional welcome email
    try {
      await sendWelcomeEmail(user.email, user.firstName);
    } catch (mailError) {
      console.error('Failed to send welcome email:', mailError);
      // Non-blocking error, user is still created
    }

    return NextResponse.json(
      { message: 'User registered successfully', userId: user._id },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
