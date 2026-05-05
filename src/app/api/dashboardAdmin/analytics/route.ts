import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Measurement from '@/models/Measurement';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // Aggregating tests per day for the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const testAnalytics = await Measurement.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Format for charts
    const chartData = testAnalytics.map(item => ({
      day: item._id,
      tests: item.count
    }));

    // Example cost analytics (can be based on number of tests)
    const costAnalytics = chartData.map(item => ({
      day: item.day,
      cost: (item.tests * 0.05).toFixed(2) // Simulate $0.05 per test
    }));

    return NextResponse.json({
      testAnalytics: chartData,
      costAnalytics
    });
  } catch (error) {
    console.error('Fetch analytics error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
