import { z } from "zod";
import { cancelDeal } from "@/lib/payments/stripe";

export const runtime = "nodejs";

const Body = z.object({ dealId: z.string().min(1).max(64) });

// Cancels a deal whose handoff didn't happen and releases any held payment.
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "dealId required" }, { status: 400 });
  try {
    const ok = await cancelDeal(body.data.dealId);
    if (!ok) return Response.json({ error: "This deal can't be cancelled" }, { status: 409 });
  } catch (err) {
    console.error("cancel failed", err);
    return Response.json({ error: "Couldn't cancel with Stripe. Try again." }, { status: 502 });
  }
  return Response.json({ ok: true });
}
