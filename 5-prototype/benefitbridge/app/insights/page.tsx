import { citizens, history, schemes } from "@/lib/data";
import { actionable, evaluate, fmt } from "@/lib/rules";

export default function Insights() {
  const within30 = history.filter((h) => h.days_to_first_claim !== null && h.days_to_first_claim <= 30).length;
  const claimed = history.filter((h) => h.days_to_first_claim !== null).map((h) => h.days_to_first_claim!).sort((a, b) => a - b);
  const median = claimed[Math.floor(claimed.length / 2)];
  const never = history.filter((h) => h.days_to_first_claim === null).length;
  const entitled = history.reduce((s, h) => s + h.schemes_entitled, 0);
  const got = history.reduce((s, h) => s + h.schemes_claimed, 0);
  const ns = Math.round((100 * within30) / history.length);

  const gap = citizens.flatMap((c) => actionable(evaluate(c)).filter((e) => e.status === "ELIGIBLE").map((e) => ({ c: c.id, e })));
  const bySch = schemes.map((s) => ({ s, n: gap.filter((g) => g.e.scheme === s.id).length, v: gap.filter((g) => g.e.scheme === s.id).reduce((t, g) => t + g.e.annualValue, 0) }))
    .filter((x) => x.n).sort((a, b) => b.v - a.v);
  const maxV = Math.max(...bySch.map((x) => x.v));
  const households = new Set(gap.map((g) => g.c)).size;
  const missingIncome = citizens.filter((c) => c.household_income_annual === null).length;
  const dupes = citizens.filter((c, i) => citizens.findIndex((d) => d.full_name === c.full_name && d.dob === c.dob) !== i).length;

  return (
    <>
      <h1>Take-up gap and North Star</h1>
      <p className="sub">Baseline from {history.length} life events in the last year (synthetic history), and the rules run over every household record today.</p>
      <div className="grid g4">
        <div className="panel"><div className="stat">{ns}%</div><div className="stat-label"><b>North Star today:</b> eligible households enrolled within 30 days of a life event. Target 60% at full rollout.</div></div>
        <div className="panel"><div className="stat">{median} days</div><div className="stat-label">median wait before a first claim, for those who claimed at all</div></div>
        <div className="panel"><div className="stat">{Math.round((100 * never) / history.length)}%</div><div className="stat-label">never claimed anything within a year</div></div>
        <div className="panel"><div className="stat">{Math.round((100 * got) / entitled)}%</div><div className="stat-label">of the schemes people were entitled to were ever claimed</div></div>
      </div>
      <div className="panel">
        <h2>Unclaimed support across the caseload today: {fmt(gap.reduce((s, g) => s + g.e.annualValue, 0))} a year, {households} of {citizens.length} households</h2>
        <table>
          <thead><tr><th>Scheme</th><th>Households</th><th style={{ width: "45%" }}>Annual value not claimed</th></tr></thead>
          <tbody>{bySch.map((x) => (
            <tr key={x.s.id}><td>{x.s.name}</td><td>{x.n}</td><td><div className="row"><div className="bar" style={{ flex: 1 }}><span style={{ width: `${(100 * x.v) / maxV}%` }} /></div><span className="small">{fmt(x.v)}</span></div></td></tr>
          ))}</tbody>
        </table>
        <p className="small muted">Eligible under the rules on the record as held, not counting schemes that need more information or a caseworker decision.</p>
      </div>
      <div className="grid g2">
        <div className="panel">
          <h2>Supporting metrics</h2>
          <table><tbody>
            <tr><td>Caseworker minutes per life-event review</td><td>45 today → 10 target</td></tr>
            <tr><td>Suggestions caseworkers approve</td><td>Target 85%+ (trust)</td></tr>
            <tr><td>Wrongly suggested entitlements</td><td>Target under 5% (precision 95%+)</td></tr>
            <tr><td>Outreach messages with an unsupported amount sent</td><td>0, always (guardrail)</td></tr>
            <tr><td>Messages to people who opted out</td><td>0, always (guardrail)</td></tr>
          </tbody></table>
        </div>
        <div className="panel">
          <h2>Data quality the agent works around</h2>
          <ul className="small">
            <li>{missingIncome} of {citizens.length} records have no household income, so means-tested schemes become &quot;needs info&quot; with a question, never a guess.</li>
            <li>{dupes} duplicate record (same name and date of birth) is flagged on the case screen.</li>
            <li>Two citizen messages arrive in Spanish. Offline mode misses their facts; Live AI mode reads them.</li>
            <li>Many records were last updated over a year ago. A newer source wins, and the conflict is shown.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
