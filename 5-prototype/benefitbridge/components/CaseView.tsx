"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { guard } from "@/lib/guard";
import type { AnalysisResult, Entitlement, Fact } from "@/lib/types";

const LABEL: Record<string, string> = {
  ELIGIBLE: "Eligible under the rules", NEEDS_INFO: "Likely, needs info", ROUTE_TO_HUMAN: "Caseworker decides",
};
const FIELD: Record<string, string> = {
  employment_status: "Employment", job_end_date: "Job ended", household_income_annual: "Household income / yr",
  savings: "Savings", tenure: "Housing", rent_monthly: "Rent / month", partner_status: "Partner",
  partner_death_date: "Partner died", new_child_dob: "New baby born", disability_unable_to_work: "Unable to work (6+ months)",
  care_hours_weekly: "Gives care (hrs/week)", partner_care_hours_weekly: "Partner gives care (hrs/week)",
  childcare_fees_monthly: "Childcare fees / month", hardship_flag: "Immediate crisis",
};
const money = new Set(["household_income_annual", "savings", "rent_monthly", "childcare_fees_monthly"]);
const show = (f: Fact) => (typeof f.value === "boolean" ? (f.value ? "Yes" : "No") : money.has(f.field) ? `$${Number(f.value).toLocaleString("en-US")}` : String(f.value));

function Highlighted({ text, quotes }: { text: string; quotes: string[] }) {
  const parts = useMemo(() => {
    const spans: [number, number][] = [];
    const low = text.toLowerCase();
    for (const q of quotes) {
      const i = low.indexOf(q.toLowerCase());
      if (i >= 0) spans.push([i, i + q.length]);
    }
    spans.sort((a, b) => a[0] - b[0]);
    const out: { t: string; m: boolean }[] = [];
    let pos = 0;
    for (const [s, e] of spans) {
      if (s < pos) continue;
      out.push({ t: text.slice(pos, s), m: false }, { t: text.slice(s, e), m: true });
      pos = e;
    }
    out.push({ t: text.slice(pos), m: false });
    return out;
  }, [text, quotes]);
  return <div className="source">{parts.map((p, i) => (p.m ? <mark key={i}>{p.t}</mark> : <span key={i}>{p.t}</span>))}</div>;
}

function log(entry: Record<string, unknown>) {
  try {
    const all = JSON.parse(localStorage.getItem("bb_audit") || "[]");
    all.unshift({ at: new Date().toISOString(), caseworker: "Priya Nair", ...entry });
    localStorage.setItem("bb_audit", JSON.stringify(all));
  } catch { /* storage unavailable: the prototype still works, the log just isn't kept */ }
}

