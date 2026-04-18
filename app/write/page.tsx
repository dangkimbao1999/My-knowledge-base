import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { EntryEditor } from "@/components/editor/entry-editor";
import { WikiQueryPanel } from "@/components/query/wiki-query-panel";
import { getOptionalAuth } from "@/lib/auth";
import { authService } from "@/modules/auth/auth.service";
import { entriesService } from "@/modules/entries/entries.service";

export default async function WritePage() {
  const auth = await getOptionalAuth();

  if (!auth) {
    redirect("/auth");
  }

  const user = await authService.currentUser(auth.userId);
  const entryResponse = await entriesService.listEntries(auth.userId, new URLSearchParams());

  return (
    <main className="shell write-shell">
      <section className="panel topbar">
        <div>
          <p className="panel-kicker">Second Brain Journal</p>
          <h1>Write and inspect your entry graph.</h1>
          <p className="muted-copy">
            Signed in as {user.displayName} ({user.username})
          </p>
        </div>
        <div className="button-row">
          <a className="button-secondary" href="/blog" target="_blank" rel="noreferrer">
            View public blog
          </a>
          <LogoutButton />
        </div>
      </section>

      <WikiQueryPanel />
      <EntryEditor initialEntries={entryResponse.items} />
    </main>
  );
}
