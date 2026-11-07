"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LINE } from "@/app/seller/cards";
import { buildFeed, newNotifications, type FeedItem } from "../feed";
import type { TimelineEvent } from "@/lib/types";

const CARD = `rounded-[20px] border ${LINE} bg-[#FBF8F2] p-5 shadow-[0_24px_48px_rgba(59,106,140,0.12)]`;

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <div className="text-[11px] uppercase tracking-[0.22em] text-[#5F6B73]">{children}</div>
      {right}
    </div>
  );
}

const ICON: Partial<Record<FeedItem["type"], string>> = {
  offer_received: "£",
  lowball_declined: "↓",
  scam_flagged: "!",
  injection_attempt: "!",
  deal_proposed: "?",
  payment_held: "✓",
  pickup_scheduled: "⌂",
  shipment_created: "▣",
  tracking_update: "»",
  handed_over: "→",
  sold: "★",
};
const WARN = new Set<FeedItem["type"]>(["scam_flagged", "injection_attempt"]);

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// ---------- Notification feed + alerts ----------

type Toast = { id: string; title: string; message: string };

function canNotify(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function NotificationFeed({ events }: { events: TimelineEvent[] }) {
  const feed = useMemo(() => buildFeed(events), [events]);
  const seen = useRef<Set<string> | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => setPermission(canNotify() ? Notification.permission : "unsupported"), []);

  // Push only items that arrive after the page loaded. If alerts are allowed and the tab is in the
  // background, use a browser notification; otherwise (or if that fails) show a toast.
  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(feed.map((f) => f.id)); // history on first load is not pushed
      return;
    }
    const fresh = newNotifications(feed, seen.current);
    feed.forEach((f) => seen.current!.add(f.id));
    for (const f of fresh) {
      if (canNotify() && Notification.permission === "granted" && document.hidden) {
        try {
          new Notification(`Selly · ${f.title}`, { body: f.message, tag: f.id });
          continue;
        } catch {
          // fall through to a toast (some mobile browsers only allow service-worker notifications)
        }
      }
      setToasts((t) => [...t, { id: f.id, title: f.title, message: f.message }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== f.id)), 6000);
    }
  }, [feed]);

  async function enableAlerts() {
    if (!canNotify()) return;
    setPermission(await Notification.requestPermission());
  }

  const visible = showAll ? feed : feed.slice(0, 5);

  return (
    <section>
      <SectionTitle
        right={
          permission === "default" ? (
            <button type="button" onClick={enableAlerts} className="text-xs text-[#3B6A8C] underline underline-offset-2">
              Turn on alerts
            </button>
          ) : permission === "granted" ? (
            <span className="text-xs text-[#5F6B73]">Alerts on</span>
          ) : null
        }
      >
        Notifications
      </SectionTitle>
      {feed.length === 0 ? (
        <p className="text-sm text-[#5F6B73]">Nothing yet. Offers, scam attempts and sales will show up here.</p>
      ) : (
        <div className={`${CARD} py-2`}>
          {visible.map((f, i) => (
            <div key={f.id} className={`flex items-start gap-3 ${i ? `border-t ${LINE}` : ""} py-3`}>
              <span
                aria-hidden
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  WARN.has(f.type) ? "bg-[#F3D9D3] text-[#9B3B2E]" : "bg-[#BAD8EC] text-[#14212B]"
                }`}
              >
                {ICON[f.type]}
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{f.title}</span>
                  <span className="shrink-0 text-xs text-[#5F6B73]">{time(f.createdAt)}</span>
                </div>
                <div className="text-[#5F6B73]">{f.message}</div>
              </div>
            </div>
          ))}
          {feed.length > 5 && (
            <button type="button" onClick={() => setShowAll((s) => !s)} className={`w-full border-t ${LINE} pt-2 text-center text-xs text-[#3B6A8C]`}>
              {showAll ? "Show less" : `Show all ${feed.length}`}
            </button>
          )}
        </div>
      )}

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 mx-auto flex max-w-[430px] flex-col gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} role="status" className="pointer-events-auto rounded-2xl bg-[#1E2B36] px-4 py-3 text-sm text-white shadow-lg">
            <div className="font-medium">{t.title}</div>
            <div className="text-white/80">{t.message}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