export default function CaseView({ r, fallback }: { r: AnalysisResult; fallback: string | null }) {
  const h = r.updated;
  const [included, setIncluded] = useState<Record<string, boolean>>(Object.fromEntries(r.entitlements.map((e) => [e.scheme, e.status === "ELIGIBLE"])));
  const [text, setText] = useState(r.draft?.text ?? "");
  const [done, setDone] = useState<null | "approved" | "rejected">(null);
  const [reason, setReason] = useState("");
  const edited = text !== (r.draft?.text ?? "");
  const eligible = r.entitlements.filter((e) => e.status === "ELIGIBLE");
  const chosen = eligible.filter((e) => included[e.scheme]);
  // Re-run the safety checks on whatever the caseworker has typed.
  const checks = useMemo(() => (r.draft?.text ? guard(text, r.entitlements.filter((e) => e.status !== "ROUTE_TO_HUMAN"), r.entitlements.filter((e) => e.status === "ROUTE_TO_HUMAN")) : []), [text, r]);
  const withheld = checks.some((c) => !c.passed);

  const approve = () => {
    log({ action: "approved", event: r.event.id, citizen: r.household.id, schemes: chosen.map((e) => e.scheme),
      draftEdited: edited, mode: r.mode, message: text });
    setDone("approved");
  };
  const reject = () => {
    log({ action: "rejected", event: r.event.id, citizen: r.household.id, reason: reason || "No reason given", mode: r.mode });
    setDone("rejected");
  };

  return (
    <>
      <p className="small"><Link href="/">← Today&apos;s cases</Link></p>
      <h1>{r.household.full_name} <span className={`pill p-${r.priority.label.replace(/ /g, "-")}`}>{r.priority.label}</span></h1>
      <p className="sub">{r.event.id} · {r.event.source} · received {r.event.received} · {r.household.id} · {r.household.region} · prefers {r.household.preferred_language}
        {" "}· analysed in {r.mode === "live" ? `Live AI mode (${r.model}${r.fellBack ? ", Claude backup used" : ""})` : "Offline mode"}</p>

      {fallback && <div className="alert warn">{fallback}</div>}
      {r.unreadable && <div className="alert bad"><b>Read this one yourself.</b> BenefitBridge could not read any facts from this message{r.mode === "offline" ? " (Offline mode reads English patterns only; Live AI mode reads any language)" : ""}. It may describe a need the rules can&apos;t see yet.</div>}
      {r.duplicateOf.length > 0 && <div className="alert warn">Possible duplicate record: {r.duplicateOf.join(", ")} has the same name and date of birth. Check before approving.</div>}
      {r.routeReason && <div className="alert info"><b>Needs you:</b> {r.routeReason}</div>}
      {!r.household.consent_proactive_contact && <div className="alert warn">This person opted out of proactive contact. BenefitBridge will not draft a message.</div>}

      <div className="grid g2">
        <div>
          <div className="panel">
            <h2>What came in</h2>
            <Highlighted text={r.event.text} quotes={r.facts.filter((f) => f.origin === "extracted").map((f) => f.quote)} />
            <p className="small muted">Highlighted words are the exact evidence for each fact below.</p>
          </div>
          <div className="panel">
            <h2>Facts found ({r.facts.length})</h2>
            {r.facts.length === 0 && <p className="muted small">No new facts in this source. Decisions use the agency record as held.</p>}
            {r.facts.map((f) => (
              <div className="fact" key={f.field}>
                <div>
                  <b>{FIELD[f.field] ?? f.field}</b>: {show(f)}
                  <div className="small muted">{f.origin === "registry" ? "Registry field (trusted)" : <>“{f.quote}”</>}</div>
                  {f.conflictsWithRecord && <div className="small" style={{ color: "var(--warn)" }}>Record said {money.has(f.field) ? `$${Number(f.conflictsWithRecord).toLocaleString("en-US")}` : f.conflictsWithRecord}. Using the newer source; confirm with the citizen.</div>}
                </div>
                <span className={`pill ${f.confidence === "high" ? "p-ok" : f.confidence === "medium" ? "p-warn" : "p-bad"}`}>{f.confidence}</span>
              </div>
            ))}
            {r.droppedFacts.length > 0 && <p className="small" style={{ color: "var(--bad)" }}>Dropped {r.droppedFacts.length} fact(s) whose quote was not in the source: {r.droppedFacts.map((d) => d.field).join(", ")}.</p>}
          </div>
          <div className="panel small">
            <h2>Household record</h2>
            <div>Born {h.dob} · {h.partner ? `Partner: ${h.partner.name} (${h.partner.status})` : "No partner on record"}</div>
            <div>Children: {h.children.length ? h.children.map((c) => `${c.name} (${c.dob})`).join(", ") : "none"}</div>
            <div>Income: {h.household_income_annual === null ? <b style={{ color: "var(--warn)" }}>not on record</b> : `$${h.household_income_annual.toLocaleString("en-US")} a year`} · Savings: {h.savings === null ? "not on record" : `$${h.savings.toLocaleString("en-US")}`}</div>
            <div>Housing: {h.tenure}{h.rent_monthly ? `, $${h.rent_monthly.toLocaleString("en-US")} a month` : ""} · Employment: {h.employment_status}</div>
            <div>Already receiving: {r.household.enrolled.length ? r.household.enrolled.join(", ") : "nothing"} · Record last updated {r.household.record_updated}</div>
          </div>
        </div>

        <div>
          <div className="panel">
            <h2>Support they are not claiming ({r.entitlements.length})</h2>
            {r.entitlements.length === 0 && !r.unreadable && <div className="alert ok">Nothing new. They already receive everything this change makes them eligible for. No outreach needed.</div>}
            {r.entitlements.map((e: Entitlement) => (
              <div key={e.scheme} style={{ borderBottom: "1px solid var(--line)", padding: "8px 0" }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <label className="row">
                    {e.status === "ELIGIBLE" && <input type="checkbox" checked={!!included[e.scheme]} disabled={!!done}
                      onChange={(ev) => setIncluded({ ...included, [e.scheme]: ev.target.checked })} />}
                    <b>{e.name}</b>
                  </label>
                  <span className={`pill p-${e.status}`}>{LABEL[e.status]}</span>
                </div>
                <div className="small">{e.amountText}</div>
                {e.reasons.map((c) => (
                  <div className="clause" key={c.clause}>{c.met === true ? "✓" : c.met === null ? "?" : "✗"} <b>{c.clause}</b> {c.text}</div>
                ))}
                {e.missing.length > 0 && <div className="small" style={{ color: "var(--warn)" }}>Missing: {e.missing.join(", ")}</div>}
              </div>
            ))}
            {r.questions.length > 0 && <><h3 style={{ marginTop: 12 }}>Ask the citizen</h3><ul className="small">{r.questions.map((q) => <li key={q}>{q}</li>)}</ul></>}
          </div>

          {r.draft && (
            <div className="panel">
              <h2>Outreach message {r.draft.text && <span className="small muted">({r.draft.language})</span>}</h2>
              {r.draft.note && <div className="alert info">{r.draft.note}</div>}
              {r.draft.text && (
                <>
                  {withheld && <div className="alert bad"><b>Withheld by the safety check.</b> Fix the problems below before this can be approved.</div>}
                  {checks.map((c) => <div className="check" key={c.name}>{c.passed ? "✅" : "⛔"} <span><b>{c.name}</b>: {c.detail}</span></div>)}
                  <textarea value={text} onChange={(e) => setText(e.target.value)} disabled={!!done} style={{ marginTop: 8 }} />
                </>
              )}
            </div>
          )}

          {chosen.length > 0 && (
            <div className="panel form-preview">
              <h2>Pre-filled applications ({chosen.length})</h2>
              {chosen.map((e) => (
                <details key={e.scheme} style={{ marginBottom: 8 }}>
                  <summary><b>{e.name}</b> application, ready for the citizen to confirm</summary>
                  <dl style={{ marginTop: 8 }}>
                    <dt>Applicant</dt><dd>{h.full_name} ({h.id})</dd>
                    <dt>Date of birth</dt><dd>{h.dob}</dd>
                    <dt>Contact</dt><dd>{h.contact.phone} · {h.contact.email}</dd>
                    <dt>Region</dt><dd>{h.region}</dd>
                    <dt>Basis</dt><dd>{e.reasons.filter((c) => c.met).map((c) => c.clause).join(", ")}</dd>
                    <dt>Estimated amount</dt><dd>{e.amountText}</dd>
                    <dt>Trigger</dt><dd>{r.event.source}, {r.event.received}</dd>
                    <dt>Documents still needed</dt><dd>{e.documents.length ? e.documents.join("; ") : "None"}</dd>
                  </dl>
                </details>
              ))}
            </div>
          )}

          <div className="panel">
            <h2>Your decision</h2>
            {done === "approved" && <div className="alert ok">Approved and logged. In production this queues the message and opens the applications. The prototype sends nothing. <Link href="/audit">See the log</Link>.</div>}
            {done === "rejected" && <div className="alert warn">Rejected and logged with your reason. <Link href="/audit">See the log</Link>.</div>}
            {!done && (
              <>
                <div className="row">
                  <button className="primary" onClick={approve} disabled={withheld || (!r.draft?.text && chosen.length === 0)}>
                    Approve{edited ? " edited" : ""} message and applications
                  </button>
                  <input placeholder="Reason, if rejecting" value={reason} onChange={(e) => setReason(e.target.value)} style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid var(--line)" }} />
                  <button className="danger" onClick={reject}>Reject</button>
                </div>
                <p className="small muted">Nothing is decided or sent without your approval. Every approval and rejection is logged with who and when.</p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
