import type { PublicDeal } from "@/lib/negotiation/public";

// Shared by every buyer chat (/buy/[listingId] and the mock marketplace chat) so the payment
// link and deal statuses work the same everywhere (SPEC "Buyer flow" step 1).

export const DEAL_STATUS: Record<PublicDeal["status"], string> = {
  awaiting_seller_approval: "Waiting for the seller to approve",
  approved: "Approved — preparing your secure payment link",
  rejected: "Not accepted by the seller",
  awaiting_payment: "Waiting for your payment",
  payment_held: "Payment held safely until handoff",
  in_delivery: "On its way",
  completed: "Handed over — payment released to the seller",
  cancelled: "Cancelled — any held payment was released",
};

// Only our Stripe Checkout links are ever rendered as links.
const CHECKOUT_URL = /https:\/\/checkout\.stripe\.com\/\S+/;

/** Renders an agent message; a Stripe Checkout link becomes a "Pay securely" button. */
export function AgentText({ text, buttonClassName }: { text: string; buttonClassName?: string }) {
  const match = text.match(CHECKOUT_URL);
  if (!match) return <>{text}</>;
  const url = match[0].replace(/[.,!?)]+$/, "");
  const [before, after] = text.split(url);
  return (
    <>
      {before.replace(/\s*here:\s*$/, ".")}
      <a
        href={url}
        className={
          buttonClassName ??
          "my-3 flex h-12 items-center justify-center rounded-full bg-[#3B6A8C] font-[family-name:var(--font-ui),system-ui,sans-serif] text-[15px] text-white"
        }
      >
        Pay securely with Stripe
      </a>
      {after.replace(/^\s*—\s*/, "")}
    </>
  );
}
