import { NextRequest, NextResponse } from "next/server";
import { fal } from "@/lib/fal";

// POST /api/upload -- multipart form-data with a single "file" field.
// Uploads to fal's storage and returns a public https URL the generation
// models can actually read (they can't reach data: URLs from the browser).
export async function POST(request: NextRequest) {
  if (!process.env.FLUX_API_KEY) {
    return NextResponse.json(
      { error: "FLUX_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const url = await fal.storage.upload(file);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("upload failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed." },
      { status: 500 }
    );
  }
}
