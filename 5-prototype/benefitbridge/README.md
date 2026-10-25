# BenefitBridge: a proactive entitlement agent for caseworkers

BenefitBridge watches for life events (a birth, a job loss, a bereavement, a hospital discharge, a rent rise), works out what support the household is entitled to but not claiming, and gives a caseworker a ready-to-approve outreach message and pre-filled applications. The caseworker decides. Nothing is sent or awarded by the AI.

Everything here is **synthetic**: the Republic of Aurelia, its Social Support Agency, the 12 schemes and every person are invented.

## How it works

```
life event ──► 1. read facts ──► 2. update the household copy ──► 3. rules decide ──► 4. draft message ──► 5. safety checks ──► caseworker approves / edits / rejects
              (Claude or patterns,     (newer source wins,           (deterministic code,     (Claude or       (amounts, schemes,        (logged with who and when)
               every fact needs a      conflicts shown)              every decision cites     template)         promises, opt-out)
               verbatim quote)                                       a clause)
```

* **The AI reads and writes; it never decides eligibility.** Eligibility is plain code in `lib/rules.ts`, one block per scheme, each citing the clause in `data/schemes.json`.
* **Grounded facts.** Each fact carries the exact words it came from. A fact whose quote is not in the source is dropped (`lib/extract.ts`).
* **Safety checks on every draft** (`lib/guard.ts`): every dollar amount must come from the rules, no other schemes may be named, no promise of a decision, caseworker-only schemes (Disability Support, Hardship Grant) are left out. A failing draft is withheld, and the checks re-run as the caseworker edits.
* **Fail safe.** A free-text message the agent could not read is marked "Read now" for a person, never filed as "no action". If Claude is unavailable, the case opens on the rules-based path.
* **Respect for consent.** People who opted out of proactive contact get no drafted message; the caseworker is told to send the standard notice.

## Run it

Requires Node 20.12+.

```bash
npm install
npm run dev            # http://localhost:3000
```

Without an API key the app runs in **Offline mode**: facts come from text patterns (English only) and messages from a template. To turn on **Live AI mode** (facts from Claude in any language, drafts in the citizen's own language):

```bash
cp .env.example .env.local   # then set ANTHROPIC_API_KEY
npm run dev
```

The model defaults to `claude-opus-5-5`; set `CLAUDE_MODEL` to change it (see the cost estimate for the trade-off).

## Quality checks (launch evals)

```bash
npm run eval                  # offline, no key needed
npm run eval -- --live        # reads ANTHROPIC_API_KEY from .env.local
```

**Models: Groq first, Claude as backup.** Set `GROQ_API_KEY` in `.env.local` to make Groq (`openai/gpt-oss-120b`, change with `GROQ_MODEL`) the primary model. If a Groq call fails (outage, rate limit after 8 retries, bad JSON), the same step is re-run on Claude when `ANTHROPIC_API_KEY` is set. Each case shows which model served it, and `npm run eval -- --live` writes `data/eval_results_groq.json` with a count of how often the backup was used. With only one key set, that provider is used alone.

`npm run build` runs the evals first and **fails the build if any check fails**. Labels in `data/ground_truth.json` come from an independent Python implementation of the rules (`scripts/generate_dataset.py`), so the TypeScript engine is checked against something it did not produce.

Latest offline run (40 life events):

| Check | Offline | Live (Groq gpt-oss-120b) | Target |
|---|---|---|---|
| Facts shown without a verified quote | 0 | 0 | 0 |
| Caseworker-only schemes marked eligible | 0 | 0 | 0 |
| Drafts for people who opted out | 0 | 0 | 0 |
| Crises missed without sending to a person | 0 | 0 | 0 |
| Unsafe test drafts blocked | 4 of 4 | 4 of 4 | all |
| Entitlement precision / recall | 100% / 100% | 100% / 100% | 95% / 90% |
| Fact recall | 93.7% | 98.7% | 90% |
| Cases exactly right | 97.5% (39 of 40) | 100% (40 of 40) | |

Offline mode's one miss is a Spanish message about an eviction (E-2033): it can't read it, so it is flagged "Read now" for a caseworker. Live AI mode reads it correctly. The live run used about 980 input and 850 output tokens per event, and the Claude backup was never needed.

## Deploy to Vercel (free tier)

Live demo: https://benefitbridge-one.vercel.app (Live AI mode on Groq; the Quality checks page shows the saved Offline and Groq eval results).

1. Push this folder to a GitHub repository.
2. In Vercel, **Add New Project**, import the repository. Framework: Next.js (detected). No build settings to change.
3. Optional: add `ANTHROPIC_API_KEY` (and `CLAUDE_MODEL`) under **Settings → Environment Variables** for Live AI mode.
4. Deploy. The build runs the evals and stops if any fail.

Or from a terminal: `npx vercel` then `npx vercel --prod`.

## Pages

| Page | What it shows |
|---|---|
| `/` Today's cases | 40 life events ranked: urgent and unreadable first, then by value of unclaimed support |
| `/case/E-2007` | One case: source with evidence highlighted, facts, entitlements with clauses, questions, draft, safety checks, pre-filled applications, approve/reject |
| `/insights` | North Star baseline and the take-up gap across all 141 households |
| `/evals` | The launch evals above |
| `/audit` | Every approval and rejection (kept in the browser for the prototype) |
| `/schemes` | The rulebook |

Good demo cases: **E-2007** job loss (4 schemes, record conflicts), **E-2029** eviction and power cut (Urgent, Hardship Grant to a caseworker), **E-2020** stroke (Disability Support needs an assessment, partner gets Carer Allowance), **E-2033** Spanish eviction message (fail safe), **E-2036** opted out of contact.

## Dataset (`data/`)

| File | Contents |
|---|---|
| `schemes.json` | 12 schemes, numbered clauses, documents needed |
| `citizens.json` | 141 household records: 100 background, 40 with an event today, 1 deliberate duplicate |
| `events.json` | 40 life events from registries, employers, hospitals, caseworker notes and citizen messages |
| `history.json` | 320 life events from last year with whether and when people claimed (North Star baseline) |
| `ground_truth.json` | Expected facts and entitlements per event (eval labels only, never shown to the AI) |

Deliberate imperfections: 9 records have no income, 1 duplicate person, 2 messages in Spanish, records up to 2.5 years stale, record values that conflict with newer sources, one person who opted out of contact. Regenerate with `npm run data` (fixed seed, same output).

**Added beyond a minimal dataset:** the history file (to measure a baseline), the opt-out flag, the conflicting and missing values, and the Spanish messages, so the guardrails have something real to catch.

## Code map

| Path | Role |
|---|---|
| `lib/rules.ts` | Eligibility engine (deterministic, cites clauses) |
| `lib/extract.ts` | Fact extraction: Claude with a fixed JSON schema, or patterns; quote verification |
| `lib/draft.ts` | Outreach drafting: Claude or template |
| `lib/guard.ts` | Safety checks, shared by server and caseworker screen |
| `lib/pipeline.ts` | One event in, one reviewable case out; priority and fail-safes |
| `scripts/eval.ts` | Launch evals; non-zero exit fails the build |
| `scripts/generate_dataset.py` | Synthetic data and independent ground truth |

## Known limits of the prototype

* The approvals log lives in the browser (localStorage). Production would write to an audit database such as Supabase/Postgres.
* "Sending" and "opening applications" are simulated; nothing leaves the app.
* Offline mode reads English patterns only. It exists so the demo and evals run without a key.
* "Today" is fixed at 20 October 2026 so results are reproducible.
