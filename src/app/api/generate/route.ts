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
  // 0.75 was close to a full re-roll -- the model barely looked at the photo
  // and mostly invented a new image from the text prompt. 0.35 fixed the
  // subject/composition drift, but still smoothed away fine detail (fur,
  // texture, hard edges) toward a generic glossy look. 0.22 stays even
  // closer to the source pixels so that kind of detail survives, while the
  // chosen medium still visibly changes how it's rendered.
  const strength = typeof body.strength === 'number' ? body.strength : 0.22;

  if (!userPrompt && !imageUrl) {
    return NextResponse.json(
      { ok: false, error: 'Need a reference photo, a typed prompt, or both -- nothing to paint from.' },
      { status: 400 }
    );
  }

  // When repainting a real photo, say explicitly that the subject must stay
  // the same -- only the medium changes. Without this the model treats the
  // style words ("rendered as a charcoal sketch...") as license to redesign
  // the scene, not just reinterpret its rendering.
  const finalPrompt = imageUrl
    ? [
        'Repaint this exact photo',
        styleModifier,
        userPrompt,
        'keep the same subject, pose, framing and composition as the reference photo -- only the medium and rendering style change, nothing depicted should change',
        'preserve every fine detail exactly as in the reference -- rough, scraggly, textured fur and hair, hard sharp edges, visible individual strands -- do not smooth, soften, blur, or simplify any edge or texture, do not make it glossy or airbrushed',
      ].filter(Boolean).join(', ')
    : [styleModifier, userPrompt].filter(Boolean).join(', ') || styleModifier || 'a painting';

  const model = imageUrl ? MODELS.imageToImage : MODELS.textToImage;
  const input: Record<string, unknown> = {
    prompt: finalPrompt,
    num_images: 1,
  };
  if (imageUrl) {
    // No image_size here: forcing 'square_hd' was stretching/cropping every
    // non-square reference photo into a square before the model even started,
    // which on its own would make the result look like a different photo.
    // Leaving it unset lets the model match the input photo's own dimensions.
    input.image_url = imageUrl;
    input.strength = strength;
  } else {
    input.image_size = 'square_hd';
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
