import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { EntryEditor } from "@/components/editor/entry-editor";
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
  const navigation = await entriesService.getNavigationTree(auth.userId);

  return (
    <main className="shell write-shell">
      <section className="panel topbar">
        <div>
          <p className="panel-kicker">Second Brain Journal</p>
          <h1>Organize and write like a personal wiki.</h1>
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

      <EntryEditor initialEntries={entryResponse.items} initialNavigation={navigation.root} />
    </main>
  );
}
