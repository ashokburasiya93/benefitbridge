// One life event in, one reviewable case out:
// extract facts -> update the household copy -> rules decide -> draft -> safety checks.
import { citizens, citizenById, eventById } from "./data";
import { makeDraft } from "./draft";
import { extractFacts } from "./extract";
import { actionable, evaluate } from "./rules";
import type { AnalysisResult, Fact, Household } from "./types";

export { BACKUP_MODEL, DEFAULT_MODEL, PROVIDER } from "./models";
export const liveAvailable = () => !!(process.env.ANTHROPIC_API_KEY || process.env.GROQ_API_KEY);

const QUESTION: Record<string, string> = {
  "household income": "Roughly how much money does your household receive in a year now, from all sources?",
  savings: "About how much do you have in savings?",
  "monthly childcare fees": "How much do you pay for childcare each month?",
};

function applyFacts(h: Household, facts: Fact[]): { updated: Household; facts: Fact[] } {
  const u: Household = JSON.parse(JSON.stringify(h));
  const out = facts.map((f) => ({ ...f }));
  for (const f of out) {
    const before = (k: keyof Household) => {
      const prev = u[k];
      if (prev !== null && prev !== undefined && prev !== f.value && prev !== 0 && prev !== false) f.conflictsWithRecord = String(prev);
    };
    switch (f.field) {
      case "employment_status": before("employment_status"); u.employment_status = f.value as Household["employment_status"]; break;
      case "job_end_date": u.job_end_date = String(f.value); break;
      case "household_income_annual": before("household_income_annual"); u.household_income_annual = Number(f.value); break;
      case "savings": before("savings"); u.savings = Number(f.value); break;
      case "tenure": u.tenure = f.value as Household["tenure"]; break;
      case "rent_monthly": before("rent_monthly"); u.rent_monthly = Number(f.value); break;
      case "childcare_fees_monthly": u.childcare_fees_monthly = Number(f.value); break;
      case "disability_unable_to_work": u.disability_unable_to_work = f.value === true; if (f.value === true && u.employment_status === "employed") u.employment_status = "unemployed"; break;
      case "care_hours_weekly": u.care_hours_weekly = Number(f.value); break;
      case "partner_care_hours_weekly": u.partner_care_hours_weekly = Number(f.value); break;
      case "partner_status":
        if (u.partner) u.partner = { ...u.partner, status: f.value as "widowed" | "separated" | "partnered" };
        break;
      case "partner_death_date":
        if (u.partner) u.partner = { ...u.partner, status: "widowed", death_date: String(f.value) };
        break;
      case "new_child_dob":
        if (!u.children.some((c) => c.dob === f.value)) u.children.push({ name: "New baby", dob: String(f.value) });
        break;
    }
  }
  return { updated: u, facts: out };
}

function findDuplicates(h: Household) {
  return citizens.filter((c) => c.id !== h.id && c.full_name === h.full_name && c.dob === h.dob).map((c) => c.id);
}

export async function analyze(eventId: string, opts: { mode?: "live" | "offline" } = {}): Promise<AnalysisResult> {
  const ev = eventById(eventId);
  if (!ev) throw new Error("unknown event");
  const h = citizenById(ev.citizen_id)!;
  const mode = opts.mode ?? (liveAvailable() ? "live" : "offline");

  const ex = await extractFacts(ev, mode);
  const { updated, facts } = applyFacts(h, ex.facts);
  const hardship = facts.some((f) => f.field === "hardship_flag" && f.value === true);
  const entitlements = actionable(evaluate(updated, { hardship }));
  const questions = [...new Set(entitlements.flatMap((e) => e.missing))].map((m) => QUESTION[m] ?? `Please tell us your ${m}.`);
  const routed = entitlements.filter((e) => e.status === "ROUTE_TO_HUMAN");
  const routeReason = routed.length
    ? routed.map((e) => (e.scheme === "DSP" ? "Disability Support Payment needs a medical assessment booked by a caseworker."
      : "The source describes a crisis. A caseworker should consider an Emergency Hardship Grant today.")).join(" ")
    : null;

  const d = await makeDraft(updated, entitlements, questions, mode);
  const usage = { input_tokens: 0, output_tokens: 0 };
  const served = [...new Set([ex.model, d.model].filter(Boolean))].join(" + ");
  const fellBack = !!(ex.fellBack || d.fellBack);
  for (const u of [ex.usage, d.usage]) if (u) { usage.input_tokens += u.input_tokens; usage.output_tokens += u.output_tokens; }

  // Fail safe: a free-text message we could not read is never filed as "no action".
  const freeText = !Object.keys(ev.registry_facts).length && /Message|Note/.test(ev.source);
  const unreadable = freeText && !facts.some((f) => f.origin === "extracted");
  const value = entitlements.filter((e) => e.status === "ELIGIBLE").reduce((s, e) => s + e.annualValue, 0);
  const score = (hardship ? 10_000_000 : 0) + (unreadable ? 5_000_000 : 0) + (routed.length ? 1_000_000 : 0) + value;
  const label = hardship ? "Urgent" : unreadable ? "Read now" : entitlements.length === 0 ? "No action" : value >= 5000 || routed.length ? "High" : "Normal";

  return {
    event: ev, household: h, updated, facts, droppedFacts: ex.dropped, entitlements, questions,
    draft: d.draft, routeReason, duplicateOf: findDuplicates(h), mode, model: mode === "live" ? served || null : null, fellBack: mode === "live" ? fellBack : undefined,
    usage: mode === "live" ? usage : undefined, unreadable, priority: { score, label },
  };
}
