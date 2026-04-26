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

          <div className="blog-topbar-actions">
            <div className="blog-topbar-nav">
              <a href="#narrative">Narrative</a>
              <a href="#knowledge">Knowledge</a>
              <a href="#connect">Connect</a>
            </div>

            <div className="blog-topbar-contact">
              <a
                className="blog-contact-icon"
                href="https://www.facebook.com/bao.dangkim1999/"
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook profile"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M13.5 21v-7h2.4l.4-3h-2.8V9.2c0-.9.3-1.5 1.6-1.5h1.4V5.1c-.2 0-1.1-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.9V11H8v3h2.5v7h3Z" />
                </svg>
              </a>

              <a
                className="blog-contact-icon"
                href="https://www.linkedin.com/in/iambao/"
                target="_blank"
                rel="noreferrer"
                aria-label="LinkedIn profile"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6.8 8.3a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6ZM5.3 19V9.8h3V19h-3Zm4.9 0V9.8H13v1.3h.1c.4-.8 1.5-1.7 3.1-1.7 3.3 0 3.9 2.2 3.9 5V19h-3v-4c0-1 0-2.3-1.4-2.3s-1.7 1.1-1.7 2.2V19h-3.8Z" />
                </svg>
              </a>

              <a className="blog-contact-phone" href="tel:+84 9333 59 290">
                +84 9333 59 290
              </a>
            </div>
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
