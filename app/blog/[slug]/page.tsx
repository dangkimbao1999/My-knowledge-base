import type { Metadata } from "next";
import Link from "next/link";
import { RenderedMarkdown } from "@/components/markdown/rendered-markdown";
import { renderMarkdownPreview } from "@/lib/markdown-preview";
import { blogService } from "@/modules/blog/blog.service";

export const dynamic = "force-dynamic";

type BlogDetailPageProps = {
  params: Promise<{ slug: string }>;
};

function buildPostDescription(description: string | null, content: string) {
  if (description?.trim()) {
    return description.trim();
  }

  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.slice(0, 160);
}

export async function generateMetadata({ params }: BlogDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await blogService.getPublicPost(slug);
  const description = buildPostDescription(post.description, post.publishedContent);
  const url = `/blog/${post.slug}`;

  return {
    title: post.title,
    description,
    alternates: {
      canonical: url
    },
    openGraph: {
      title: post.title,
      description,
      url,
      type: "article",
      publishedTime: post.publishedAt ?? undefined,
      siteName: "Second Brain Journal",
      images: [
        {
          url: `${url}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: post.title
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images: [`${url}/opengraph-image`]
    }
  };
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "UNPUBLISHED";
  }

  return new Date(value).toLocaleString("vi-VN");
}

export default async function BlogDetailPage({ params }: BlogDetailPageProps) {
  const { slug } = await params;
  const [post, relatedPosts] = await Promise.all([
    blogService.getPublicPost(slug),
    blogService.listRelatedPosts(slug, 4)
  ]);
  const wikiLinkMap = await blogService.resolvePublicWikiLinkMap(post.publishedContent);
  const contentWordCount = post.publishedContent.trim() ? post.publishedContent.trim().split(/\s+/).length : 0;

  return (
    <div className="blog-page">
      <section className="blog-detail-hero">
        <div className="blog-section-tag">Public Node</div>
        <Link className="blog-back-link" href="/blog">
            Back To Public Log
        </Link>
        <h1 className="blog-detail-title">{post.title}</h1>
        {post.description ? <p className="blog-detail-description">{post.description}</p> : null}
      </section>

      <div className="blog-detail-grid">
        <article className="blog-detail-main">
          <RenderedMarkdown
            className="preview blog-article-preview"
            html={renderMarkdownPreview(post.publishedContent, {
              resolveWikiLink: (targetTitle) => ({
                href: wikiLinkMap[targetTitle.trim().toLowerCase()] ?? null
              })
            })}
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
