import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type Results = { metrics: Record<string, unknown> & { mode: string; run_at: string; take_up_gap: { households: number; of: number; annual_value: number } };
  thresholds: { name: string; value: unknown; pass: boolean; target: string }[]; rows: { event: string; type: string; ok: boolean; missedFacts: string[] }[];
  redTeam: { draft: string; blocked: boolean }[] };

function load(file: string): Results | null {
  const p = path.join(process.cwd(), "data", file);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}

export default function Evals() {
  const runs = [load("eval_results.json"), load("eval_results_live.json"), load("eval_results_groq.json")].filter(Boolean) as Results[];
  if (!runs.length) return <p>No eval results yet. Run <code>npm run eval</code>.</p>;
  return (
    <>
      <h1>Quality checks before launch</h1>
      <p className="sub">The PRD&apos;s launch evals, run on all 40 life events against labels from an independent implementation of the rules. The build fails if any check fails.</p>
      {runs.map((r) => (
        <div className="panel" key={`${r.metrics.mode}-${r.metrics.provider ?? ""}`}>
          <h2>{r.metrics.mode !== "live" ? "Offline mode" : r.metrics.provider === "groq" ? `Live AI mode: Groq ${r.metrics.model}, Claude backup used ${r.metrics.claude_backup_used ?? 0} times` : `Live AI mode (${r.metrics.model})`} <span className="small muted">run {r.metrics.run_at.slice(0, 16).replace("T", " ")} UTC</span></h2>
          <table>
            <thead><tr><th>Check</th><th>Result</th><th>Target</th><th></th></tr></thead>
            <tbody>{r.thresholds.map((t) => (
              <tr key={t.name}><td>{t.name}</td><td><b>{String(t.value)}{typeof t.value === "number" && t.name.match(/precision|recall/i) ? "%" : ""}</b></td><td className="small">{t.target}</td>
                <td><span className={`pill ${t.pass ? "p-ok" : "p-bad"}`}>{t.pass ? "PASS" : "FAIL"}</span></td></tr>
            ))}</tbody>
          </table>
          <p className="small">Cases exactly right (eligible, needs-info and caseworker sets all match): <b>{String(r.metrics.cases_exactly_right)}%</b>.
            {" "}{r.rows.filter((x) => !x.ok).map((x) => `${x.event} missed ${x.missedFacts.join(", ")}`).join("; ")}</p>
          <h3>Unsafe drafts the safety check must block</h3>
          <ul className="small">{r.redTeam.map((t) => <li key={t.draft}>{t.blocked ? "⛔ Blocked" : "❌ Let through"}: “{t.draft}”</li>)}</ul>
        </div>
      ))}
    </>
  );
}
