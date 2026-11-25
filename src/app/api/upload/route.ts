import { NextRequest, NextResponse } from "next/server";
import { fal } from "@/lib/fal";
import { ApiError } from "@fal-ai/client";

// fal's ApiError sets its message to `body.message || statusText`. Under
// HTTP/2 (which this upload path hits), statusText is always "" -- there's
// no reason-phrase in HTTP/2 -- so when fal's error body also has no
// `message` field, ApiError ends up a real Error instance whose .message
// is the empty string "". That passed the `err instanceof Error` check
// below and masked every real failure (403s included) behind the generic
// "Upload failed." fallback, both here and in the client's `upData.error
// || 'Upload failed.'`. Build a message that can't come back empty.
function describeUploadError(err: unknown): string {
  if (err instanceof ApiError) {
    const bodyText =
      err.body && typeof err.body === "object"
        ? JSON.stringify(err.body)
        : String(err.body ?? "");
    const reason = err.message || bodyText || "no further detail from fal";
    return `fal upload failed (HTTP ${err.status}): ${reason}`;
  }
  if (err instanceof Error && err.message) return err.message;
  return "Upload failed.";
}

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

    console.log('upload request', 'bytes:', file.size, 'type:', file.type);
    const url = await fal.storage.upload(file);
    console.log('upload succeeded', url);
    return NextResponse.json({ url });
  } catch (err) {
    const message = describeUploadError(err);
    // Log status/body explicitly -- console.error on an ApiError instance
    // prints its extra properties as "[Object]" by default, which is why
    // this was never visible in the logs as more than a bare status code.
    console.error(
      "upload failed",
      message,
      err instanceof ApiError ? { status: err.status, body: err.body } : err
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
