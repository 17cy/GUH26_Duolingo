import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { z } from "zod";
import { addEvent } from "@/lib/events";
import { saveListing } from "@/lib/store";
import type { Listing } from "@/lib/types";
import { identifyItem, type ImageMediaType } from "@/lib/vision/identify";

export const runtime = "nodejs";

const EXT: Record<ImageMediaType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_BYTES = 5 * 1024 * 1024;

const BodySchema = z.object({
  text: z.string().trim().max(500).default(""),
  // Pounds as typed by the seller, e.g. "120" or "119.99"; stored as integer pence.
  wantedPrice: z
    .string()
    .trim()
    .regex(/^\d{1,6}(\.\d{1,2})?$/, "Wanted price must be a number like 120 or 119.99")
    .transform((v) => Math.round(Number(v) * 100))
    .optional(),
});

export async function POST(req: Request) {
  const form = await req.formData();
  const photo = form.get("photo");
  if (!(photo instanceof File)) return Response.json({ error: "Attach a photo" }, { status: 400 });
  if (!(photo.type in EXT)) return Response.json({ error: "Photo must be JPEG, PNG, WebP or GIF" }, { status: 400 });
  if (photo.size > MAX_BYTES) return Response.json({ error: "Photo must be under 5 MB" }, { status: 400 });

  const body = BodySchema.safeParse({
    text: form.get("text") ?? undefined,
    wantedPrice: form.get("wantedPrice") || undefined,
  });
  if (!body.success) return Response.json({ error: z.prettifyError(body.error) }, { status: 400 });

  const mediaType = photo.type as ImageMediaType;
  const bytes = Buffer.from(await photo.arrayBuffer());
  const fileName = `${nanoid()}.${EXT[mediaType]}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.writeFileSync(path.join(uploadDir, fileName), bytes);

  let item;
  try {
    item = await identifyItem(bytes, mediaType, body.data.text);
  } catch (err) {
    console.error("identify failed", err);
    return Response.json({ error: "Couldn't identify the item. Try another photo." }, { status: 502 });
  }

  const listing: Listing = {
    id: nanoid(),
    sellerName: "Alex",
    item,
    imageUrl: `/uploads/${fileName}`,
    description: body.data.text,
    wantedPrice: body.data.wantedPrice,
    style: "flexible",
    status: "draft",
    platforms: [],
    createdAt: new Date().toISOString(),
  };
  saveListing(listing);
  addEvent(listing.id, "listing_created", "Draft listing created from photo");
  addEvent(listing.id, "item_identified", `Identified as ${item.name}`, {
    confidence: item.confidence,
    condition: item.condition,
  });

  return Response.json({ listing });
}
