// Deterministic eligibility engine. The AI never decides eligibility: it only
// supplies facts (with quotes). Every decision here cites the clause it rests on.
import { TODAY, schemes } from "./data";
import type { Entitlement, Household, Scheme, SchemeId, Status } from "./types";

const DAY = 86_400_000;
export const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export function ageOn(dob: string, on: Date = TODAY): number {
  const d = new Date(dob + "T00:00:00Z");
  let a = on.getUTCFullYear() - d.getUTCFullYear();
  if (on.getUTCMonth() < d.getUTCMonth() || (on.getUTCMonth() === d.getUTCMonth() && on.getUTCDate() < d.getUTCDate())) a--;
  return a;
}
const daysSince = (iso: string) => Math.floor((TODAY.getTime() - new Date(iso + "T00:00:00Z").getTime()) / DAY);

type R = { clause: string; met: boolean | null };

function decide(scheme: Scheme, h: Household, reasons: R[], missing: string[], amountText: string,
  amounts: number[], annualValue: number): Entitlement {
  let status: Status;
  if (reasons.some((r) => r.met === false)) status = "NOT_ELIGIBLE";
  else if (missing.length) status = "NEEDS_INFO";
  else if (scheme.discretionary) status = "ROUTE_TO_HUMAN";
  else status = "ELIGIBLE";
  return {
    scheme: scheme.id, name: scheme.name, status,
    reasons: reasons.map((r) => ({ clause: r.clause, text: scheme.clauses[r.clause], met: r.met })),
    missing, amountText, amounts, annualValue: status === "NOT_ELIGIBLE" ? 0 : annualValue,
    alreadyEnrolled: h.enrolled.includes(scheme.id), documents: scheme.documents,
  };
}

