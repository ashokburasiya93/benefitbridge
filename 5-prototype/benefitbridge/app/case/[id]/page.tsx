import { notFound } from "next/navigation";
import { eventById } from "@/lib/data";
import { analyze, liveAvailable } from "@/lib/pipeline";
import CaseView from "@/components/CaseView";

export const dynamic = "force-dynamic";

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!eventById(id)) notFound();
  let fallback: string | null = null;
  let result;
  try {
    result = await analyze(id);
  } catch (e) {
    // Fail safe: if the model is unavailable, the case still opens on the rules-based path.
    fallback = liveAvailable() ? `Live AI was unavailable (${(e as Error).message}). Showing the offline analysis.` : null;
    result = await analyze(id, { mode: "offline" });
  }
  return <CaseView r={result} fallback={fallback} />;
}
