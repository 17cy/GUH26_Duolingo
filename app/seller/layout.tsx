import localFont from "next/font/local";

// Self-hosted from the Selly design (SIL OFL, see fonts/OFL.txt).
const serif = localFont({ src: "./fonts/cormorant-garamond-latin.woff2", weight: "400 600", variable: "--font-serif" });
const sans = localFont({ src: "./fonts/inter-tight-latin.woff2", weight: "400 500", variable: "--font-ui" });

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${serif.variable} ${sans.variable}`}>{children}</div>;
}
