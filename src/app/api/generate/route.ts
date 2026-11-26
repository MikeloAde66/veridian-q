import { NextResponse } from 'next/server';
import { fal, MODELS } from '@/lib/fal';

// Auto Paint backend -- wired the same way the proven "Activate Q" button
// on the other Veridian Q site works: the official @fal-ai/client SDK
// (fal.subscribe, which queues/polls reliably) against a real https image
// URL, never a browser data: URL (the fal models can't fetch those).
// Deliberately kept to two simple paths, direct image-to-image:
// - imageUrl present -> image-to-image, repaints the reference photo in the
//   chosen style.
// - no imageUrl -> text-to-image, generates purely from the typed prompt + style.
// Either prompt or imageUrl must be present -- the route refuses to run
// blind with neither (no photo, no prompt = nothing to go on).
//
// There used to be a third path here: canvas-paint + reference-photo "dual
// conditioning" through a ControlNet-Union, with the reference photo only
// steering structure/anatomy rather than being repainted directly. Dropped
// on direct request -- it added a second strength value, a second model, and
// a ControlNet payload shape that took three separate production bugs to get
// right, on top of a client-side canvas-paint upload step. Direct
// image-to-image on the photo itself is simpler and was the known-working
// baseline; it's the one path this route exercises now.

type GenerateBody = {
  prompt?: string;
  styleModifier?: string;
  imageUrl?: string;
  strength?: number; // 0-1, image-to-image only: how far to depart from the photo
  pigments?: string[]; // active pigment names (e.g. "Burnt Sienna"), mentioned in the prompt
};

// TEMP SAFETY CAP -- the app has no working sign-in yet (DISABLE_AUTH_GATE is
// on), so this is a stand-in limit to stop any one visitor from running up
// unbounded fal.ai spend while testing. Tracked per-browser via an httpOnly
// cookie, incremented only on a successful generation (failed/rejected
// requests don't count against the cap). Clearing cookies resets a visitor's
// count -- an accepted gap for now, not a real auth boundary. Remove this
// once real sign-in + per-account limits are in place.
const MAX_GENERATIONS_PER_BROWSER = 5;
const GENERATION_COUNT_COOKIE = 'aq_gen_count';

export async function POST(req: Request) {
  if (!process.env.FLUX_API_KEY) {
    return NextResponse.json(
      { ok: false, error: 'FLUX_API_KEY is not set in .env.local' },
      { status: 500 }
    );
  }

  const cookieHeader = req.headers.get('cookie') || '';
  const countMatch = cookieHeader.match(new RegExp(`${GENERATION_COUNT_COOKIE}=(\\d+)`));
  const currentCount = countMatch ? parseInt(countMatch[1], 10) : 0;

  if (currentCount >= MAX_GENERATIONS_PER_BROWSER) {
    return NextResponse.json(
      {
        ok: false,
        testingLimitReached: true,
        error: `Due to the testing phase, only ${MAX_GENERATIONS_PER_BROWSER} Auto Paint generations are allowed per browser right now. Sign up now to reserve your standard generation pack when we launch.`,
      },
      { status: 429 }
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
  // read as a *painting preview*. Pushing it up to 0.6/0.68 fixed muted
  // color, but direct instruction (verbatim): "Auto paint is the mix and
  // enhancement of the paint characteristic to the reference. Not recreate
  // AI slop of something else. Just the paint." -- 0.6+ gives the model real
  // room to depart from the photo's actual content, not just its rendering,
  // which is the opposite of what this feature is for. Color vividness is
  // now carried by vividnessClause/pigmentClause below as an explicit prompt
  // override, not by strength -- so strength can come back down to where it
  // belongs (how much paint texture/medium character to apply on top of the
  // reference) without relying on high strength to also fix color.
  const pigments = Array.isArray(body.pigments) ? body.pigments.filter(Boolean) : [];
  const strength = typeof body.strength === 'number'
    ? body.strength
    : pigments.length > 0 ? 0.5 : 0.45;

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

  // This is an enhancement pass over the reference photo, not a reimagining
  // of it -- every object, face, pose and detail already in the photo has to
  // stay recognizably itself. Only the paint medium's own qualities (texture,
  // brushwork, color handling) get added on top. Earlier wording ("even where
  // that means departing from the photo's own smoothness, sharpness or exact
  // colors") was read by the model as license to depart from the photo's
  // actual content, not just its photographic rendering -- removed.
  //
  // That fidelity rule is about CONTENT, not STYLE -- direct instruction:
  // "It can add style and ethnic flavor to every painting or drawing."
  // styleModifier and userPrompt (chosen art style, cultural/ethnic artistic
  // tradition, mood, technique) are exactly the axis that's meant to vary
  // freely; styleFlavorClause says so explicitly so the fidelity instruction
  // above doesn't get over-applied to style too.
  const styleFlavorClause =
    'the chosen artistic style, technique, and any cultural or ethnic artistic tradition or flavor named above should come through fully and vividly in how it\'s painted -- that creative latitude belongs entirely to style and technique, never to changing what is actually depicted';

  const finalPrompt = imageUrl
    ? [
        'Take this exact reference photo and repaint it as a real physical painting of the same subject -- same person or object, same pose, same expression, same framing, same composition, same scene -- do not invent, change, remove, or substitute anything that is actually in the photo',
        styleModifier,
        userPrompt,
        vividnessClause,
        pigmentClause,
        styleFlavorClause,
        'the only thing changing is the medium: apply real paint/charcoal/pastel qualities -- visible brushstrokes, paint body and thickness, texture, grain, or linework -- on top of the photo\'s own content, not instead of it',
        'rough, scraggly, hand-made edges and texture, not photographic or airbrushed -- this should look and feel like paint, pastel, or charcoal on a surface, not a digital filter over a photo',
        messinessClause,
      ].filter(Boolean).join(', ')
    : [styleModifier, userPrompt, pigmentClause, styleFlavorClause, messinessClause].filter(Boolean).join(', ') || styleModifier || 'a painting';

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

  // Log that a request actually arrived, before calling fal -- a successful
  // run previously left zero trace in Vercel's logs (only the catch block
  // below ever logged anything), which made it impossible to tell "nothing
  // was clicked" apart from "it ran and came back fine" from the server
  // side alone. This one line is the difference between those two cases.
  console.log('generate request', 'model:', model, 'strength:', imageUrl ? strength : undefined, 'promptLength:', finalPrompt.length);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (fal.subscribe as any)(model, { input, logs: false });

    const images = (result.data as { images?: { url?: string }[] })?.images ?? [];
    const outUrl = images[0]?.url;
    if (!outUrl) {
      console.error('generate: fal returned no image', JSON.stringify(result.data));
      return NextResponse.json({ ok: false, error: 'No image returned.', body: result.data }, { status: 502 });
    }

    console.log('generate succeeded', outUrl);
    const response = NextResponse.json({ ok: true, imageUrl: outUrl, finalPrompt });
    response.cookies.set(GENERATION_COUNT_COOKIE, String(currentCount + 1), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year -- this is a long-lived per-browser cap, not a session cookie
    });
    return response;
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
