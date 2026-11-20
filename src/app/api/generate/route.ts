import { NextResponse } from 'next/server';
import { fal, MODELS } from '@/lib/fal';

// Auto Paint backend -- wired the same way the proven "Activate Q" button
// on the other Veridian Q site works: the official @fal-ai/client SDK
// (fal.subscribe, which queues/polls reliably) against a real https image
// URL, never a browser data: URL (the fal models can't fetch those).
// - imageUrl present -> image-to-image, repaints the photo in the chosen style.
// - no imageUrl -> text-to-image, generates purely from the typed prompt + style.
// Either prompt or imageUrl must be present -- the route refuses to run
// blind with neither (no photo, no prompt = nothing to go on).

type GenerateBody = {
  prompt?: string;
  styleModifier?: string;
  imageUrl?: string;
  strength?: number; // 0-1, image-to-image only: how far to depart from the photo
};

export async function POST(req: Request) {
  if (!process.env.FLUX_API_KEY) {
    return NextResponse.json(
      { ok: false, error: 'FLUX_API_KEY is not set in .env.local' },
      { status: 500 }
    );
  }

  let body: GenerateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const userPrompt = (body.prompt ?? '').trim();
  const styleModifier = (body.styleModifier ?? '').trim();
  const imageUrl = body.imageUrl?.trim();
  const strength = typeof body.strength === 'number' ? body.strength : 0.75;

  if (!userPrompt && !imageUrl) {
    return NextResponse.json(
      { ok: false, error: 'Need a reference photo, a typed prompt, or both -- nothing to paint from.' },
      { status: 400 }
    );
  }

  const finalPrompt = [styleModifier, userPrompt].filter(Boolean).join(', ') || styleModifier || 'a painting';

  const model = imageUrl ? MODELS.imageToImage : MODELS.textToImage;
  const input: Record<string, unknown> = {
    prompt: finalPrompt,
    num_images: 1,
    image_size: 'square_hd',
  };
  if (imageUrl) {
    input.image_url = imageUrl;
    input.strength = strength;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (fal.subscribe as any)(model, { input, logs: false });

    const images = (result.data as { images?: { url?: string }[] })?.images ?? [];
    const outUrl = images[0]?.url;
    if (!outUrl) {
      return NextResponse.json({ ok: false, error: 'No image returned.', body: result.data }, { status: 502 });
    }

    return NextResponse.json({ ok: true, imageUrl: outUrl, finalPrompt });
  } catch (err) {
    console.error('generate failed', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
