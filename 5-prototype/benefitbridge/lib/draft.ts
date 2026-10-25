// Drafts the outreach message a caseworker reviews, then runs the safety checks.
// A draft that fails any check is withheld: the caseworker sees why, never the text as "ready".
import Anthropic from "@anthropic-ai/sdk";
import { groqChat } from "./groq";
import { CLAUDE_MODEL, GROQ_MODEL, withBackup } from "./models";
import { guard } from "./guard";
import type { Draft, Entitlement, Household } from "./types";

const firstName = (h: Household) => h.full_name.split(" ")[0];

function offlineDraft(h: Household, eligible: Entitlement[], needs: Entitlement[], questions: string[]): string {
  const lines = [`Dear ${firstName(h)},`, "",
    "We are contacting you because our records show a recent change in your circumstances. Based on what we know, you may be entitled to support you are not receiving yet:", ""];
  for (const e of eligible) lines.push(`- ${e.name}: ${e.amountText}.`);
  if (needs.length) {
    lines.push("", "You might also qualify for:");
    for (const e of needs) lines.push(`- ${e.name}: ${e.amountText}. We need a little more information to check this.`);
  }
  if (questions.length) {
    lines.push("", "To check this, please tell us:");
    for (const q of questions) lines.push(`- ${q}`);
  }
  const docs = [...new Set(eligible.flatMap((e) => e.documents))];
  if (docs.length) lines.push("", `We have started the application forms for you. To finish them, we will need: ${docs.join("; ")}.`);
  lines.push("", "Nothing changes until you reply. A caseworker has checked this message. Call us on 0800 555 0100 or reply to this message, and we will help you complete everything.",
    "", "Aurelia Social Support Agency");
  return lines.join("\n");
}

const DRAFT_SYSTEM = `You write short, warm, plain-language outreach messages from a government social-support agency to a citizen, which a caseworker reviews before sending.
Rules:
- Write entirely in the citizen's preferred language, at about a reading age of 12.
- Use only the schemes, amounts and documents given in the JSON. Never add other benefits, amounts, dates or promises.
- Say "you may be entitled to", never that a payment is approved or guaranteed.
- Copy every dollar amount exactly as given, including the $ sign and digits (for example $1,150). Do not convert currency or round.
- Say nothing changes until they reply, and give the phone number.
- No subject line, no placeholders, under 220 words. Return only the message text.`;

function liveDraft(h: Household, eligible: Entitlement[], needs: Entitlement[], questions: string[]) {
  const facts = {
    first_name: firstName(h),
    language: h.preferred_language,
    may_be_entitled_to: eligible.map((e) => ({ scheme: e.name, amount: e.amountText, documents: e.documents })),
    might_qualify_needs_info: needs.map((e) => ({ scheme: e.name, amount: e.amountText })),
    questions_to_ask: questions,
    contact_phone: "0800 555 0100",
    signature: "Aurelia Social Support Agency",
  };
  const user = JSON.stringify(facts, null, 2);
  return withBackup(() => groqDraft(user), () => claudeDraft(user));
}

async function groqDraft(user: string) {
  const r = await groqChat({ model: GROQ_MODEL, system: DRAFT_SYSTEM, user, maxTokens: 1000 });
  if (!r.text) throw new Error("draft_unavailable");
  return r;
}

async function claudeDraft(user: string) {
  const res = await new Anthropic().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    output_config: { effort: "medium" },
    system: DRAFT_SYSTEM,
    messages: [{ role: "user", content: user }],
  });
  if (res.stop_reason === "refusal") throw new Error("draft_unavailable");
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
  return { text, usage: { input_tokens: res.usage.input_tokens, output_tokens: res.usage.output_tokens } };
}

export async function makeDraft(h: Household, ents: Entitlement[], questions: string[], mode: "live" | "offline") {
  const eligible = ents.filter((e) => e.status === "ELIGIBLE");
  const needs = ents.filter((e) => e.status === "NEEDS_INFO");
  const routed = ents.filter((e) => e.status === "ROUTE_TO_HUMAN");
  if (!eligible.length && !needs.length) return { draft: null, usage: undefined };
  if (!h.consent_proactive_contact) {
    return {
      draft: { language: h.preferred_language, text: "", mode, withheld: true, checks: [],
        note: "This person has opted out of proactive contact. No message drafted. Send the standard entitlement notice by post instead." } as Draft,
      usage: undefined,
    };
  }
  let text: string;
  let usage: { input_tokens: number; output_tokens: number } | undefined;
  let note: string | undefined;
  let model: string | undefined;
  let fellBack = false;
  if (mode === "live") {
    const r = await liveDraft(h, eligible, needs, questions);
    text = r.text; usage = r.usage; model = r.model; fellBack = r.fellBack;
  } else {
    text = offlineDraft(h, eligible, needs, questions);
    if (h.preferred_language !== "English") note = `Offline mode drafts in English. Live AI mode writes this in ${h.preferred_language}.`;
  }
  const checks = guard(text, [...eligible, ...needs], routed);
  return {
    draft: { language: mode === "live" ? h.preferred_language : "English", text, mode, withheld: checks.some((c) => !c.passed), checks, note } as Draft,
    usage, model, fellBack,
  };
}
