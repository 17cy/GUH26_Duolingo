import localFont from "next/font/local";

// Same self-hosted Selly fonts as the seller side (SIL OFL, see app/seller/fonts/OFL.txt).
const serif = localFont({ src: "../seller/fonts/cormorant-garamond-latin.woff2", weight: "400 600", variable: "--font-serif" });
const sans = localFont({ src: "../seller/fonts/inter-tight-latin.woff2", weight: "400 500", variable: "--font-ui" });

export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${serif.variable} ${sans.variable}`}>{children}</div>;
}
