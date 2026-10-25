"use client";
import { useEffect, useState } from "react";

type Entry = { at: string; caseworker: string; action: string; event: string; citizen: string; schemes?: string[]; draftEdited?: boolean; reason?: string; mode: string };

export default function AuditLog() {
  const [rows, setRows] = useState<Entry[] | null>(null);
  useEffect(() => { try { setRows(JSON.parse(localStorage.getItem("bb_audit") || "[]")); } catch { setRows([]); } }, []);
  if (rows === null) return null;
  if (!rows.length) return <div className="panel muted">No decisions yet. Open a case and approve or reject it.</div>;
  const download = () => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "benefitbridge-audit.json"; a.click();
  };
  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: "flex-end", marginBottom: 8 }}><button onClick={download}>Export log (JSON)</button>
        <button className="danger" onClick={() => { localStorage.removeItem("bb_audit"); setRows([]); }}>Clear</button></div>
      <table>
        <thead><tr><th>When (UTC)</th><th>Who</th><th>Decision</th><th>Case</th><th>Detail</th></tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i}><td className="small">{r.at.slice(0, 19).replace("T", " ")}</td><td>{r.caseworker}</td>
            <td><span className={`pill ${r.action === "approved" ? "p-ok" : "p-bad"}`}>{r.action}</span></td>
            <td><a href={`/case/${r.event}`}>{r.event}</a> · {r.citizen}</td>
            <td className="small">{r.action === "approved" ? `${(r.schemes || []).join(", ") || "message only"}${r.draftEdited ? " · message edited" : ""}` : r.reason} · {r.mode}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}
