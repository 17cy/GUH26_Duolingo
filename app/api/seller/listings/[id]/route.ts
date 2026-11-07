import { getListing } from "@/lib/store";

// Seller-side only: includes floorPrice. Never expose this route's shape to the buyer side.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const listing = getListing((await params).id);
  if (!listing) return Response.json({ error: "Listing not found" }, { status: 404 });
  return Response.json({ listing });
}
