// Shared data model. Source: SPEC.md "Data model". All money in integer pence.

export type Condition = "new" | "like_new" | "good" | "fair" | "poor";
export type Style = "firm" | "flexible" | "quick";
export type Platform = "ebay" | "vinted" | "donedeal";
export type Category = "headphones" | "electronics" | "clothing_winter" | "bikes" | "furniture" | "textbooks" | "other";

export interface Item {
  name: string;            // "Sony WH-1000XM4"
  brand?: string;
  model?: string;
  category: Category;
  condition: Condition;
  defects: string[];
  confidence: number;      // 0..1
}

export type ListingStatus = "draft" | "priced" | "posted" | "sold" | "withdrawn";

export interface Listing {
  id: string;
  sellerName: string;
  item: Item;
  imageUrl: string;
  description: string;
  wantedPrice?: number;
  listPrice?: number;
  floorPrice?: number;     // SECRET: never sent to buyer side or negotiation model
  style: Style;
  status: ListingStatus;
  platforms: Platform[];
  createdAt: string;
}

export type DealStatus =
  | "awaiting_seller_approval" | "approved" | "rejected"
  | "awaiting_payment" | "payment_held" | "in_delivery"
  | "completed" | "cancelled";

export interface Deal {
  id: string;
  listingId: string;
  bundleListingIds?: string[];
  buyerName: string;
  price: number;
  status: DealStatus;
  stripeSessionId?: string;
  paymentIntentId?: string;
  handoffToken?: string;
  handoffMethod?: "pickup" | "locker";
  pickupSlot?: string;
  tracking?: { number: string; events: { status: TrackingStatus; at: string }[] };
  createdAt: string;
}

export type TrackingStatus = "label_created" | "collected" | "in_transit" | "delivered";

export interface Message {
  id: string;
  listingId: string;
  buyerName: string;
  from: "buyer" | "agent" | "system";
  text: string;
  flags?: string[];
  createdAt: string;
}

export type EventType =
  | "listing_created" | "item_identified" | "priced" | "posted"
  | "buyer_message" | "offer_received" | "lowball_declined" | "counter_sent"
  | "scam_flagged" | "injection_attempt"
  | "deal_proposed" | "deal_approved" | "deal_rejected"
  | "payment_link_sent" | "payment_held" | "payment_cancelled"
  | "pickup_scheduled" | "shipment_created" | "tracking_update"
  | "handed_over" | "payment_captured" | "payout_sent"
  | "delisted" | "sold";

export interface TimelineEvent {
  id: string;
  listingId: string;
  type: EventType;
  message: string;
  data?: Record<string, unknown>;
  createdAt: string;
}
