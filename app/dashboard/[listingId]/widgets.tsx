"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatPounds, LINE, SERIF } from "@/app/seller/cards";
import { splitProceeds } from "@/lib/pricing/payout";
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

// ---------- Savings goal (simulated pots) ----------

export interface CompletedSale {
  dealId: string;
  listingId: string;
  itemName: string;
  price: number;
  net: number;
}

type Goal = { goal: number; savePct: number };
const DEFAULT_GOAL: Goal = { goal: 50000, savePct: 70 };
const goalKey = (seller: string) => `selly-savings-goal-${seller}`;

function readGoal(seller: string): Goal {
  try {
    const g = JSON.parse(localStorage.getItem(goalKey(seller)) ?? "null");
    if (g && Number.isInteger(g.goal) && g.goal > 0 && g.savePct >= 0 && g.savePct <= 100) return g;
  } catch {}
  return DEFAULT_GOAL;
}

export function SavingsGoal({ sellerName, sales }: { sellerName: string; sales: CompletedSale[] }) {
  const [goal, setGoal] = useState<Goal>(DEFAULT_GOAL);
  const [editing, setEditing] = useState(false);
  const [goalText, setGoalText] = useState("500");
  const [pct, setPct] = useState(70);

  useEffect(() => {
    const g = readGoal(sellerName);
    setGoal(g);
    setGoalText(String(g.goal / 100));
    setPct(g.savePct);
  }, [sellerName]);

  const total = sales.reduce((s, x) => s + x.net, 0);
  const { save, spend } = splitProceeds(total, goal.savePct);
  const progress = Math.min(100, (save / goal.goal) * 100);
  const goalPence = /^\d{1,6}$/.test(goalText.trim()) ? Number(goalText.trim()) * 100 : 0;

  function saveGoal(e: React.FormEvent) {
    e.preventDefault();
    if (goalPence <= 0) return;
    const g = { goal: goalPence, savePct: pct };
    setGoal(g);
    try {
      localStorage.setItem(goalKey(sellerName), JSON.stringify(g));
    } catch {}
    setEditing(false);
  }

  return (
    <section>
      <SectionTitle
        right={
          <span className="rounded-full border border-[rgba(30,43,54,0.22)] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[#5F6B73]">Simulated</span>
        }
      >
        Savings goal
      </SectionTitle>
      <div className={CARD}>
        {editing ? (
          <form onSubmit={saveGoal} className="flex flex-col gap-4 text-sm">
            <label>
              <span className="text-[#5F6B73]">Emergency fund goal</span>
              <div className="relative mt-1">
                <span className={`${SERIF} absolute left-2.5 top-1/2 -translate-y-1/2 text-[22px]`}>£</span>
                <input
                  value={goalText}
                  onChange={(e) => setGoalText(e.target.value)}
                  inputMode="numeric"
                  className={`${SERIF} h-11 w-full rounded-xl border border-[rgba(30,43,54,0.22)] bg-white/60 pl-7 pr-2 text-[22px] outline-none focus:border-[#3B6A8C]`}
                />
              </div>
            </label>
            <label>
              <div className="flex justify-between text-[#5F6B73]">
                <span>Save {pct}%</span>
                <span>Spend {100 - pct}%</span>
              </div>
              <input type="range" min={0} max={100} step={5} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="mt-2 w-full accent-[#3B6A8C]" />
            </label>
            <button type="submit" disabled={goalPence <= 0} className="h-11 rounded-3xl bg-[#BAD8EC] text-sm font-medium text-[#14212B] disabled:opacity-50">
              Save goal
            </button>
          </form>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <div className={`${SERIF} text-[28px] font-medium leading-none`}>{formatPounds(save)}</div>
                <div className="mt-1 text-sm text-[#5F6B73]">saved of {formatPounds(goal.goal)} emergency fund</div>
              </div>
              <button type="button" onClick={() => setEditing(true)} className="text-xs text-[#3B6A8C] underline underline-offset-2">
                Edit goal
              </button>
            </div>
            <div className="mt-3 h-2 rounded-full bg-[rgba(30,43,54,0.1)]" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-2 rounded-full bg-[#3B6A8C] transition-[width] duration-700" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-1 text-right text-xs text-[#5F6B73]">{Math.round(progress)}%</div>

            {sales.length === 0 ? (
              <p className="mt-2 text-sm text-[#5F6B73]">
                When a sale completes, {goal.savePct}% of what you take home goes to savings and {100 - goal.savePct}% to spending.
              </p>
            ) : (
              <div className="mt-2 flex flex-col text-sm">
                <div className={`flex justify-between border-t ${LINE} py-2.5`}>
                  <span className="text-[#5F6B73]">Savings pot ({goal.savePct}%)</span>
                  <span className="font-medium">{formatPounds(save)}</span>
                </div>
                <div className={`flex justify-between border-t ${LINE} py-2.5`}>
                  <span className="text-[#5F6B73]">Spending pot ({100 - goal.savePct}%)</span>
                  <span className="font-medium">{formatPounds(spend)}</span>
                </div>
                <div className={`border-t ${LINE} pt-2.5 text-xs text-[#5F6B73]`}>
                  From {sales.length} completed sale{sales.length === 1 ? "" : "s"}: {sales.map((s) => `${s.itemName} ${formatPounds(s.net)} after fees`).join(", ")}.
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-[#5F6B73]">Simulated pots only. No real money moves.</p>
    </section>
  );
}
