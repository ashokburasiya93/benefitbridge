export type SchemeId =
  | "CB" | "NMG" | "JSA" | "HSB" | "CAR" | "DSP" | "AGP" | "BSP" | "ESA" | "SCH" | "CCS" | "EHG";

export interface Scheme {
  id: SchemeId;
  name: string;
  type: "monthly" | "one-off" | "annual" | "mixed";
  means_tested: boolean;
  discretionary: boolean;
  summary: string;
  clauses: Record<string, string>;
  documents: string[];
}

export interface Person { name: string; dob: string }
export interface Partner extends Person {
  status: "partnered" | "widowed" | "separated";
  employment_status: string;
  death_date?: string;
}

export interface Household {
  id: string;
  full_name: string;
  dob: string;
  preferred_language: string;
  region: string;
  contact: { phone: string; email: string };
  partner: Partner | null;
  children: Person[];
  employment_status: "employed" | "unemployed" | "retired" | "student";
  job_end_date: string | null;
  household_income_annual: number | null;
  savings: number | null;
  tenure: "rent" | "own" | "social";
  rent_monthly: number | null;
  disability_unable_to_work: boolean;
  care_hours_weekly: number;
  partner_care_hours_weekly: number;
  childcare_fees_monthly: number | null;
  enrolled: SchemeId[];
  consent_proactive_contact: boolean;
  record_updated: string;
}

export interface LifeEvent {
  id: string;
  citizen_id: string;
  type: string;
  received: string;
  source: string;
  text: string;
  registry_facts: Record<string, string>;
}

export const FACT_FIELDS = [
  "employment_status", "job_end_date", "household_income_annual", "savings", "tenure", "rent_monthly",
  "partner_status", "partner_death_date", "new_child_dob", "disability_unable_to_work", "care_hours_weekly",
  "partner_care_hours_weekly", "childcare_fees_monthly", "hardship_flag",
] as const;
export type FactField = (typeof FACT_FIELDS)[number];

export interface Fact {
  field: FactField;
  value: string | number | boolean;
  quote: string;           // verbatim text from the source that supports the value
  confidence: "high" | "medium" | "low";
  origin: "registry" | "extracted";
  verified: boolean;       // quote found verbatim in the source
  conflictsWithRecord?: string; // what the agency record said before, when different
}

export type Status = "ELIGIBLE" | "NEEDS_INFO" | "ROUTE_TO_HUMAN" | "NOT_ELIGIBLE";

export interface Entitlement {
  scheme: SchemeId;
  name: string;
  status: Status;
  reasons: { clause: string; text: string; met: boolean | null }[];
  missing: string[];             // fields needed before a decision
  amountText: string;            // human text, e.g. "$95 a month"
  amounts: number[];             // every dollar figure a message may quote for this scheme
  annualValue: number;           // for ranking and the take-up gap; 0 when unknown
  alreadyEnrolled: boolean;
  documents: string[];
}

export interface GuardCheck { name: string; passed: boolean; detail: string }

export interface Draft {
  language: string;
  text: string;
  mode: "live" | "offline";
  withheld: boolean;
  checks: GuardCheck[];
  note?: string;
}

export interface AnalysisResult {
  event: LifeEvent;
  household: Household;           // record as held
  updated: Household;             // record + facts from this event
  facts: Fact[];
  droppedFacts: { field: string; reason: string }[];
  entitlements: Entitlement[];    // new (not enrolled) and decided
  questions: string[];            // what to ask the citizen
  draft: Draft | null;
  routeReason: string | null;
  duplicateOf: string[];
  mode: "live" | "offline";
  model: string | null;
  fellBack?: boolean;
  usage?: { input_tokens: number; output_tokens: number };
  unreadable: boolean;            // free-text source where no facts could be read: a person must read it
  priority: { score: number; label: "Urgent" | "Read now" | "High" | "Normal" | "No action" };
}
