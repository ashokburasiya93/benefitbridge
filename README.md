# BenefitBridge: Proactive Entitlement Agent

An AI PM capstone for the Global Public Sector. BenefitBridge finds people who now qualify for support they are not claiming, after a life event such as a job loss, a birth or a bereavement. It hands a caseworker a pre-filled application and a draft message to approve.

**AI reads, rules decide, people approve.** A language model reads letters, notes and messages in any language, and every fact it uses must quote the source word for word. A plain-code rules engine decides eligibility and cites the clause. Nothing is sent or awarded without a caseworker's approval.

- **Live demo:** https://benefitbridge-one.vercel.app (Live AI mode on Groq; synthetic data only)
- **Miro board (AI opportunity map):** https://miro.com/app/board/uXjVEVr2G-M=/?share_link_id=783156918261

All data is synthetic: a fictional country (the Republic of Aurelia), 12 schemes, 141 households and 40 life events.

## Deliverables

| # | Deliverable | Format | Where |
|---|---|---|---|
| 1 | User research worksheet (problem discovery) | Excel | [1-user-research](1-user-research/) |
| 2 | AI opportunity map | Miro board + Excel (and the CSV used for the Miro import) | [Miro board](https://miro.com/app/board/uXjVEVr2G-M=/?share_link_id=783156918261), [2-ai-opportunity-map](2-ai-opportunity-map/) |
| 3 | AI PRD with North Star and success metrics | Word, plus the flow diagram | [3-ai-prd](3-ai-prd/) |
| 4 | Cost estimation | Excel | [4-cost-estimation](4-cost-estimation/) |
| 5 | Working AI prototype | Code + README | [5-prototype/benefitbridge](5-prototype/benefitbridge/) ([README](5-prototype/benefitbridge/README.md), [screenshots](5-prototype/screenshots/)) |
| 6 | Presentation | PowerPoint | [6-presentation](6-presentation/) |
| 7 | Demo video script (extra) | Word | [7-demo-video-script](7-demo-video-script/) |
| 8 | Client meeting prep (extra) | Word | [8-client-meeting-prep](8-client-meeting-prep/) |

## Key numbers

- **North Star:** share of eligible households enrolled within 30 days of a life event. It is 21% today, with targets of 45% in the pilot and 60% at full rollout.
- **Take-up gap:** $160,770 a year unclaimed across 50 of 141 households.
- **Launch evals, 40 events:**

  | Check | Offline (rules + patterns) | Live AI (Groq) | Target |
  |---|---|---|---|
  | Fact recall | 93.7% | 98.7% | 90% or more |
  | Entitlement precision / recall | 100% / 100% | 100% / 100% | 95% / 90% |
  | Cases exactly right | 39 of 40 | 40 of 40 | |
  | Drafts passing the safety checks | 27 of 27 | 27 of 27 | all |
  | Unquoted facts, caseworker-only schemes marked eligible, drafts to opted-out people, crises missed | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 |

- **Running cost (pilot, 22,500 events a month):** about $132 a month, under a cent a case. That is Groq `openai/gpt-oss-120b` as the main model, Claude Opus 5.5 as backup on a budgeted 10% of events, and hosting.

## Run the prototype

```bash
cd 5-prototype/benefitbridge
npm install
npm run dev        # Offline mode, no key needed
```

For Live AI mode, copy `.env.example` to `.env.local` and add `GROQ_API_KEY` (and optionally `ANTHROPIC_API_KEY` as backup). `npm run eval -- --live` measures it. See the [prototype README](5-prototype/benefitbridge/README.md) for details.
