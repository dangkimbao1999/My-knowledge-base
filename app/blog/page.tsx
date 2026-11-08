import Link from "next/link";
import { BlogSidebarNav } from "@/components/blog/blog-sidebar-nav";
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
  const [logicalPaths, blogPosts] = await Promise.all([
    blogService.listLogicalPaths(),
    blogService.listPostsByLogicalPath(activePath)
  ]);
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
          <div className="blog-section-tag">Mission: AI for every industry</div>
          <h1 className="blog-hero-title">
            Hi, I&apos;m Bao. <span className="blog-hero-accent">AI</span> for{" "}
            <span className="blog-hero-highlight">every industry.</span>
          </h1>
          <p className="blog-hero-description">
            Sứ mệnh của tôi là giúp mọi ngành ứng dụng AI vào nghiên cứu, phát minh và vận hành, để họ đạt được năng
            suất tối đa.
          </p>
        </div>

        <div className="blog-hero-chat">
          <PublicBlogChat />
        </div>
      </section>

      {activePath ? (
        <section className="blog-filter-banner">
          <div>
            <div className="blog-section-tag">Bộ lọc</div>
            <strong className="blog-filter-text">Đang hiện bài viết từ `{activePath}`</strong>
          </div>
          <Link className="blog-filter-clear" href="/blog">
            Clear Filter
          </Link>
        </section>
      ) : null}

      <div className="blog-home-grid">
        <aside className="blog-sidebar">
          <div className="blog-sidebar-stack">
            <div className="blog-sidebar-card">
              <div className="blog-sidebar-kicker">Sơ đồ thông tin</div>
              <h2 className="blog-sidebar-title">Các thư mục</h2>
              <p className="blog-sidebar-copy">Tham quan các tầng của wiki thông qua các thư mục sau.</p>
              <BlogSidebarNav logicalPaths={logicalPaths} />
            </div>

            <div className="blog-hero-card blog-sidebar-chart">
              <div className="blog-hero-card-head">
                <span className="blog-mono-label">AI_Adoption_Map</span>
                <span className="blog-status-ok">STATUS: BUILDING</span>
              </div>

              <div className="blog-metric-bars">
                <div className="blog-metric-row">
                  <span>Research</span>
                  <div className="blog-metric-track">
                    <div className="blog-metric-fill blue" style={{ width: "100%" }} />
                  </div>
                </div>
                <div className="blog-metric-row">
                  <span>Invention</span>
                  <div className="blog-metric-track">
                    <div className="blog-metric-fill indigo" style={{ width: "100%" }} />
                  </div>
                </div>
                <div className="blog-metric-row">
                  <span>Operations</span>
                  <div className="blog-metric-track">
                    <div className="blog-metric-fill gold" style={{ width: "100%" }} />
                  </div>
                </div>
              </div>

              <div className="blog-hero-quote">
                "AI sẽ là nền tảng cho sự phát triển của rất nhiều ngành. Câu hỏi không còn là có dùng AI hay không, mà
                là ai sẽ là người đi đầu."
              </div>
            </div>
          </div>
        </aside>

        <div className="blog-home-main">
          {pinnedPosts.length > 0 ? (
            <section className="blog-pinned-section">
              <div className="blog-section-header">
                <div>
                  <div className="blog-section-tag">Pinned</div>
                  <h2 className="blog-section-title">Bài viết</h2>
                </div>
                <span className="blog-section-note">Số lượng: {String(pinnedPosts.length).padStart(2, "0")}</span>
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
                    <div className="blog-empty-card">.</div>
                  )}
                </div>

                <div className="blog-pinned-column blog-pinned-column-tertiary">
                  {tertiaryPinned.length > 0 ? (
                    tertiaryPinned.map((post) => (
                      <Link className="blog-pinned-tertiary-item" href={`/blog/${post.slug}`} key={post.id}>
                        <div className="blog-pinned-tertiary-copy">
                          <h3 className="blog-pinned-tertiary-title">{post.title}</h3>
                          <p className="blog-pinned-tertiary-meta">
                            {post.logicalPath ?? "uncategorized"} - {formatShortDate(post.publishedAt)}
                          </p>
                        </div>
                        <div className="blog-pinned-tertiary-thumb" aria-hidden="true">
                          {post.title.slice(0, 2).toUpperCase()}
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="blog-empty-card">.</div>
                  )}
                </div>
              </div>
            </section>
          ) : null}

          <section className="blog-logs-section">
            <div className="blog-section-header">
              <div>
                <div className="blog-section-tag">Public</div>
                <h2 className="blog-section-title">Latest</h2>
              </div>
              <span className="blog-section-note">LIMIT: {String(publicLogs.length).padStart(2, "0")}_VISIBLE</span>
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
        </div>
      </div>

      <section className="blog-narrative" id="narrative">
        <div className="blog-narrative-side">
          <div className="blog-section-tag">Narrative Log</div>
          <h2 className="blog-narrative-title">From Builder To AI Pioneer</h2>
          <p className="blog-narrative-description">
            Hành trình từ kỹ sư phần mềm, qua product, đến sứ mệnh đưa AI vào nghiên cứu và sản xuất của mọi ngành.
          </p>

          <div className="blog-takeaways-card">
            <h4 className="blog-takeaways-title">Key Beliefs</h4>
            <ul className="blog-takeaways-list">
              <li>AI là hạ tầng nền tảng, không phải một tính năng đi kèm.</li>
              <li>Dữ liệu chuẩn hóa là điều kiện tiên quyết để AI tạo ra giá trị thật.</li>
              <li>Chuyên gia nên dành thời gian cho khám phá, không phải cho việc xử lý dữ liệu thủ công.</li>
            </ul>
          </div>
        </div>

        <div className="blog-timeline">
          <article className="blog-timeline-item">
            <div className="blog-timeline-dot">01</div>
            <div className="blog-timeline-content">
              <h3 className="blog-timeline-title">01. Foundation: Engineering &amp; Product</h3>
              <p className="blog-timeline-meta">Bằng kép CS (VGU &amp; Frankfurt) | Netcompany | Fintech</p>
              <p className="blog-timeline-copy">
                Tôi bắt đầu bằng việc xây dựng những hệ thống khắt khe, rồi bước sang product để hiểu vì sao một hệ
                thống tồn tại. Bài học lớn nhất: <strong>công nghệ chỉ có giá trị khi nó giải quyết đúng vấn đề của con người.</strong>
              </p>
            </div>
          </article>

          <article className="blog-timeline-item conflict">
            <div className="blog-timeline-dot">02</div>
            <div className="blog-timeline-content">
              <h3 className="blog-timeline-title blog-timeline-title-conflict">02. Shift: AI Changes Everything</h3>
              <p className="blog-timeline-meta blog-timeline-meta-conflict">Từ một ngành dọc đến mọi ngành</p>
              <p className="blog-timeline-copy">
                Khi làm việc với AI, tôi nhận ra nó không chỉ thay đổi một sản phẩm hay một ngành, mà thay đổi cách mọi
                ngành nghiên cứu, phát minh và vận hành. Nút thắt hiếm khi nằm ở mô hình, mà nằm ở{" "}
                <strong>dữ liệu rời rạc, quy trình thủ công và khoảng cách giữa chuyên gia với công nghệ.</strong>
              </p>
              <div className="blog-failure-grid">
                <div className="blog-failure-card">
                  <strong>Bottleneck // Data</strong>
                  <span>
                    Nhà khoa học, kỹ sư, chuyên gia vẫn dành phần lớn thời gian để <strong>làm sạch và ghép dữ liệu</strong>{" "}
                    thay vì tạo ra phát hiện mới.
                  </span>
                </div>
                <div className="blog-failure-card">
                  <strong>Opportunity // Pipelines</strong>
                  <span>
                    Hệ thống AI kết hợp <strong>data pipeline chuẩn hóa</strong> giải phóng thời gian đó, và biến dữ liệu
                    thành lợi thế cạnh tranh.
                  </span>
                </div>
              </div>
            </div>
          </article>

          <article className="blog-timeline-item resolution">
            <div className="blog-timeline-dot">03</div>
            <div className="blog-timeline-content">
              <h3 className="blog-timeline-title">03. Mission: Pioneer AI Adoption</h3>
              <p className="blog-timeline-meta">Research | Invention | Operations</p>
              <p className="blog-timeline-copy">
                Tôi muốn là người đi đầu trong việc đưa AI vào các bài toán nghiên cứu và sản xuất. Mỗi sản phẩm, mỗi
                thử nghiệm là một bước để hiểu AI thực sự làm được gì. Bạn có bài toán cần AI?{" "}
                <Link href="/blog/ideas"><strong>Gửi ý tưởng cho tôi.</strong></Link>
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="blog-expertise" id="knowledge">
        <div className="blog-expertise-copy">
          <div className="blog-section-tag">Focus Areas</div>
          <h2 className="blog-expertise-title">AI Across The Value Chain.</h2>

          <div className="blog-expertise-list">
            <div className="blog-expertise-item">
              <h3>AI for Research</h3>
              <p>
                Hệ thống AI giúp đọc, tổng hợp và kết nối tri thức, để nhà nghiên cứu đi nhanh hơn từ dữ liệu đến giả
                thuyết.
              </p>
            </div>

            <div className="blog-expertise-item">
              <h3>AI for Invention</h3>
              <p>
                Rút ngắn vòng lặp từ ý tưởng đến prototype: dùng AI để thử nghiệm, mô phỏng và build sản phẩm nhanh hơn
                bao giờ hết.
              </p>
            </div>

            <div className="blog-expertise-item">
              <h3>AI for Operations &amp; Data Pipelines</h3>
              <p>
                Chuẩn hóa dữ liệu và tự động hóa quy trình vận hành, để tổ chức đạt được năng suất tối đa thay vì tốn
                thời gian xử lý thủ công.
              </p>
            </div>
          </div>
        </div>

        <div className="blog-expertise-quote">
          <blockquote>
            &quot;Giúp mọi ngành ứng dụng AI vào nghiên cứu, phát minh và vận hành, để đạt được năng suất tối đa.&quot;
          </blockquote>
          <p>Bao</p>
        </div>
      </section>

      <section className="blog-vision" id="vision">
        <div className="blog-section-tag">The Vision</div>
        <h2 className="blog-vision-title">
          Every Industry At Its <span>Full Productivity.</span>
        </h2>
        <p className="blog-vision-copy">
          Tôi tin AI sẽ là nền tảng cho sự phát triển của rất nhiều ngành. Mục tiêu của tôi là giúp các tổ chức trong
          nghiên cứu và sản xuất adapt AI sớm, đúng cách, và đạt được năng suất tối đa của họ.
        </p>
        <a className="blog-primary-button" href="https://www.linkedin.com/in/iambao/">
          Liên hệ ngay
        </a>
      </section>
    </div>
  );
}
