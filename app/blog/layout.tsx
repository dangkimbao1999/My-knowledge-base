import type { ReactNode } from "react";
import Link from "next/link";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
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

      <div className="blog-shell">{children}</div>

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
