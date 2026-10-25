import Link from "next/link";
import { EVENT_LABELS, events } from "@/lib/data";
import { analyze } from "@/lib/pipeline";
import { fmt } from "@/lib/rules";

// The queue is ranked with the fast offline pass; opening a case runs the full (live) analysis.
export default async function Queue() {
  const results = await Promise.all(events.map((e) => analyze(e.id, { mode: "offline" })));
  results.sort((a, b) => b.priority.score - a.priority.score);
  const actionable = results.filter((r) => r.entitlements.length);
  const value = actionable.reduce((s, r) => s + r.entitlements.filter((e) => e.status === "ELIGIBLE").reduce((t, e) => t + e.annualValue, 0), 0);
  return (
    <>
      <h1>Today&apos;s life events</h1>
      <p className="sub">Priya Nair · Riverside & Northport caseload · {results.length} events received from registries, employers, hospitals and citizens.</p>
      <div className="grid g4">
        <div className="panel"><div className="stat">{actionable.length}</div><div className="stat-label">households with support they are not claiming</div></div>
        <div className="panel"><div className="stat">{fmt(value)}</div><div className="stat-label">a year in likely entitlements found today</div></div>
        <div className="panel"><div className="stat">{results.filter((r) => r.priority.label === "Urgent" || r.priority.label === "Read now").length}</div><div className="stat-label">urgent or unreadable: a person reads these first</div></div>
        <div className="panel"><div className="stat">{results.filter((r) => r.entitlements.some((e) => e.status === "ROUTE_TO_HUMAN")).length}</div><div className="stat-label">need a caseworker decision</div></div>
      </div>
      <div className="panel">
        <table>
          <thead><tr><th>Priority</th><th>Event</th><th>Household</th><th>Source</th><th>Likely new support</th><th>Value / yr</th></tr></thead>
          <tbody>
            {results.map((r) => {
              const elig = r.entitlements.filter((e) => e.status === "ELIGIBLE");
              const v = elig.reduce((s, e) => s + e.annualValue, 0);
              return (
                <tr key={r.event.id} className="click">
                  <td><span className={`pill p-${r.priority.label.replace(/ /g, "-")}`}>{r.priority.label}</span></td>
                  <td><Link href={`/case/${r.event.id}`}>{EVENT_LABELS[r.event.type]}</Link><div className="small muted">{r.event.id} · {r.event.received}</div></td>
                  <td>{r.household.full_name}<div className="small muted">{r.household.id} · {r.household.preferred_language}{!r.household.consent_proactive_contact ? " · opted out of contact" : ""}</div></td>
                  <td className="small">{r.event.source}</td>
                  <td className="small">
                    {r.unreadable && <span className="pill p-bad" style={{ marginRight: 4 }}>Couldn&apos;t read: needs a person</span>}
                    {r.entitlements.length === 0 ? (r.unreadable ? null : <span className="muted">Nothing new. No outreach needed.</span>) :
                      r.entitlements.map((e) => <span key={e.scheme} className={`pill p-${e.status}`} style={{ marginRight: 4 }} title={e.name}>{e.scheme}</span>)}
                  </td>
                  <td>{v ? fmt(v) : "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="small muted">Green: eligible under the rules. Amber: likely, needs one fact from the citizen. Blue: a caseworker must decide (medical assessment or hardship grant).</p>
      </div>
    </>
  );
}
