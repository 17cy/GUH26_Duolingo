import localFont from "next/font/local";
import QRCode from "qrcode";
import { TrackingSteps } from "@/app/buy/Delivery";
import { syncTracking } from "@/lib/delivery/handoff";
import { MEETING_POINT } from "@/lib/delivery/pickup";
import { getDeal, getListing } from "@/lib/store";
import { CancelButton, Refresh } from "./controls";

export const dynamic = "force-dynamic";

const serif = localFont({ src: "../../seller/fonts/cormorant-garamond-latin.woff2", weight: "400 600", variable: "--font-serif" });
const sans = localFont({ src: "../../seller/fonts/inter-tight-latin.woff2", weight: "400 500", variable: "--font-ui" });
const SERIF = "font-[family-name:var(--font-serif),Georgia,serif]";

const gbp = (p: number) => `£${(p / 100).toFixed(p % 100 === 0 ? 0 : 2)}`;

// Shown on the SELLER's phone at the meeting. The buyer scans the QR to confirm they have the
// item, which captures the held payment.
export default async function HandoffPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  await syncTracking(dealId); // locker deals advance while the seller watches too
  const deal = getDeal(dealId);
  const listing = deal && getListing(deal.listingId);

  let body: React.ReactNode;
  if (!deal || !listing) {
    body = <p className="text-[#5F6B73]">Deal not found.</p>;
  } else if (deal.status === "payment_held" && deal.handoffToken) {
    const url = `${process.env.APP_URL ?? "http://localhost:3000"}/api/handoff/${deal.handoffToken}`;
    const qr = await QRCode.toDataURL(url, { margin: 1, width: 320, color: { dark: "#1E2B36", light: "#FBF8F2" } });
    body = (
      <>
        <p className="text-[15px] leading-relaxed text-[#5F6B73]">
          {gbp(deal.price)} from {deal.buyerName} is held safely. Hand over the item, then let them scan this code to release the payment to
          you.
        </p>
        {deal.pickupSlot && (
          <p className="rounded-2xl bg-[#BAD8EC] px-4 py-3 text-[14px] text-[#14212B]">
            Pickup: {deal.pickupSlot} at {MEETING_POINT}
          </p>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="Handoff QR code for the buyer to scan" className="mx-auto w-full max-w-[320px] rounded-2xl" />
        <CancelButton dealId={deal.id} />
      </>
    );
  } else if (deal.status === "in_delivery" && deal.tracking) {
    body = (
      <>
        <p className="text-[15px] leading-relaxed text-[#5F6B73]">
          {gbp(deal.price)} from {deal.buyerName} is held safely. Drop the item at the locker; the payment is released to you automatically on
          delivery.
        </p>
        <TrackingSteps tracking={deal.tracking} />
      </>
    );
  } else if (deal.status === "completed") {
    body = <p className={`${SERIF} text-[26px]`}>Handed over. {gbp(deal.price)} has been released to you.</p>;
  } else if (deal.status === "cancelled") {
    body = <p className="text-[#5F6B73]">This deal was cancelled and the buyer&apos;s payment was released.</p>;
  } else {
    body = <p className="text-[#5F6B73]">Waiting for {deal.buyerName}&apos;s payment. The QR code appears here once the money is held.</p>;
  }

  return (
    <div className={`${serif.variable} ${sans.variable} min-h-dvh bg-[#F6F0E6] font-[family-name:var(--font-ui),system-ui,sans-serif] text-[#1E2B36]`}>
      <Refresh />
      <div className="mx-auto flex max-w-[430px] flex-col gap-5 px-5 py-6">
        <div className="flex items-center gap-3">
          <h1 className={`${SERIF} text-[32px] font-medium tracking-[0.05em]`}>Selly</h1>
          <span className="h-px w-7 bg-[#3B6A8C]" />
          <span className="ml-auto text-[11px] uppercase tracking-[0.22em] text-[#5F6B73]">Handoff</span>
        </div>
        {listing && <div className={`${SERIF} text-[28px] font-medium leading-tight`}>{listing.item.name}</div>}
        {body}
      </div>
    </div>
  );
}
