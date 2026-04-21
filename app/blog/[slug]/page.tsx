import Link from "next/link";
import { renderMarkdownPreview } from "@/lib/markdown-preview";
import { blogService } from "@/modules/blog/blog.service";

export const dynamic = "force-dynamic";

type BlogDetailPageProps = {
  params: Promise<{ slug: string }>;
};

function formatTimestamp(value: string | null) {
  if (!value) {
    return "UNPUBLISHED";
  }

  return new Date(value).toLocaleString("vi-VN");
}

export default async function BlogDetailPage({ params }: BlogDetailPageProps) {
  const { slug } = await params;
  const [post, posts] = await Promise.all([
    blogService.getPublicPost(slug),
    blogService.listPosts()
  ]);

  const relatedPosts = posts.items.filter((item) => item.slug !== slug).slice(0, 4);
  const contentWordCount = post.publishedContent.trim()
    ? post.publishedContent.trim().split(/\s+/).length
    : 0;

  return (
    <main className="blog-page">
      <section className="blog-hero">
        <div className="blog-kicker">journal node resolved</div>
        <div>
          <h1 className="blog-hero-title">
            {post.title.split(" ").slice(0, 3).join(" ")}{" "}
            <span className="blog-accent">
              {post.title.split(" ").slice(3).join(" ") || "NODE"}
            </span>
          </h1>
          <div className="blog-meta-stack" style={{ marginTop: 14 }}>
            <div className="blog-meta-line">
              <span>[SLUG]</span>
              <span>{post.slug}</span>
            </div>
            <div className="blog-meta-line">
              <span>[PUBLISHED_AT]</span>
              <span>{formatTimestamp(post.publishedAt)}</span>
            </div>
            <div className="blog-meta-line">
              <span>[WORD_COUNT]</span>
              <span>{contentWordCount}</span>
            </div>
          </div>
        </div>

        {/* <div className="blog-terminal-line">
          <span className="blog-terminal-prompt">reader@kernel:~$</span> cat /public/journal/{post.slug}
          <div className="blog-terminal-output">
            &gt;&gt; PROJECTION_READY. SOURCE ENTRY MATERIALIZED FOR PUBLIC READ ACCESS.
          </div>
        </div> */}
      </section>

      <div className="blog-article-grid">
        <article className="blog-article-card">
          <Link className="blog-back-link" href="/blog">
            [BACK]
          </Link>

          {post.description ? <p className="blog-description">{post.description}</p> : null}

          <div
            className="preview blog-article-preview"
            dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(post.publishedContent) }}
          />
        </article>

        <aside className="blog-side-stack">
          <section className="blog-side-card">
            <h2 className="blog-side-card-title">Node metadata</h2>
            <div className="blog-side-meta">
              <div className="blog-side-meta-line">
                <span>slug</span>
                <span>{post.slug}</span>
              </div>
              <div className="blog-side-meta-line">
                <span>status</span>
                <span>{post.status}</span>
              </div>
              <div className="blog-side-meta-line">
                <span>published</span>
                <span>{formatTimestamp(post.publishedAt)}</span>
              </div>
              <div className="blog-side-meta-line">
                <span>words</span>
                <span>{contentWordCount}</span>
              </div>
            </div>
          </section>

          <section className="blog-insight-card">
            <div className="blog-insight-label">kernel note</div>
            <p className="blog-insight-quote">
              “The public node preserves signal, but the private workspace keeps the full thinking process.”
            </p>
            <div className="blog-insight-footer">
              <span>SOURCE: SECOND_BRAIN_POLICY</span>
              <Link className="blog-insight-button" href="/write">
                OPEN_CMS
              </Link>
            </div>
          </section>

          <section className="blog-side-card">
            <h2 className="blog-side-card-title">Other logs</h2>
            <div className="blog-other-posts">
              {relatedPosts.length === 0 ? (
                <div className="blog-terminal-output">No additional public nodes yet.</div>
              ) : (
                relatedPosts.map((item) => (
                  <Link className="blog-other-post" href={`/blog/${item.slug}`} key={item.id}>
                    <h3 className="blog-other-post-title">{item.title}</h3>
                    <div className="blog-other-post-meta">{formatTimestamp(item.publishedAt)}</div>
                  </Link>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
