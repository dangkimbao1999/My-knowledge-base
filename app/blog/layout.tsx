import type { ReactNode } from "react";
import Link from "next/link";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { BlogSidebarNav } from "@/components/blog/blog-sidebar-nav";
import { blogService } from "@/modules/blog/blog.service";
import "./theme.css";

const blogHeadline = Space_Grotesk({
  subsets: ["latin", "vietnamese"],
  variable: "--blog-font-headline",
  weight: ["500", "700"]
});

const blogBody = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--blog-font-body",
  weight: ["400", "500", "600", "700"]
});

const blogMono = JetBrains_Mono({
  subsets: ["latin", "vietnamese"],
  variable: "--blog-font-mono",
  weight: ["400", "500", "700"]
});

export const dynamic = "force-dynamic";

export default async function BlogLayout({ children }: { children: ReactNode }) {
  const logicalPaths = await blogService.listLogicalPaths();

  return (
    <div className={`${blogHeadline.variable} ${blogBody.variable} ${blogMono.variable} blog-kernel`}>
      <nav className="blog-topbar">
        <div className="blog-topbar-inner">
          <Link className="blog-brand" href="/blog">
            <span className="blog-brand-mark">B</span>
            <span className="blog-brand-text">
              DANGK <span>/ SECOND BRAIN</span>
            </span>
          </Link>

          <div className="blog-topbar-nav">
            <a href="#narrative">Narrative</a>
            <a href="#knowledge">Knowledge</a>
            <a href="#connect">Connect</a>
          </div>
        </div>
      </nav>

      <div className="blog-shell">
        <aside className="blog-sidebar">
          <div className="blog-sidebar-stack">
            <div className="blog-sidebar-card">
              <div className="blog-sidebar-kicker">Public knowledge map</div>
              <h2 className="blog-sidebar-title">Logical Paths</h2>
              <p className="blog-sidebar-copy">
                Navigate the public layer of the wiki through curated paths and filtered topic clusters.
              </p>
              <BlogSidebarNav logicalPaths={logicalPaths} />
            </div>

            <div className="blog-hero-card blog-sidebar-chart">
              <div className="blog-hero-card-head">
                <span className="blog-mono-label">Architectural_Alignment_Chart</span>
                <span className="blog-status-ok">STATUS: STABLE</span>
              </div>

              <div className="blog-metric-bars">
                <div className="blog-metric-row">
                  <span>Product</span>
                  <div className="blog-metric-track">
                    <div className="blog-metric-fill blue" style={{ width: "88%" }} />
                  </div>
                </div>
                <div className="blog-metric-row">
                  <span>Engineering</span>
                  <div className="blog-metric-track">
                    <div className="blog-metric-fill indigo" style={{ width: "100%" }} />
                  </div>
                </div>
                <div className="blog-metric-row">
                  <span>Finance</span>
                  <div className="blog-metric-track">
                    <div className="blog-metric-fill gold" style={{ width: "92%" }} />
                  </div>
                </div>
              </div>

              <div className="blog-hero-quote">
                "Một Product Owner giỏi trong Fintech không chỉ nói về cái gì, mà còn phải hiểu như thế
                nào và tại sao ở mọi tầng kiến trúc."
              </div>
            </div>
          </div>
        </aside>

        <main className="blog-main-shell">{children}</main>
      </div>

      <footer className="blog-footer">
        <div className="blog-footer-inner">
          <div className="blog-footer-links">
            <span>Product Architecture</span>
            <span>AI Systems</span>
            <span>Knowledge Design</span>
          </div>
          <div className="blog-footer-meta">2026 // SECOND_BRAIN_BLUEPRINT</div>
        </div>
      </footer>
    </div>
  );
}
