import type { ReactNode } from "react";
import Link from "next/link";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./theme.css";

const blogHeadline = Space_Grotesk({
  subsets: ["latin", "vietnamese"],
  variable: "--blog-font-headline",
  weight: ["400", "500", "600", "700"]
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

export default function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${blogHeadline.variable} ${blogBody.variable} ${blogMono.variable} blog-kernel`}>
      <aside className="blog-sidebar">
        <div className="blog-sidebar-brand">
          <Link className="blog-sidebar-title" href="/blog">
            SECOND_BRAIN
          </Link>
          <div className="blog-sidebar-status">STATUS: OPERATIONAL</div>
        </div>

        <nav className="blog-sidebar-nav">
          <Link className="blog-sidebar-link active" href="/blog">
            <span className="blog-sidebar-link-icon">&gt;_</span>
            <span>ROOT/journal</span>
          </Link>
          <div className="blog-sidebar-link">
            <span className="blog-sidebar-link-icon">::</span>
            <span>ROOT/nodes</span>
          </div>
          <div className="blog-sidebar-link">
            <span className="blog-sidebar-link-icon">[]</span>
            <span>ROOT/archive</span>
          </div>
          <div className="blog-sidebar-link">
            <span className="blog-sidebar-link-icon">{`{}`}</span>
            <span>ROOT/config</span>
          </div>
        </nav>

        {/* <div className="blog-sidebar-cta">
          <Link className="blog-sidebar-button" href="/write">
            EXECUTE_NEW_NODE
          </Link>
        </div> */}

        <div className="blog-sidebar-footer">
          <div className="blog-sidebar-meta">SYSTEM_LOG</div>
          <div className="blog-sidebar-meta">V_2.4.0</div>
        </div>
      </aside>

      <div className="blog-main-shell">
        <header className="blog-topbar">
          <div className="blog-topbar-brand">BRAIN_KERNEL_v1.0</div>
          <div className="blog-topbar-nav">
            <Link className="active" href="/blog">
              journal
            </Link>
            <span>nodes</span>
            <span>config</span>
          </div>
          <div className="blog-topbar-indicators">
            <span>[term]</span>
            <span>[mem]</span>
            <span>[net]</span>
          </div>
        </header>

        {children}

        <footer className="blog-footer">
          <div className="blog-footer-left">
            <span className="blog-footer-dot" />
            <span>KERNEL_CONNECTED</span>
            <span>ENC: AES-256-GCM</span>
          </div>
          <div className="blog-footer-right">
            <span>LN: 1042</span>
            <span>COL: 12</span>
            <span className="blog-footer-accent">UTF-8</span>
          </div>
        </footer>
      </div>

      <nav className="blog-mobile-nav">
        <Link className="active" href="/blog">
          <span>JOURNAL</span>
        </Link>
        <span>NODES</span>
        <Link className="blog-mobile-nav-add" href="/write">
          +
        </Link>
        <span>ARCHIVE</span>
        <span>CONFIG</span>
      </nav>
    </div>
  );
}
