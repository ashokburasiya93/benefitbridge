// Groq's OpenAI-compatible chat API: the primary Live-mode provider when GROQ_API_KEY is set (see models.ts).
export const GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function groqChat(opts: { model: string; system: string; user: string; json?: boolean; maxTokens?: number }) {
  // Free-tier limits are low (about 8,000 tokens a minute), so on a 429 wait as long as Groq asks, then try again.
  // On Vercel a page can't wait minutes, so give up after about 15 seconds and let the case fall back (Claude, then Offline).
  const budgetMs = process.env.VERCEL ? 15_000 : Infinity;
  let waited = 0;
  for (let attempt = 1; ; attempt++) {
    const res = await groqOnce(opts);
    if (res.status !== 429 || attempt === 8) return parse(res);
    const body = await res.text();
    const hinted = Number(res.headers.get("retry-after")) || Number(body.match(/try again in ([\d.]+)s/)?.[1]);
    const wait = Math.min(90, Math.ceil(hinted || 20) + 1) * 1000;
    if (waited + wait > budgetMs) throw new Error(`groq_429: rate limited (${body.slice(0, 120)})`);
    waited += wait;
    await sleep(wait);
  }
}

function groqOnce(opts: { model: string; system: string; user: string; json?: boolean; maxTokens?: number }) {
  return fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 2000,
      temperature: 0,
      messages: [{ role: "system", content: opts.system }, { role: "user", content: opts.user }],
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
}

async function parse(res: Response) {
  if (!res.ok) throw new Error(`groq_${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json() as { choices: { message: { content: string | null } }[]; usage?: { prompt_tokens: number; completion_tokens: number } };
  return {
    text: (data.choices[0]?.message.content ?? "").trim(),
    usage: { input_tokens: data.usage?.prompt_tokens ?? 0, output_tokens: data.usage?.completion_tokens ?? 0 },
  };
}
