import { decideDeal } from "../../decide";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return decideDeal((await params).id, "approved");
}
