import { redirect } from "next/navigation";
import { IdeaInbox } from "@/components/ideas/idea-inbox";
import { getOptionalAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function IdeasInboxPage() {
  if (!(await getOptionalAuth())) {
    redirect("/auth");
  }

  const ideas = await prisma.ideaSubmission.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <main className="shell write-shell">
      <section className="panel topbar">
        <div>
          <p className="panel-kicker">Campaign // Your idea, I develop</p>
          <h1>Ideas inbox</h1>
        </div>
        <div className="button-row">
          <a className="button-secondary" href="/write">
            Back to CMS
          </a>
          <a className="button-secondary" href="/blog/ideas" target="_blank" rel="noreferrer">
            View public form
          </a>
        </div>
      </section>

      <IdeaInbox initialIdeas={ideas.map((idea) => ({ ...idea, createdAt: idea.createdAt.toISOString() }))} />
    </main>
  );
}
