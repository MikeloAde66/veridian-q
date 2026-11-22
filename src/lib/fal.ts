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
  // Used only when both a reference photo AND the artist's own canvas paint
  // are present -- lets a ControlNet steer structure/anatomy from the photo
  // while the canvas paint (not the photo) is the image actually being
  // restyled. See CONTROLNET_UNION_PRO below.
  dualConditioned: "fal-ai/flux-general/image-to-image",
  // Vision-language model router, used only for analyzing an uploaded
  // reference photo's color palette -- never for painting generation.
  vision: "openrouter/router/vision",
} as const;

// Which underlying VLM the vision router calls. Picked for speed/cost; any
// OpenRouter-listed vision model name works here if this one is swapped out.
export const VISION_MODEL = "google/gemini-2.5-flash";

// ControlNet used for the dual-conditioning path above. "canny" control mode
// reads edges/structure from the reference photo without forcing its exact
// colors or paint texture onto the result.
export const CONTROLNET_UNION_PRO = "Shakker-Labs/FLUX.1-dev-ControlNet-Union-Pro";
