// Safety checks shared by the server pipeline and the caseworker screen (re-run on every edit).
import { schemes } from "./data";
import { fmt } from "./rules";
import type { Entitlement, GuardCheck } from "./types";

/** Safety checks run on every draft before a caseworker can approve it. */
export function guard(text: string, allowed: Entitlement[], routed: Entitlement[]): GuardCheck[] {
  const allowedAmounts = new Set(allowed.flatMap((e) => e.amounts.map((a) => Math.round(a))));
  allowedAmounts.add(0);
  const found = [...text.matchAll(/\$\s?([\d][\d,]*(?:\.\d+)?)/g)].map((m) => Math.round(Number(m[1].replace(/,/g, ""))));
  const unsupported = found.filter((a) => !allowedAmounts.has(a));
  const allowedNames = new Set(allowed.map((e) => e.name.toLowerCase()));
  const otherSchemes = schemes.filter((s) => !allowedNames.has(s.name.toLowerCase()) && text.toLowerCase().includes(s.name.toLowerCase()));
  const routedNamed = routed.filter((e) => text.toLowerCase().includes(e.name.toLowerCase()));
  const promise = text.match(/\b(you will receive|has been approved|is approved|guaranteed|you are entitled to receive)\b/i);
  return [
    { name: "Every amount comes from the rules", passed: unsupported.length === 0,
      detail: unsupported.length ? `Unsupported amounts: ${unsupported.map(fmt).join(", ")}` : `${found.length} amounts checked` },
    { name: "Only schemes the rules found", passed: otherSchemes.length === 0,
      detail: otherSchemes.length ? `Mentions ${otherSchemes.map((s) => s.name).join(", ")}` : "No other schemes named" },
    { name: "No promise of a decision", passed: !promise, detail: promise ? `Says "${promise[0]}"` : "Uses 'may be entitled'" },
    { name: "Caseworker-only schemes left out", passed: routedNamed.length === 0,
      detail: routedNamed.length ? `Names ${routedNamed.map((e) => e.name).join(", ")}` : "None named" },
  ];
}
