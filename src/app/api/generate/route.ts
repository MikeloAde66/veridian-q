import { NextResponse } from 'next/server';
import { fal, MODELS, CONTROLNET_UNION_PRO } from '@/lib/fal';

// Auto Paint backend -- wired the same way the proven "Activate Q" button
// on the other Veridian Q site works: the official @fal-ai/client SDK
// (fal.subscribe, which queues/polls reliably) against a real https image
// URL, never a browser data: URL (the fal models can't fetch those).
// - imageUrl + canvasImageUrl both present -> dual conditioning: the artist's
//   own canvas paint is the base image being restyled, the reference photo
//   only steers structure/anatomy through a ControlNet (ControlNet-Union-Pro,
//   canny mode) scaled by traceOpacity. Neither image is dropped.
// - imageUrl only -> image-to-image, repaints the reference photo in the
//   chosen style (unchanged from before).
// - no imageUrl -> text-to-image, generates purely from the typed prompt + style.
// Either prompt or imageUrl must be present -- the route refuses to run
// blind with neither (no photo, no prompt = nothing to go on). canvasImageUrl
// alone (no reference photo) is ignored -- it only matters paired with one.

type GenerateBody = {
  prompt?: string;
  styleModifier?: string;
  imageUrl?: string;
  canvasImageUrl?: string; // the artist's own current paint layers, https url
  strength?: number; // 0-1, image-to-image only: how far to depart from the photo
  traceOpacity?: number; // 0-100 from the Reference Opacity slider; dual-conditioning only
  pigments?: string[]; // active pigment names (e.g. "Burnt Sienna"), mentioned in the prompt
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
  // subject/composition drift but still smoothed detail into a generic
  // glossy look. 0.22 kept the source pixels almost untouched -- which
  // fixed the smoothing, but then the chosen medium (impasto, monochromatic,
  // etc.) barely showed up: it looked too close to the original photo to
  // read as a *painting preview*. 0.45 was the next middle ground, but every
  // reported "muted/washed-out" result traced back to real photos that were
  // themselves pale/hazy (overcast landscapes, soft portraits) -- at 0.45 the
  // model still keeps well over half the source image's own desaturated
  // pixel values, and no amount of prompt wording fully out-votes that much
  // surviving source color. The earlier fix (bumping to 0.55) was gated on
  // `pigments`, which is ONLY set when the artist clicks a named-pigment
  // color swatch first -- typing pigment names directly into the free-text
  // prompt (the actual way every muted-result report was produced) never
  // touched that gate at all. Raising the baseline itself, unconditionally,
  // so any photo-based Auto Paint gets real room for vivid color regardless
  // of how the prompt was written.
  const pigments = Array.isArray(body.pigments) ? body.pigments.filter(Boolean) : [];
  const strength = typeof body.strength === 'number'
    ? body.strength
    : pigments.length > 0 ? 0.68 : 0.6;
  const canvasImageUrl = body.canvasImageUrl?.trim();
  // Dual conditioning only makes sense paired with a reference photo -- canvas
  // paint alone (no photo) just falls through to the existing single-image path.
  const dualConditioning = Boolean(imageUrl) && Boolean(canvasImageUrl);

  if (!userPrompt && !imageUrl) {
    return NextResponse.json(
      { ok: false, error: 'Need a reference photo, a typed prompt, or both -- nothing to paint from.' },
      { status: 400 }
    );
  }

  // Mentioning the artist's chosen pigments steers color mixing toward paint
  // names Mixbox actually models, instead of generic/arbitrary hues. The
  // original phrasing here ("Painted using a palette built around X, Y, Z")
  // was too weak against a real photo: at a moderate image-to-image strength
  // the model leans on the photo's OWN colors (often pale/washed-out) far
  // more than a soft, trailing mention of pigment names, so results came out
  // muted instead of vivid. This needs to read as an explicit override, not
  // a suggestion -- and it's placed early in finalPrompt below (not appended
  // last) since FLUX weighs earlier instructions more heavily.
  const pigmentClause = pigments.length
    ? `Use these exact pigments as the dominant colors throughout, rendered vivid and fully saturated -- not muted, pale, or washed-out: ${pigments.join(', ')}. These rich, intense paint colors should replace the reference photo's own colors wherever they conflict.`
    : '';

  // The photo itself is frequently pale, overcast, or desaturated -- plain
  // text-to-image Auto Paint (no photo) never has this problem because
  // there's no source pixels to anchor to, but image-to-image inherits the
  // photo's own color mood by default no matter what the prompt says to do.
  // This needs to run unconditionally on every photo-based Auto Paint, not
  // only when the artist happened to pick a named pigment swatch first
  // (pigmentClause above) -- most results came from typed prompts or no
  // color instruction at all, so vividness can't depend on that gate.
  const vividnessClause = imageUrl
    ? 'render the final painting in bold, rich, fully saturated color throughout -- do not mute, dull, desaturate, or wash the colors out to match the photo\'s own tones, even where the photo itself is pale, hazy, overcast, or low-contrast; the paint medium should look vivid and alive regardless of the source lighting'
    : '';

  // When repainting a real photo, say explicitly that the subject must stay
  // the same -- only the medium changes. Without this the model treats the
  // style words ("rendered as a charcoal sketch...") as license to redesign
  // the scene, not just reinterpret its rendering.
  // Flux's default instinct is toward a clean, resolved, "finished render"
  // look -- that's the opposite of how real paint/charcoal/pastel actually
  // reads. Unevenness, unresolved passages and visible correction are what
  // signal a human hand working in real time rather than a smoothed digital
  // illustration, so this has to be stated as a goal, not just implied by
  // "not airbrushed" -- otherwise the model quietly cleans it back up.
  const messinessClause =
    'do not over-resolve or clean up the image -- leave it a little unfinished and imperfect in places: ' +
    'visible pentimento or correction marks where a line or shape was reworked, strokes that break, skip, ' +
    'or vary in pressure rather than flowing evenly, edges that go soft, smudged, or lost in some areas and ' +
    'stay sharp in others, uneven or patchy paint/pigment coverage rather than flat even fills -- ' +
    'this deliberate unevenness is what makes it read as a real physical painting made by hand, not a ' +
    'polished digital illustration, so do not smooth it away in pursuit of a tidier result';

  const finalPrompt = imageUrl
    ? [
        'Paint this subject in a real physical medium, as a genuine painting, not a filtered photo',
        styleModifier,
        userPrompt,
        vividnessClause,
        pigmentClause,
        'keep the same subject, pose, framing and composition as the reference photo',
        'fully commit to the chosen medium\'s real physical qualities -- visible brushstrokes, paint body and thickness, texture, grain, or linework -- even where that means departing from the photo\'s own smoothness, sharpness or exact colors',
        'rough, scraggly, hand-made edges and texture, not photographic or airbrushed -- this should look and feel like paint, pastel, or charcoal on a surface, not a digital filter over a photo',
        messinessClause,
      ].filter(Boolean).join(', ')
    : [styleModifier, userPrompt, pigmentClause, messinessClause].filter(Boolean).join(', ') || styleModifier || 'a painting';

  const model = dualConditioning
    ? MODELS.dualConditioned
    : imageUrl
    ? MODELS.imageToImage
    : MODELS.textToImage;
  const input: Record<string, unknown> = {
    prompt: finalPrompt,
    num_images: 1,
  };
  if (dualConditioning) {
    // The artist's own canvas paint is the base image actually being
    // restyled (same role imageUrl plays in the single-image path below) --
    // the reference photo never gets blended in directly, it only steers
    // structure/anatomy through the ControlNet. Strength is pulled down a
    // touch from the single-image default: canvas paint is already the
    // artist's own composition, so it needs less forced departure than a
    // straight photo does to read as "painted."
    const dualStrength = Math.max(0.3, Number((strength - 0.1).toFixed(2)));
    // traceOpacity (0-100, from the Reference Opacity slider) becomes the
    // ControlNet's conditioning_scale: how strongly the photo's structure
    // constrains the result. Capped at .55 -- full strength here fights the
    // "paint it, don't trace it" instructions above.
    const traceScale = Number((((body.traceOpacity ?? 50) / 100) * 0.55).toFixed(2));
    input.image_url = canvasImageUrl;
    input.strength = dualStrength;
    // Union-Pro is a *union* ControlNet -- fal's flux-general endpoint only
    // wires up `control_mode` correctly when it's passed via the separate
    // `controlnet_unions` array, AND the control image/mode/scale are nested
    // one level deeper under that item's own `controls` array (confirmed via
    // fal's schema: ControlNetUnion = { path, controls: ControlNetUnionInput[] },
    // not flat fields on the ControlNetUnion item itself). The flat-fields
    // version was rejected with "controls: Field required".
    input.controlnet_unions = [
      {
        path: CONTROLNET_UNION_PRO,
        controls: [
          {
            control_image_url: imageUrl,
            conditioning_scale: traceScale,
            control_mode: 'canny',
          },
        ],
      },
    ];
  } else if (imageUrl) {
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
    // fal's ApiError puts the real validation detail in `.body` (422s), which
    // console.error alone truncates to "[Object]" in Vercel's log viewer --
    // stringify it explicitly so the actual rejected field/reason is visible.
    const falBody = (err as { body?: unknown })?.body;
    console.error('generate failed', err instanceof Error ? err.message : err, 'promptLength:', finalPrompt.length, 'body:', JSON.stringify(falBody));
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        detail: falBody,
      },
      { status: 500 }
    );
  }
}
