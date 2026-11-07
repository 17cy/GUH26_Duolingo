import { getStripe, markPaymentHeld } from "@/lib/payments/stripe";

export const runtime = "nodejs";

// Stripe webhook. The signature is verified against the raw body before anything is trusted.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) return new Response("Missing signature", { status: 400 });

  let event;
  try {
    event = getStripe().webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    markPaymentHeld({ id: s.id, metadata: s.metadata, payment_intent: s.payment_intent, amount_total: s.amount_total });
  }
  return Response.json({ received: true });
}
