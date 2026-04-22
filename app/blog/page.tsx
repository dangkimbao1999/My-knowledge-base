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
    day: "2-digit"
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

  const pinnedPosts = posts.filter((post) => post.pinSlot !== null);
  const recentPosts = posts.filter((post) => post.pinSlot === null);

  const primaryPinned = pinnedPosts[0] ?? null;
  const secondaryPinned = pinnedPosts.slice(1, 4);
  const tertiaryPinned = pinnedPosts.slice(4, 12);
  const publicLogs = recentPosts.slice(0, 9);

  return (
    <div className="blog-page">
      <section className="blog-hero" id="connect">
        <div className="blog-hero-copy">
          <div className="blog-section-tag">Role: Product Architect</div>
          <h1 className="blog-hero-title">
            The Bridge Between <span className="blog-hero-accent">Logic</span> and{" "}
            <span className="blog-hero-highlight">Value.</span>
          </h1>
          <p className="blog-hero-description">
            Tôi không chỉ xây dựng phần mềm; tôi thiết kế các giải pháp tài chính lai kết nối Web3, AI
            và giá trị thực xã hội. Bằng cách giải quyết sự đứt gãy giữa Kinh doanh và Kỹ thuật, tôi
            kiến tạo những sản phẩm có tính khả thi tuyệt đối.
          </p>
        </div>

        <div className="blog-hero-chat">
          <PublicBlogChat />
        </div>
      </section>

      {activePath ? (
        <section className="blog-filter-banner">
          <div>
            <div className="blog-section-tag">Filter Active</div>
            <strong className="blog-filter-text">Showing only public posts from `{activePath}`</strong>
          </div>
          <Link className="blog-filter-clear" href="/blog">
            Clear Filter
          </Link>
        </section>
      ) : null}

      {pinnedPosts.length > 0 ? (
        <section className="blog-pinned-section">
          <div className="blog-section-header">
            <div>
              <div className="blog-section-tag">Pinned Layer</div>
              <h2 className="blog-section-title">Signals I want visitors to see first</h2>
            </div>
            <span className="blog-section-note">HOME_SIGNAL: {String(pinnedPosts.length).padStart(2, "0")}</span>
          </div>

          <div className="blog-pinned-layout">
            <div className="blog-pinned-column blog-pinned-column-featured">
              {primaryPinned ? (
                <Link className="blog-pinned-feature" href={`/blog/${primaryPinned.slug}`}>
                  <div className="blog-pinned-feature-frame">
                    <div className="blog-pinned-pill">Highlight</div>
                    <div className="blog-pinned-feature-path">{primaryPinned.logicalPath ?? "uncategorized"}</div>
                  </div>
                  <div className="blog-pinned-feature-body">
                    <h3 className="blog-pinned-feature-title">{primaryPinned.title}</h3>
                    <p className="blog-pinned-feature-description">
                      {primaryPinned.description || "No excerpt available yet."}
                    </p>
                    <div className="blog-pinned-feature-meta">{formatShortDate(primaryPinned.publishedAt)}</div>
                  </div>
                </Link>
              ) : null}
            </div>

            <div className="blog-pinned-column blog-pinned-column-secondary">
              {secondaryPinned.length > 0 ? (
                secondaryPinned.map((post) => (
                  <Link className="blog-pinned-secondary-card" href={`/blog/${post.slug}`} key={post.id}>
                    <div className="blog-pinned-secondary-media">
                      <div className="blog-pinned-pill subtle">Pinned</div>
                      <span>{post.logicalPath ?? "uncategorized"}</span>
                    </div>
                    <div className="blog-pinned-secondary-body">
                      <h3 className="blog-pinned-secondary-title">{post.title}</h3>
                      <p className="blog-pinned-secondary-description">
                        {post.description || "No excerpt available yet."}
                      </p>
                      <div className="blog-pinned-secondary-meta">{formatShortDate(post.publishedAt)}</div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="blog-empty-card">Pin a few more posts to populate the secondary layer.</div>
              )}
            </div>

            <div className="blog-pinned-column blog-pinned-column-tertiary">
              {tertiaryPinned.length > 0 ? (
                tertiaryPinned.map((post) => (
                  <Link className="blog-pinned-tertiary-item" href={`/blog/${post.slug}`} key={post.id}>
                    <div className="blog-pinned-tertiary-copy">
                      <h3 className="blog-pinned-tertiary-title">{post.title}</h3>
                      <p className="blog-pinned-tertiary-meta">
                        {post.logicalPath ?? "uncategorized"} — {formatShortDate(post.publishedAt)}
                      </p>
                    </div>
                    <div className="blog-pinned-tertiary-thumb" aria-hidden="true">
                      {post.title.slice(0, 2).toUpperCase()}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="blog-empty-card">Lower-priority pinned items will appear here.</div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <section className="blog-logs-section">
        <div className="blog-section-header">
          <div>
            <div className="blog-section-tag">Public Logs</div>
            <h2 className="blog-section-title">Latest published entries</h2>
          </div>
          <span className="blog-section-note">
            LIMIT: {String(publicLogs.length).padStart(2, "0")}_VISIBLE
          </span>
        </div>

        {publicLogs.length === 0 ? (
          <div className="blog-empty-card">
            {pinnedPosts.length > 0 ? "Only pinned posts are visible right now." : "No published posts yet."}
          </div>
        ) : (
          <div className="blog-logs-grid">
            {publicLogs.map((post, index) => (
              <Link className="blog-log-card" href={`/blog/${post.slug}`} key={post.id}>
                <div className="blog-log-index">{String(index + 1).padStart(2, "0")}</div>
                <div className="blog-log-body">
                  <div className="blog-log-tags">
                    <span className="blog-tag">PUBLIC_NODE</span>
                    {post.logicalPath ? <span className="blog-tag blog-tag-outline">{post.logicalPath}</span> : null}
                  </div>
                  <h3 className="blog-log-title">{post.title}</h3>
                  {post.description ? <p className="blog-log-description">{post.description}</p> : null}
                </div>
                <div className="blog-log-date">{formatShortDate(post.publishedAt)}</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="blog-narrative" id="narrative">
        <div className="blog-narrative-side">
          <div className="blog-section-tag">Narrative Log</div>
          <h2 className="blog-narrative-title">The Evolution Of A Product Architect</h2>
          <p className="blog-narrative-description">
            Phân tích hành trình từ kỹ sư phần mềm thuần túy đến người dẫn dắt sản phẩm tài chính phức
            tạp.
          </p>

          <div className="blog-takeaways-card">
            <h4 className="blog-takeaways-title">Key Takeaways</h4>
            <ul className="blog-takeaways-list">
              <li>Phân tích đa tầng để nhìn đúng bản chất vấn đề.</li>
              <li>Storytelling là cách kết nối kỹ thuật với giá trị thị trường.</li>
              <li>First principles giúp sản phẩm bền vững hơn khi scale.</li>
            </ul>
          </div>
        </div>

        <div className="blog-timeline">
          <article className="blog-timeline-item">
            <div className="blog-timeline-dot">01</div>
            <div className="blog-timeline-content">
              <h3 className="blog-timeline-title">01. Setup: The Binary Foundation</h3>
              <p className="blog-timeline-meta">Bằng kép CS (VGU & Frankfurt) | Netcompany | Startup Culture</p>
              <p className="blog-timeline-copy">
                Mọi PO xuất sắc đều cần một nền tảng vững chắc. Với tấm bằng kép loại giỏi từ Đức, tôi
                bắt đầu sự nghiệp bằng việc xây dựng những hệ thống khắt khe nhất. Tôi hiểu từng byte dữ
                liệu vận hành thế nào. Tuy nhiên, tôi sớm nhận ra: <strong>code chỉ là công cụ, sản phẩm
                mới là giá trị cốt lõi của doanh nghiệp.</strong>
              </p>
            </div>
          </article>

          <article className="blog-timeline-item conflict">
            <div className="blog-timeline-dot">02</div>
            <div className="blog-timeline-content">
              <h3 className="blog-timeline-title blog-timeline-title-conflict">
                02. Conflict: The Audit & Strategic Pivot
              </h3>
              <p className="blog-timeline-meta blog-timeline-meta-conflict">Giai đoạn thất nghiệp: Phỏng vấn thất bại tại Zalo, Qode, ... và giao đoạn chuyển giao khó khăn</p>
              <p className="blog-timeline-copy">
                Thất bại không phải là dấu chấm hết, mà là một cơ hội mài giũa năng lực. Việc không vượt qua
                vòng tuyển dụng tại <strong>Zalo</strong> chỉ ra những lỗ hổng lớn
                trong tư duy của tôi lúc này: quá tập trung vào giải pháp \(solution space\) mà chưa đi đủ sâu về <strong>Problem space</strong> và thiếu sự sắc bén trong giao tiếp với stakeholder.
              </p>
              <div className="blog-failure-grid">
                <div className="blog-failure-card">
                  <strong>Audit Findings // Zalo</strong>
                  <span>
                    Thiếu cái nhìn bao quát về business ecosystem. Đề bài nhiều khi là <strong>hỏa mù</strong> nếu vội vã và không cắt được lớp của vấn đề, từ đó trụ cột không vững chắc và giải pháp không đủ thuyết phục
                  </span>
                </div>
                <div className="blog-failure-card">
                  <strong>Hit rate hiện chỉ có 15% </strong>
                  <span>
                    Tôi nhận ra giai đoạn vừa rồi tôi khá là lan man trong việc tìm kiếm khi chưa nghĩ kỹ ngách mình muốn theo đuổi tiếp theo, tuy nhiên bây giờ thì 100% <strong>Fintech + AI</strong> để tận dụng tốt nhất kỹ năng đã có sẵn
                  </span>
                </div>
              </div>
            </div>
          </article>

          <article className="blog-timeline-item resolution">
            <div className="blog-timeline-dot">03</div>
            <div className="blog-timeline-content">
              <h3 className="blog-timeline-title">03. Resolution: The Awakening (still waiting...)</h3>
              <p className="blog-timeline-meta">PO/PM/BA | Fintech | AI</p>
              <p className="blog-timeline-copy">
                Hãy chờ câu chuyện thành công của tôi trong giai đoạn chuyển giao này nhé
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="blog-expertise" id="knowledge">
        <div className="blog-expertise-copy">
          <div className="blog-section-tag">Expertise Matrix</div>
          <h2 className="blog-expertise-title">Fine-Tuned for Modern Finance.</h2>

          <div className="blog-expertise-list">
            <div className="blog-expertise-item">
              <h3>Web3 & Decentralized Ecosystem</h3>
              <p>
                Hiểu sâu về cơ chế đồng thuận, tokenomics và cách thế giới phi tập trung vận hành quyền sở
                hữu dữ liệu.
              </p>
            </div>

            <div className="blog-expertise-item">
              <h3>Virtual Banking Architecture</h3>
              <p>
                Xây dựng cơ chế tài chính từ truyền thống sang tài sản số, đảm bảo thanh khoản và tính tuân
                thủ.
              </p>
            </div>

            <div className="blog-expertise-item">
              <h3>Storytelling & Layered Analysis</h3>
              <p>
                Bóc tách vấn đề theo nhiều lớp và kể câu chuyện sản phẩm đủ rõ để kết nối business,
                engineering và compliance.
              </p>
            </div>
          </div>
        </div>

        <div className="blog-expertise-quote">
          <blockquote>
            "Product architecture is the way all the pieces of a product fit together to create something people actually want and can use"
          </blockquote>
          <p>Michael Ballé</p>
        </div>
      </section>

      <section className="blog-vision" id="vision">
        <div className="blog-section-tag">The 2030 Vision</div>
        <h2 className="blog-vision-title">
          Architecting the Future of <span>Hybrid Finance.</span>
        </h2>
        <p className="blog-vision-copy">
          Trong 5 năm tới, tôi muốn đứng ở điểm giao thoa giữa thế giới ảo và giá trị thật: xây dựng
          những sản phẩm tài chính vừa dẫn đầu về công nghệ, vừa đủ bền vững để tạo tác động xã hội dài
          hạn.
        </p>
        <a className="blog-primary-button" href="#connect">
          Initiate Collaboration
        </a>
      </section>
    </div>
  );
}
