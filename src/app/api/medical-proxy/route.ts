import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export async function POST(req: Request) {
  try {
    const { location } = await req.json();

    if (!location) {
      return NextResponse.json({ error: 'Location is required' }, { status: 400 });
    }

    // --- 1. PRO CACHING LAYER ---
    const cacheKey = `medical_proxy:${location.toLowerCase().replace(/\s+/g, '_')}`;
    
    if (redis && redis.status === 'ready') {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        console.log(`[Proxy] Cache Hit for: ${location}`);
        return NextResponse.json({ data: JSON.parse(cachedData), source: 'cache' });
      }
    }

    // --- 2. API CONFIG ---
    const APIFY_TOKEN = process.env.APIFY_TOKEN;
    if (!APIFY_TOKEN) {
      return NextResponse.json({ error: 'Apify token not configured' }, { status: 500 });
    }

    const apifyUrl = `https://api.apify.com/v2/acts/poidata~google-maps-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;
    
    console.log(`[Proxy] API Fetch for: ${location}`);

    const response = await fetch(apifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchStringsArray: [`diabétologue à ${location}`, `endocrinologue à ${location}`],
        locationQuery: location,
        maxResults: 10,
        language: "fr",
        maxImages: 1,
        zoom: 13
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Apify Error (${response.status}):`, errorText);
      throw new Error(`Apify request failed`);
    }

    const rawData = await response.json();

    // --- 3. DATA CLEANING & MAPPING ---
    const filteredData = rawData.map((item: any) => ({
      name: item.title,
      specialty: item.categoryName || 'Spécialiste',
      address: item.address,
      phone: item.phone,
      distance: item.distance ? `${(item.distance / 1000).toFixed(1)} km` : null,
      rating: item.totalScore,
      url: item.url,
      image: item.imageUrls?.[0] || item.image || (item.streetViewPanoId 
        ? `https://maps.googleapis.com/maps/api/streetview?size=400x400&pano=${item.streetViewPanoId}&key=NO_KEY_NEEDED_FOR_PANO`
        : "/assets/img/health/doctor-placeholder.webp")
    })).filter((d: any) => d.name);

    // --- 4. UPDATE CACHE ---
    if (redis && redis.status === 'ready' && filteredData.length > 0) {
      await redis.set(cacheKey, JSON.stringify(filteredData), 'EX', 86400);
    }

    return NextResponse.json({ data: filteredData, source: 'api' });
  } catch (error) {
    console.error('API Proxy Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
