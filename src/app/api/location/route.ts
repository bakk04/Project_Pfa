import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const IPINFO_TOKEN = process.env.API_ACCESS;

    if (!IPINFO_TOKEN) {
      return NextResponse.json({ error: 'IPInfo token not configured' }, { status: 500 });
    }

    const response = await fetch(`https://ipinfo.io/json?token=${IPINFO_TOKEN}`);

    if (!response.ok) {
      throw new Error('IPInfo request failed');
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('IPInfo Proxy Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
