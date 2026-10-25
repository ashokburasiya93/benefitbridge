import schemesJson from "@/data/schemes.json";
import citizensJson from "@/data/citizens.json";
import eventsJson from "@/data/events.json";
import historyJson from "@/data/history.json";
import type { Household, LifeEvent, Scheme, SchemeId } from "./types";

// The synthetic dataset is frozen on this date so every run is reproducible.
export const TODAY = new Date("2026-10-20T00:00:00Z");

export const schemes = schemesJson as unknown as Scheme[];
export const citizens = citizensJson as unknown as Household[];
export const events = eventsJson as unknown as LifeEvent[];
export const history = historyJson as unknown as {
  event_type: string; event_date: string; schemes_entitled: number; schemes_claimed: number;
  days_to_first_claim: number | null; annual_value_entitled: number;
}[];

export const schemeById = (id: SchemeId) => schemes.find((s) => s.id === id)!;
export const citizenById = (id: string) => citizens.find((c) => c.id === id);
export const eventById = (id: string) => events.find((e) => e.id === id);

export const EVENT_LABELS: Record<string, string> = {
  birth: "New baby",
  job_loss: "Job loss",
  bereavement: "Bereavement",
  disability: "Illness or disability",
  age_milestone: "Turned 66",
  housing_cost: "Housing cost rise",
  separation: "Separation",
  caring: "Started caring",
};
