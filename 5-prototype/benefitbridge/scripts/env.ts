// Loads .env.local before anything reads process.env (Next.js does this itself; tsx does not).
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
