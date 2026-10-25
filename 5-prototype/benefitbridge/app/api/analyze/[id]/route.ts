import { NextResponse } from "next/server";
import { eventById } from "@/lib/data";
import { analyze } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!eventById(id)) return NextResponse.json({ error: "unknown event" }, { status: 404 });
  const mode = new URL(req.url).searchParams.get("mode") === "offline" ? "offline" : undefined;
  try {
    return NextResponse.json(await analyze(id, { mode }));
  } catch {
    return NextResponse.json(await analyze(id, { mode: "offline" }));
  }
}
