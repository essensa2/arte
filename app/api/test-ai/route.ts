import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const functionsUrl = process.env.SUPABASE_FUNCTIONS_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!functionsUrl || !serviceKey) {
    return NextResponse.json({ error: 'Missing configuration' }, { status: 500 });
  }

  // Call the automation function with a test payload
  const res = await fetch(`${functionsUrl}/automation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`
    },
    body: JSON.stringify({ board_id: 'test' })
  });

  const text = await res.text();
  let data: any = text;
  try {
    data = JSON.parse(text);
  } catch {}

  return NextResponse.json({
    status: res.status,
    statusText: res.statusText,
    data,
    headers: Object.fromEntries(res.headers.entries())
  });
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to test the automation function',
    env_check: {
      has_functions_url: !!process.env.SUPABASE_FUNCTIONS_URL,
      has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      has_openrouter_key: !!process.env.OPENROUTER_API_KEY
    }
  });
}
