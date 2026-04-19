import Link from "next/link";
import { PublicBlogChat } from "@/components/blog/public-blog-chat";
import { blogService } from "@/modules/blog/blog.service";

export const dynamic = "force-dynamic";

function formatTimestamp(value: string | null) {
  if (!value) {
    return "UNPUBLISHED";
  }

  return new Date(value).toLocaleString("vi-VN");
}

function formatShortDate(value: string | null) {
  if (!value) {
    return "draft";
  }

  return new Date(value).toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default async function BlogPage() {
  const blogPosts = await blogService.listPosts();
  const posts = blogPosts.items;
  const totalPosts = posts.length;
  const totalWords = posts.reduce((sum, post) => {
    const wordCount = post.publishedContent.trim()
      ? post.publishedContent.trim().split(/\s+/).length
      : 0;
    return sum + wordCount;
  }, 0);
  const averageWords = totalPosts > 0 ? Math.round(totalWords / totalPosts) : 0;
  const latestPost = posts[0] ?? null;

  return (
    <main className="blog-page">
      <section className="blog-hero">
        <div className="blog-kicker">Initialization sequence... complete</div>
        <div>
          <h1 className="blog-hero-title">
            PUBLIC <span className="blog-accent">JOURNAL</span>.
          </h1>
          <div className="blog-meta-stack" style={{ marginTop: 14 }}>
            <div className="blog-meta-line">
              <span>[TIMESTAMP]</span>
              <span>{new Date().toLocaleString("vi-VN")}</span>
            </div>
            <div className="blog-meta-line">
              <span>[FEED_STATE]</span>
              <span>{totalPosts > 0 ? "SYNCED" : "IDLE"}</span>
            </div>
            <div className="blog-meta-line">
              <span>[LAST_DEPLOY]</span>
              <span>{formatTimestamp(latestPost?.publishedAt ?? null)}</span>
            </div>
          </div>
        </div>

        <div className="blog-terminal-line">
          <span className="blog-terminal-prompt">system@brain:~$</span> tail -n 1 /var/log/public_journal
          <div className="blog-terminal-output">
            &gt;&gt; PUBLIC_FEED: {totalPosts} PUBLISHED_NODES. AVG_SIZE: {averageWords} WORDS. STATE: STABLE.
          </div>
        </div>
      </section>

      <section className="blog-quick-actions">
        <Link className="blog-action-card" href="/write">
          <span>[NEW_ENTRY]</span>
          <strong>Open CMS workspace</strong>
        </Link>
        <Link className="blog-action-card" href="/write">
          <span>[PUBLISH_NODE]</span>
          <strong>Prepare a new public projection</strong>
        </Link>
        <Link className="blog-action-card" href="/write">
          <span>[QUERY_ALL]</span>
          <strong>Inspect internal wiki and knowledge graph</strong>
        </Link>
        <Link className="blog-action-card" href="/blog">
          <span>[REFRESH_FEED]</span>
          <strong>Reload public journal dashboard</strong>
        </Link>
      </section>

      <PublicBlogChat />

      <div className="blog-grid">
        <section className="blog-section">
          <div className="blog-section-heading">
            <h2 className="blog-section-title">Recent entries</h2>
            <span className="blog-section-caption">LIMIT: {String(Math.min(5, totalPosts)).padStart(2, "0")}_SHOWN</span>
          </div>

          <div className="blog-entry-list">
            {posts.length === 0 ? (
              <div className="blog-terminal-line">
                <span className="blog-terminal-prompt">system@brain:~$</span> ls /public/journal
                <div className="blog-terminal-output">&gt;&gt; NO_PUBLISHED_POSTS_FOUND</div>
              </div>
            ) : (
              posts.slice(0, 5).map((post, index) => (
                <Link className="blog-entry-row" href={`/blog/${post.slug}`} key={post.id}>
                  <div className="blog-entry-index">{String(index + 1).padStart(2, "0")}</div>
                  <div className="blog-entry-body">
                    <div className="blog-entry-content">
                      <h3 className="blog-entry-title">{post.title}</h3>
                      <div className="blog-entry-tags">
                        <span className="blog-entry-chip">PUBLIC_NODE</span>
                        <span className="blog-entry-hash">#{post.slug}</span>
                      </div>
                      {post.description ? (
                        <div className="blog-terminal-output">{post.description}</div>
                      ) : null}
                    </div>
                    <div className="blog-entry-date">{formatShortDate(post.publishedAt)}</div>
                  </div>
                </Link>
              ))
            )}
          </div>

          {posts.length > 0 ? (
            <Link className="blog-link-inline" href={`/blog/${posts[0].slug}`}>
              [OPEN_LATEST_LOG]
            </Link>
          ) : null}
        </section>

        <aside className="blog-side-stack">
          <section className="blog-insight-card">
            <div className="blog-insight-label">RESURFACED_INSIGHT_ALERT</div>
            <p className="blog-insight-quote">
              “A public blog post is not the raw note itself. It is a compiled projection of the note, shaped for sharing.”
            </p>
            <div className="blog-insight-footer">
              <span>SOURCE: BLOG_PROJECTION_LAYER</span>
              <Link className="blog-insight-button" href="/write">
                RECALL
              </Link>
            </div>
          </section>

          <section className="blog-stats-card">
            <h3 className="blog-stats-title">Kernel capacity</h3>

            <div className="blog-stat-group">
              <div className="blog-stat-line">
                <div className="blog-stat-label">
                  <span>PUBLIC_FEED</span>
                  <span>{Math.min(100, totalPosts * 14)}%</span>
                </div>
                <div className="blog-stat-track">
                  <div className="blog-stat-fill green" style={{ width: `${Math.min(100, totalPosts * 14)}%` }} />
                </div>
              </div>

              <div className="blog-stat-line">
                <div className="blog-stat-label">
                  <span>AVG_ENTRY_SIZE</span>
                  <span>{Math.min(100, Math.round(averageWords / 12))}%</span>
                </div>
                <div className="blog-stat-track">
                  <div className="blog-stat-fill red" style={{ width: `${Math.min(100, Math.round(averageWords / 12))}%` }} />
                </div>
              </div>

              <div className="blog-stat-line">
                <div className="blog-stat-label">
                  <span>SIGNAL_DENSITY</span>
                  <span>{posts.length > 0 ? 84 : 0}%</span>
                </div>
                <div className="blog-stat-track">
                  <div className="blog-stat-fill yellow" style={{ width: `${posts.length > 0 ? 84 : 0}%` }} />
                </div>
              </div>
            </div>

            <div className="blog-metric-grid">
              <div className="blog-metric-box">
                <div className="blog-metric-value">{totalPosts}</div>
                <div className="blog-metric-label">PUBLIC_NODES</div>
              </div>
              <div className="blog-metric-box">
                <div className="blog-metric-value">{totalWords}</div>
                <div className="blog-metric-label">TOTAL_WORDS</div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
