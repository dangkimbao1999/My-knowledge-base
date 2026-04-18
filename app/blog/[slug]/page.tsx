import Link from "next/link";
import { renderMarkdownPreview } from "@/lib/markdown-preview";
import { blogService } from "@/modules/blog/blog.service";

export const dynamic = "force-dynamic";

type BlogDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function BlogDetailPage({ params }: BlogDetailPageProps) {
  const { slug } = await params;
  const post = await blogService.getPublicPost(slug);

  return (
    <main className="shell write-shell">
      <section className="panel topbar">
        <div>
          <p className="panel-kicker">Public Blog</p>
          <h1>{post.title}</h1>
          <p className="muted-copy">
            {post.publishedAt
              ? `Published ${new Date(post.publishedAt).toLocaleString()}`
              : "Draft"}
          </p>
        </div>
        <Link className="button-ghost" href="/blog">
          Back to blog
        </Link>
      </section>

      <section className="panel sidebar-panel">
        {post.description ? <p className="muted-copy">{post.description}</p> : null}
        <div
          className="preview"
          style={{ marginTop: 18, minHeight: "auto" }}
          dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(post.publishedContent) }}
        />
      </section>
    </main>
  );
}
