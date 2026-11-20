import { NextResponse } from 'next/server';

// Quick connectivity/key check for the Flux Dev (fal.ai) API.
// Visit http://localhost:3001/api/test-fal in the browser to run it.
// Delete this route once Auto Paint is wired up for real -- it's just a smoke test.
export async function GET() {
  const key = process.env.FLUX_API_KEY;

  if (!key) {
    return NextResponse.json(
      { ok: false, error: 'FLUX_API_KEY is not set in .env.local' },
      { status: 500 }
    );
  }

  try {
    const res = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: {
        Authorization: `Key ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'a cute cat, test image' }),
    });

    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, status: res.status, body },
        { status: res.status }
      );
    }

    return NextResponse.json({ ok: true, status: res.status, body });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