/** Evaluate every scheme for a household. `hardship` comes from the event, not the record. */
export function evaluate(h: Household, opts: { hardship?: boolean } = {}): Entitlement[] {
  const age = ageOn(h.dob);
  const kidAges = h.children.map((c) => ageOn(c.dob));
  const kidDays = h.children.map((c) => daysSince(c.dob));
  const inc = h.household_income_annual;
  const partnered = h.partner?.status === "partnered";
  const incMissing = inc === null || inc === undefined;
  const out: Entitlement[] = [];
  const S = (id: SchemeId) => schemes.find((s) => s.id === id)!;

  // CB: child under 16; not means-tested
  {
    const n = kidAges.filter((a) => a < 16).length;
    out.push(decide(S("CB"), h, [{ clause: "CB-1", met: n > 0 }, { clause: "CB-3", met: true }], [],
      `${fmt(95)} a month per child (${n} eligible: ${fmt(95 * n)} a month)`, [95, 95 * n], 95 * n * 12));
  }
  // NMG: born within 90 days; income < 45,000
  {
    const n = kidDays.filter((d) => d >= 0 && d <= 90).length;
    const r: R[] = [{ clause: "NMG-1", met: n > 0 }, { clause: "NMG-2", met: incMissing ? null : inc! < 45000 }];
    out.push(decide(S("NMG"), h, r, n > 0 && incMissing ? ["household income"] : [],
      `${fmt(600)} one-off per baby`, [600, 600 * n], 600 * n));
  }
  // JSA
  {
    const ended = h.job_end_date ? daysSince(h.job_end_date) : null;
    const r: R[] = [
      { clause: "JSA-1", met: h.employment_status === "unemployed" && age >= 18 && age <= 65 },
      { clause: "JSA-2", met: ended !== null && ended >= 0 && ended <= 365 },
      { clause: "JSA-3", met: incMissing ? null : inc! < 40000 },
      { clause: "JSA-4", met: h.savings === null ? null : h.savings < 15000 },
    ];
    const missing = [incMissing ? "household income" : "", h.savings === null ? "savings" : ""].filter(Boolean);
    out.push(decide(S("JSA"), h, r, missing, `${fmt(1150)} a month for up to 9 months`, [1150], 1150 * 9));
  }
  // HSB
  {
    const rent = h.rent_monthly ?? 0;
    const r: R[] = [
      { clause: "HSB-1", met: h.tenure === "rent" && rent > 0 },
      { clause: "HSB-2", met: incMissing ? null : inc! < 40000 },
      { clause: "HSB-3", met: incMissing ? null : rent * 12 > 0.3 * inc! },
    ];
    const pay = incMissing ? 0 : Math.min(400, Math.round(rent - (0.3 * inc!) / 12));
    out.push(decide(S("HSB"), h, r, incMissing && h.tenure === "rent" ? ["household income"] : [],
      incMissing ? "up to $400 a month" : `${fmt(pay)} a month (rent above 30% of income, capped at $400)`,
      incMissing ? [400] : [pay, 400], pay * 12));
  }
  // CAR: the citizen, or their partner, gives 20+ hours of care a week
  {
    const hours = Math.max(h.care_hours_weekly || 0, h.partner_care_hours_weekly || 0);
    const who = (h.partner_care_hours_weekly || 0) >= 20 && (h.care_hours_weekly || 0) < 20 && h.partner
      ? ` (for ${h.partner.name}, the carer)` : "";
    out.push(decide(S("CAR"), h, [{ clause: "CAR-1", met: hours >= 20 }], [], `${fmt(320)} a month${who}`, [320], 320 * 12));
  }
  // DSP: discretionary, medical assessment
  out.push(decide(S("DSP"), h, [{ clause: "DSP-1", met: h.disability_unable_to_work }, { clause: "DSP-2", met: null }], [],
    `${fmt(1250)} a month if the assessment confirms it`, [1250], 1250 * 12));
  // AGP
  {
    const limit = partnered ? 45000 : 30000;
    const r: R[] = [{ clause: "AGP-1", met: age >= 66 }, { clause: "AGP-2", met: incMissing ? null : inc! < limit }];
    out.push(decide(S("AGP"), h, r, age >= 66 && incMissing ? ["household income"] : [],
      `${fmt(1050)} a month`, [1050], 1050 * 12));
  }
  // BSP
  {
    const dd = h.partner?.status === "widowed" ? h.partner.death_date : undefined;
    const kids = kidAges.some((a) => a < 16);
    const r: R[] = [{ clause: "BSP-1", met: !!dd && daysSince(dd) <= 365 }, { clause: "BSP-2", met: age < 66 }];
    if (kids) r.push({ clause: "BSP-4", met: true });
    out.push(decide(S("BSP"), h, r, [],
      kids ? `${fmt(2500)} one-off plus ${fmt(350)} a month for 12 months` : `${fmt(2500)} one-off`,
      kids ? [2500, 350] : [2500], 2500 + (kids ? 350 * 12 : 0)));
  }
  // ESA: low income, or on/eligible for JSA or AGP
  {
    const viaBenefit = out.some((e) => (e.scheme === "JSA" || e.scheme === "AGP") && e.status === "ELIGIBLE")
      || h.enrolled.includes("JSA") || h.enrolled.includes("AGP");
    const low = incMissing ? null : inc! < 28000;
    const met = viaBenefit || low === true ? true : low === null ? null : false;
    const e = decide(S("ESA"), h, [{ clause: viaBenefit ? "ESA-2" : "ESA-1", met }],
      met === null ? ["household income"] : [], `${fmt(250)} a year`, [250], 250);
    out.push(e);
  }
  // SCH
  {
    const n = kidAges.filter((a) => a >= 5 && a <= 17).length;
    const r: R[] = [{ clause: "SCH-1", met: n > 0 }, { clause: "SCH-2", met: incMissing ? null : inc! < 35000 }];
    out.push(decide(S("SCH"), h, r, n > 0 && incMissing ? ["household income"] : [],
      `${fmt(300)} a year per child (${n} eligible: ${fmt(300 * n)} a year)`, [300, 300 * n], 300 * n));
  }
  // CCS
  {
    const under6 = kidAges.some((a) => a < 6);
    const allEmployed = h.employment_status === "employed" && (!partnered || h.partner!.employment_status === "employed");
    const fees = h.childcare_fees_monthly;
    const r: R[] = [{ clause: "CCS-1", met: under6 }, { clause: "CCS-2", met: allEmployed },
      { clause: "CCS-3", met: incMissing ? null : inc! < 90000 }];
    const missing = under6 && allEmployed
      ? [incMissing ? "household income" : "", fees == null ? "monthly childcare fees" : ""].filter(Boolean) : [];
    const pay = fees == null ? 0 : Math.min(900, Math.round(fees * 0.6));
    out.push(decide(S("CCS"), h, r, missing,
      fees == null ? "60% of childcare fees, up to $900 a month" : `${fmt(pay)} a month (60% of ${fmt(fees)} fees)`,
      fees == null ? [900] : [pay, fees, 900], pay * 12));
  }
  // EHG: discretionary, only raised when the source shows a crisis
  out.push(decide(S("EHG"), h, [{ clause: "EHG-1", met: !!opts.hardship }, { clause: "EHG-2", met: null }], [],
    "up to $1,000 one-off, at a caseworker's discretion", [1000], 0));

  return out;
}

/** Entitlements worth acting on: not already claimed and not ruled out. */
export const actionable = (all: Entitlement[]) => all.filter((e) => !e.alreadyEnrolled && e.status !== "NOT_ELIGIBLE");
