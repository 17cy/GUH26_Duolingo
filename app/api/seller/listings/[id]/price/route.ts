import { z } from "zod";
import { addEvent } from "@/lib/events";
import { getListing, saveListing } from "@/lib/store";

const pence = z.number().int().positive().max(100_000_000);

const BodySchema = z
  .object({
    listPrice: pence,
    floorPrice: pence,
    style: z.enum(["firm", "flexible", "quick"]),
  })
  .refine((b) => b.floorPrice <= b.listPrice, { message: "Floor price can't be above the list price", path: ["floorPrice"] });

// Seller confirms list price, floor price and style → listing status "priced".
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const listing = getListing((await params).id);
  if (!listing) return Response.json({ error: "Listing not found" }, { status: 404 });
  if (listing.status !== "draft" && listing.status !== "priced") {
    return Response.json({ error: `This listing is already ${listing.status}` }, { status: 409 });
  }

  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: z.prettifyError(body.error) }, { status: 400 });

  const updated = saveListing({ ...listing, ...body.data, status: "priced" });
  addEvent(listing.id, "priced", `Priced at £${(body.data.listPrice / 100).toFixed(2)} (${body.data.style})`, {
    listPrice: body.data.listPrice,
    style: body.data.style,
  });
  return Response.json({ listing: updated });
}
