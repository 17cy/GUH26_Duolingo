import seasonality from "@/data/seasonality.json";
import type { Category } from "@/lib/types";

// SPEC.md "Trend advice". Months are 1..12.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const CATEGORY_LABEL: Record<Category, string> = {
  headphones: "headphones",
  electronics: "electronics",
  clothing_winter: "winter clothing",
  bikes: "bikes",
  furniture: "furniture",
  textbooks: "textbooks",
  other: "this kind of item",
};

export interface TrendAdvice {
  advice: "sell_now" | "wait";
  waitUntil?: string; // month name, only when advice is "wait"
  message: string;
  label: "Estimate from seasonal patterns";
}

type Season = { peakMonths: number[]; lowMonths: number[]; note: string };

export function trendAdvice(category: Category, now: Date = new Date()): TrendAdvice {
  const season = (seasonality as Record<string, Season>)[category];
  const month = now.getMonth() + 1;
  const label = "Estimate from seasonal patterns" as const;

  if (season?.lowMonths.includes(month)) {
    for (let ahead = 1; ahead <= 4; ahead++) {
      const m = ((month - 1 + ahead) % 12) + 1;
      if (season.peakMonths.includes(m)) {
        const waitUntil = MONTHS[m - 1];
        return {
          advice: "wait",
          waitUntil,
          message: `Prices for ${CATEGORY_LABEL[category]} are usually higher in ${waitUntil}. Sell now, or wait?`,
          label,
        };
      }
    }
  }
  return { advice: "sell_now", message: "Now is a good time to sell.", label };
}
