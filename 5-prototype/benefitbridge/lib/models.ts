// Which model serves Live mode. Groq is primary; Claude is the backup when a Groq call fails.
// With only one key set, that provider is used on its own.
import { GROQ_DEFAULT_MODEL } from "./groq";

export const GROQ_MODEL = process.env.GROQ_MODEL || GROQ_DEFAULT_MODEL;
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
export const PROVIDER: "groq" | "anthropic" = process.env.GROQ_API_KEY ? "groq" : "anthropic";
export const DEFAULT_MODEL = PROVIDER === "groq" ? GROQ_MODEL : CLAUDE_MODEL;
// Shown in the header; null when there is nothing to fall back to.
export const BACKUP_MODEL = PROVIDER === "groq" && process.env.ANTHROPIC_API_KEY ? CLAUDE_MODEL : null;

export async function withBackup<T extends object>(groq: () => Promise<T>, claude: () => Promise<T>) {
  if (!process.env.GROQ_API_KEY) return { ...(await claude()), model: CLAUDE_MODEL, fellBack: false };
  try {
    return { ...(await groq()), model: GROQ_MODEL, fellBack: false };
  } catch (err) {
    if (!process.env.ANTHROPIC_API_KEY) throw err;
    console.warn(`Groq failed (${err instanceof Error ? err.message.slice(0, 80) : "error"}); using Claude.`);
    return { ...(await claude()), model: CLAUDE_MODEL, fellBack: true };
  }
}
