import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";
import { liveAvailable, BACKUP_MODEL, DEFAULT_MODEL } from "@/lib/pipeline";

export const metadata = { title: "BenefitBridge", description: "Proactive entitlement agent for caseworkers (synthetic data prototype)" };

export default function RootLayout({ children }: { children: ReactNode }) {
  const live = liveAvailable();
  return (
    <html lang="en">
      <body>
        <header className="top">
          <div className="brand">BenefitBridge<small>Aurelia Social Support Agency</small></div>
          <nav>
            <Link href="/">Today&apos;s cases</Link>
            <Link href="/insights">Take-up gap &amp; North Star</Link>
            <Link href="/evals">Quality checks</Link>
            <Link href="/audit">Approvals log</Link>
            <Link href="/schemes">Rulebook</Link>
          </nav>
        </header>
        <div className="banner">
          Prototype on fully synthetic data (fictional country, people and schemes; &quot;today&quot; is 20 October 2026).{" "}
          {live ? <>Live AI mode: facts and drafts by <code>{DEFAULT_MODEL}</code>{BACKUP_MODEL && <>, with <code>{BACKUP_MODEL}</code> as backup</>}.</> : <>Offline mode: rules-based extraction and template drafts. Add <code>GROQ_API_KEY</code> (or <code>ANTHROPIC_API_KEY</code>) for Live AI mode.</>}
          {" "}Nothing is ever sent to a citizen.
        </div>
        <main>{children}</main>
      </body>
    </html>
  );
}
