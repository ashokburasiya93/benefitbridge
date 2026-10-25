import { schemes } from "@/lib/data";
export default function Schemes() {
  return (
    <>
      <h1>Rulebook</h1>
      <p className="sub">The 12 schemes the agent checks. Every decision on a case cites one of these clauses. The AI reads sources and writes messages; it never decides eligibility.</p>
      <div className="grid g2">{schemes.map((s) => (
        <div className="panel" key={s.id}>
          <h3>{s.name} <span className="pill p-none">{s.id}</span> {s.discretionary && <span className="pill p-info">caseworker decides</span>}</h3>
          <p className="small">{s.summary}</p>
          {Object.entries(s.clauses).map(([k, v]) => <div className="clause" key={k}><b>{k}</b> {v}</div>)}
          {s.documents.length > 0 && <p className="small muted">Documents: {s.documents.join("; ")}</p>}
        </div>
      ))}</div>
    </>
  );
}
