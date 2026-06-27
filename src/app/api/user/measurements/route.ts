import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Measurement from '@/models/Measurement';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    // Find measurements of type 'heart_rate' for this user, sorted by date descending
    const measurements = await Measurement.find({
      userId: session.user.id,
      type: 'heart_rate'
    }).sort({ createdAt: -1 }).limit(20).lean();

    // Map DB documents to TestSession structure
    const testHistory = measurements.map((m: any) => ({
      id: m._id.toString(),
      timestamp: m.createdAt.toISOString(),
      status: m.metadata?.status || 'success',
      metrics: {
        hr: m.value,
        sqi: m.metadata?.sqi || 1.0,
        risk_status: m.metadata?.risk_status || 'low',
        probability: m.metadata?.probability || 0
      }
    }));

    return NextResponse.json(testHistory);
  } catch (error) {
    console.error('Fetch measurements error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { status, metrics } = await request.json();

    await dbConnect();

    // Create a measurement document
    const measurement = await Measurement.create({
      userId: session.user.id,
      type: 'heart_rate',
      value: metrics?.hr || 70,
      unit: 'bpm',
      metadata: {
        status: status || 'success',
        sqi: metrics?.sqi || 1.0,
        risk_status: metrics?.risk_status || 'low',
        probability: metrics?.probability || 0,
      }
    });

    const testSession = {
      id: measurement._id.toString(),
      timestamp: measurement.createdAt.toISOString(),
      status: status || 'success',
      metrics: {
        hr: measurement.value,
        sqi: measurement.metadata.get('sqi'),
        risk_status: measurement.metadata.get('risk_status'),
        probability: measurement.metadata.get('probability')
      }
    };

    return NextResponse.json(testSession);
  } catch (error) {
    console.error('Create measurement error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
