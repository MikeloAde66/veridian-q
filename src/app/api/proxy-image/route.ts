import { NextRequest, NextResponse } from "next/server";

// GET /api/proxy-image?url=<encoded https URL>
//
// Streams back an external image (the Auto Paint result from fal's CDN)
// through our own origin. The browser draws that image onto the canvas
// (drawAutoPaintOverlayImg, the mini-monitor preview, etc.) and later calls
// canvas.toDataURL() to build an export -- that call throws a SecurityError
// and silently aborts the whole export if ANY image drawn onto the canvas
// was cross-origin without the browser treating it as CORS-cleared. fal's
// storage is meant to be CORS-friendly, but that depends on the CDN, any
// redirect it issues, and the exact request mode the <img crossOrigin>
// attribute produces -- any mismatch there taints the canvas with no visible
// error until export silently comes out blank. Serving the bytes from our
// own origin removes that dependency entirely: same-origin images never
// taint a canvas, regardless of what the upstream CDN sends.
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  if (parsed.protocol !== "https:") {
    return NextResponse.json({ error: "only https urls are allowed" }, { status: 400 });
  }
  // Restrict to fal's own CDN hosts -- this route should only ever be asked
  // to fetch our own Auto Paint results, never an arbitrary third-party URL.
  const allowedHostSuffixes = [".fal.ai", ".fal.media", "fal.ai", "fal.media"];
  const host = parsed.hostname.toLowerCase();
  if (!allowedHostSuffixes.some((suffix) => host === suffix || host.endsWith(suffix))) {
    return NextResponse.json({ error: "host not allowed" }, { status: 400 });
  }

  try {
    const upstream = await fetch(parsed.toString());
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: `upstream fetch failed (${upstream.status})` },
        { status: 502 }
      );
    }
    const contentType = upstream.headers.get("content-type") || "image/png";
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, immutable",
      },
    });
  } catch (err) {
    console.error("proxy-image failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "proxy fetch failed" },
      { status: 500 }
    );
  }
}
