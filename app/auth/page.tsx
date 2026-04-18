import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getOptionalAuth } from "@/lib/auth";

export default async function AuthPage() {
  const auth = await getOptionalAuth();

  if (auth) {
    redirect("/write");
  }

  return (
    <main className="shell auth-shell">
      <div className="auth-grid">
        <section className="hero-panel">
          <p className="hero-kicker">Second Brain Journal</p>
          <h1 className="hero-title">Markdown-first memory, database-first system.</h1>
          <p className="hero-copy">
            You write entries in Markdown. The backend keeps the raw source,
            derives plain text for search and AI processing, and extracts wiki
            links so the knowledge layer can become structured over time.
          </p>
          <div className="hero-card-row">
            <div className="hero-card">
              <strong>Raw source</strong>
              Markdown stays intact as your authored record.
            </div>
            <div className="hero-card">
              <strong>Derived layer</strong>
              Plain text and links are extracted automatically.
            </div>
            <div className="hero-card">
              <strong>Next step</strong>
              Save a note and inspect how the entry structure evolves.
            </div>
          </div>
        </section>

        <section className="panel">
          <p className="panel-kicker">Auth Screen</p>
          <h2 className="panel-title">Sign in with the env credentials</h2>
          <p className="muted-copy">
            This MVP uses a single user defined by `APP_USERNAME` and
            `APP_PASSWORD`.
          </p>
          <div style={{ marginTop: 20 }}>
            <LoginForm />
          </div>
        </section>
      </div>
    </main>
  );
}
