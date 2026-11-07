"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Re-renders the server page every 2s so the seller sees the scan land. */
export function Refresh() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}

export function CancelButton({ dealId }: { dealId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    if (!confirm("Cancel the handoff? The buyer's payment will be released back to them.")) return;
    setBusy(true);
    const res = await fetch("/api/handoff/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dealId }),
    }).catch(() => null);
    if (!res?.ok) setError("Couldn't cancel. Try again.");
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button type="button" onClick={cancel} disabled={busy} className="text-sm text-[#5F6B73] underline disabled:opacity-40">
        Handoff didn&apos;t happen? Cancel and refund
      </button>
      {error && <p className="text-sm text-[#9B3B2E]">{error}</p>}
    </div>
  );
}
