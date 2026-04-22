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
  const [post, posts] = await Promise.all([blogService.getPublicPost(slug), blogService.listPosts()]);

  const relatedPosts = posts.items.filter((item) => item.slug !== slug).slice(0, 4);
  const contentWordCount = post.publishedContent.trim() ? post.publishedContent.trim().split(/\s+/).length : 0;

  return (
    <div className="blog-page">
      <section className="blog-detail-hero">
        <div className="blog-section-tag">Public Node</div>
        <h1 className="blog-detail-title">{post.title}</h1>
        {post.description ? <p className="blog-detail-description">{post.description}</p> : null}
      </section>

      <div className="blog-detail-grid">
        <article className="blog-detail-main">
          <Link className="blog-back-link" href="/blog">
            Back To Public Log
          </Link>

          <div
            className="preview blog-article-preview"
            dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(post.publishedContent) }}
          />
        </article>

        <aside className="blog-detail-side">
          <section className="blog-side-card">
            <h2 className="blog-side-card-title">Node Metadata</h2>
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

          <section className="blog-side-card">
            <h2 className="blog-side-card-title">Other Public Logs</h2>
            <div className="blog-other-posts">
              {relatedPosts.length === 0 ? (
                <div className="blog-empty-card">No additional public nodes yet.</div>
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
    </div>
  );
}
