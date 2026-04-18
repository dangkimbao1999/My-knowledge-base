import Link from "next/link";
import { blogService } from "@/modules/blog/blog.service";

export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const blogPosts = await blogService.listPosts();

  return (
    <main className="shell write-shell">
      <section className="panel topbar">
        <div>
          <p className="panel-kicker">Public Blog</p>
          <h1>Published entries</h1>
          <p className="muted-copy">
            Public projections built from your internal entries.
          </p>
        </div>
      </section>

      <section className="panel sidebar-panel">
        <div className="entry-list">
          {blogPosts.items.length === 0 ? (
            <div className="empty-state">No public posts yet.</div>
          ) : (
            blogPosts.items.map((post) => (
              <article className="entry-card" key={post.id}>
                <h3>
                  <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                </h3>
                <div className="meta-row">
                  <span>{post.slug}</span>
                  {post.publishedAt ? (
                    <span>{new Date(post.publishedAt).toLocaleString()}</span>
                  ) : null}
                </div>
                {post.description ? <p className="muted-copy">{post.description}</p> : null}
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
