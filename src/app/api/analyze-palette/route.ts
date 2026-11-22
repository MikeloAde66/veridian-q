import { NextRequest, NextResponse } from "next/server";
import { fal, MODELS, VISION_MODEL } from "@/lib/fal";

// POST /api/analyze-palette -- { imageUrl: string }
// Separate from /api/generate: this calls a vision-language model (not Flux)
// to look at an already-uploaded reference photo and recommend a named,
// temperature-tagged color palette for the painting -- it never generates
// or alters any image. Reconnected on top of the direct image-to-image
// rewire: this is purely advisory now (feeds the "Use in Prompt" pigment
// clause), it does not gate strength or vividness -- those are unconditional
// on the generate route regardless of whether this ran.
export async function POST(request: NextRequest) {
  if (!process.env.FLUX_API_KEY) {
    return NextResponse.json(
      { error: "FLUX_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl.trim() : "";
    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
    }

    const systemPrompt = [
      "You are a professional painter's color consultant.",
      "Respond with ONLY raw JSON, no markdown, no code fences, no commentary, matching exactly this shape:",
      '{"temperature":"warm"|"cool"|"neutral","colors":[{"name":string,"hex":string}],"summary":string}',
      "List 4 to 6 colors using real artist pigment names (for example Burnt Sienna, Ultramarine Blue,",
      "Cadmium Yellow, Yellow Ochre, Phthalo Green, Quinacridone Magenta, Payne's Grey, Titanium White)",
      "that best represent the dominant palette actually visible in the image, each with its closest hex value.",
      "summary is exactly one sentence describing the overall color mood and temperature.",
    ].join(" ");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (fal.subscribe as any)(MODELS.vision, {
      input: {
        image_urls: [imageUrl],
        model: VISION_MODEL,
        system_prompt: systemPrompt,
        prompt:
          "Analyze the color palette of this reference image for an oil/mixed-media painting project.",
        temperature: 0.3,
      },
      logs: false,
    });

    const raw = (result.data?.output ?? "").toString().trim();
    const jsonText = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();

    let parsed: { temperature?: string; colors?: { name: string; hex: string }[]; summary?: string } | null = null;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      parsed = null;
    }

    if (!parsed || !Array.isArray(parsed.colors) || !parsed.colors.length) {
      return NextResponse.json({
        temperature: null,
        colors: [],
        summary: raw || "Could not analyze this image.",
      });
    }

    return NextResponse.json({
      temperature: parsed.temperature ?? null,
      colors: parsed.colors.slice(0, 6).filter((c) => c && c.name && c.hex),
      summary: parsed.summary ?? "",
    });
  } catch (err) {
    console.error("analyze-palette failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed." },
      { status: 500 }
    );
  }
}
