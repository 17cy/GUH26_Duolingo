import { captureByToken } from "@/lib/payments/stripe";

export const runtime = "nodejs";

const page = (title: string, body: string, status: number) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>` +
      `<body style="font-family:system-ui,sans-serif;background:#F6F0E6;color:#1E2B36;padding:32px 20px;max-width:430px;margin:auto">` +
      `<h1 style="font-weight:500">${title}</h1><p>${body}</p></body>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );

// The buyer scans the seller's QR, which opens this URL on the buyer's phone.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let deal;
  try {
    deal = await captureByToken(token);
  } catch (err) {
    console.error("capture failed", err);
    return page("Something went wrong", "We couldn't release the payment. Please try scanning again.", 502);
  }
  if (!deal) return page("Code not valid", "This handoff code is invalid or has already been used.", 404);
  return Response.redirect(new URL(`/buy/${deal.listingId}?handedOver=1`, process.env.APP_URL ?? "http://localhost:3000"), 303);
}
