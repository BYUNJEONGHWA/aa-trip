import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query');

  if (!query || !query.trim()) {
    return NextResponse.json({ success: false, error: '검색어를 입력해 주세요.' }, { status: 400 });
  }

  try {
    const encodedQuery = encodeURIComponent(query.trim());
    const instantUrl = `https://map.naver.com/p/api/search/instant-search?query=${encodedQuery}&coords=35.15,126.90`;

    const res = await fetch(instantUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Referer': 'https://map.naver.com/',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      throw new Error(`Naver search HTTP status ${res.status}`);
    }

    const data = await res.json();
    const rawPlaces = data.place || [];

    const formattedPlaces = rawPlaces.map((item: any) => {
      const lat = parseFloat(item.y || item.lat || '0');
      const lng = parseFloat(item.x || item.lng || '0');
      const title = (item.title || item.name || '').replace(/<[^>]*>?/gm, '');
      const category = Array.isArray(item.category)
        ? item.category.join(' > ')
        : item.category || '장소';
      const address = item.roadAddress || item.address || '';

      return {
        id: String(item.id || `custom_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`),
        place_name: title,
        name: title,
        category,
        address,
        roadAddress: address,
        latitude: lat,
        longitude: lng,
        lat,
        lng,
      };
    });

    return NextResponse.json({
      success: true,
      query: query.trim(),
      total: formattedPlaces.length,
      places: formattedPlaces,
    });
  } catch (err: any) {
    console.error('Place search error:', err);
    return NextResponse.json({
      success: false,
      error: '장소 검색 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      details: err.message,
    }, { status: 500 });
  }
}
