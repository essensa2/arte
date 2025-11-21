import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const functionsUrl = process.env.SUPABASE_FUNCTIONS_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!functionsUrl || !serviceKey) {
    return NextResponse.json({ error: 'Missing SUPABASE_FUNCTIONS_URL or SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
  }
  const body = await request.json().catch(() => ({}));
  const res = await fetch(`${functionsUrl}/automation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`
    },
    body: JSON.stringify(body ?? {})
  });
  const text = await res.text();
  let json: any = text;
  try {
    json = JSON.parse(text);
  } catch {}
  return NextResponse.json({ status: res.status, data: json });
}


