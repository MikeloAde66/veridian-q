import { fal } from "@fal-ai/client";

// Server-side only. FLUX_API_KEY must never be exposed to the client --
// this file is only ever imported from src/app/api/** route handlers.
if (process.env.FLUX_API_KEY) {
  fal.config({ credentials: process.env.FLUX_API_KEY });
}

export { fal };

export const MODELS = {
  textToImage: "fal-ai/flux/dev",
  imageToImage: "fal-ai/flux/dev/image-to-image",
} as const;
