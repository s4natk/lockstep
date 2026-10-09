import { ReviewPanel } from "../components/ReviewPanel";

export default function HomePage() {
  return (
    <main className="shell">
      <header className="header">
        <h1>Lockstep</h1>
        <p>Paste a Postgres migration. Rust classifies the DDL, then the review cites a runbook before it keeps a sentence.</p>
      </header>
      <ReviewPanel />
    </main>
  );
}
