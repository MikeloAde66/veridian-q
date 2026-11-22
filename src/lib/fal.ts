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
  // Vision-language model router, used only for analyzing an uploaded
  // reference photo's color palette -- never for painting generation.
  vision: "openrouter/router/vision",
} as const;

// Which underlying VLM the vision router calls. Picked for speed/cost; any
// OpenRouter-listed vision model name works here if this one is swapped out.
export const VISION_MODEL = "google/gemini-2.5-flash";
