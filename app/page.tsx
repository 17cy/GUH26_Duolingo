import { redirect } from "next/navigation";

// The app starts at the seller chat.
export default function Home() {
  redirect("/seller");
}
