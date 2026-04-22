import Link from "next/link";
import { PublicBlogChat } from "@/components/blog/public-blog-chat";
import { blogService } from "@/modules/blog/blog.service";

export const dynamic = "force-dynamic";

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

type BlogPageProps = {
  searchParams?: Promise<{
    path?: string;
  }>;
};

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const activePath = resolvedSearchParams?.path?.trim() || null;
  const blogPosts = await blogService.listPostsByLogicalPath(activePath);
  const posts = blogPosts.items;
  const pinnedPosts = posts.filter((post) => post.pinnedAt);
  const recentPosts = posts.filter((post) => !post.pinnedAt);
  const totalPosts = posts.length;
  const totalWords = posts.reduce((sum, post) => {
    const wordCount = post.publishedContent.trim()
      ? post.publishedContent.trim().split(/\s+/).length
      : 0;
    return sum + wordCount;
  }, 0);
  const averageWords = totalPosts > 0 ? Math.round(totalWords / totalPosts) : 0;

  return (
    <main className="blog-page">
      <section className="blog-hero">
        <div className="blog-kicker">Initialization sequence... complete</div>
        <div>
          <h1 className="blog-hero-title">
            PUBLIC <span className="blog-accent">JOURNAL</span>.
          </h1>
          {activePath ? (
            <div className="blog-active-filter">
              FILTER_PATH: <span>{activePath}</span>
            </div>
          ) : null}
        </div>

        <div className="blog-hero-panels">
          <section className="blog-hero-problem">
            <p className="blog-hero-problem-title">Tôi giải quyết vấn đề gì?</p>
            <p className="blog-hero-problem-copy">
              Tôi giải quyết sự đứt gãy giữa <strong>Tầm nhìn Kinh doanh</strong> và{" "}
              <strong>Thực thi Kỹ thuật</strong>. Tôi xây sản phẩm và hệ thống AI theo hướng không chỉ chạy
              được, mà còn phải đúng hướng, rõ giá trị và có thể scale lâu dài.
            </p>
          </section>

          <section className="blog-hero-bio">
            <div className="blog-hero-bio-watermark">ROOT_ACCESS</div>
            <p className="blog-hero-bio-label">// Short_Bio</p>
            <p className="blog-hero-bio-copy">
              "Xuất phát điểm là kỹ sư phần mềm, tôi chuyển dần sang vai trò xây sản phẩm và hệ thống tri
              thức vì nhận ra: code chỉ là công cụ, còn cấu trúc sản phẩm và chất lượng quyết định mới là
              thứ tạo ra đòn bẩy thật sự."
            </p>
          </section>
        </div>
      </section>

      {/* <section className="blog-quick-actions">
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
      </section> */}

      {activePath ? (
        <section className="blog-filter-banner">
          <div className="blog-filter-copy">
            <span className="blog-kicker">path filter active</span>
            <strong>Showing only public posts from `{activePath}`</strong>
          </div>
          <Link className="blog-filter-clear" href="/blog">
            CLEAR_FILTER
          </Link>
        </section>
      ) : null}

      {pinnedPosts.length > 0 ? (
        <section className="blog-pinned-section">
          <div className="blog-section-heading">
            <h2 className="blog-section-title">Pinned nodes</h2>
            <span className="blog-section-caption">HOME_SIGNAL: {String(pinnedPosts.length).padStart(2, "0")}</span>
          </div>

          <div className="blog-pinned-grid">
            {pinnedPosts.map((post) => (
              <Link className="blog-pinned-card" href={`/blog/${post.slug}`} key={post.id}>
                <div className="blog-pinned-label">Pinned</div>
                <h3 className="blog-pinned-title">{post.title}</h3>
                {post.description ? (
                  <p className="blog-pinned-description">{post.description}</p>
                ) : (
                  <p className="blog-pinned-description">No excerpt available yet.</p>
                )}
                <div className="blog-pinned-path">{post.logicalPath ?? "uncategorized"}</div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <PublicBlogChat />

      <div className="blog-grid">
        <section className="blog-section">
          <div className="blog-section-heading">
            <h2 className="blog-section-title">Recent entries</h2>
            <span className="blog-section-caption">
              LIMIT: {String(Math.min(5, recentPosts.length)).padStart(2, "0")}_SHOWN
            </span>
          </div>

          <div className="blog-entry-list">
            {recentPosts.length === 0 ? (
              <div className="blog-terminal-line">
                <span className="blog-terminal-prompt">system@brain:~$</span> ls /public/journal
                <div className="blog-terminal-output">
                  &gt;&gt; {pinnedPosts.length > 0 ? "ONLY_PINNED_POSTS_VISIBLE" : "NO_PUBLISHED_POSTS_FOUND"}
                </div>
              </div>
            ) : (
              recentPosts.slice(0, 5).map((post, index) => (
                <Link className="blog-entry-row" href={`/blog/${post.slug}`} key={post.id}>
                  <div className="blog-entry-index">{String(index + 1).padStart(2, "0")}</div>
                  <div className="blog-entry-body">
                    <div className="blog-entry-content">
                      <h3 className="blog-entry-title">{post.title}</h3>
                      <div className="blog-entry-tags">
                        <span className="blog-entry-chip">PUBLIC_NODE</span>
                        <span className="blog-entry-hash">#{post.slug}</span>
                        {post.logicalPath ? <span className="blog-entry-path">{post.logicalPath}</span> : null}
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
