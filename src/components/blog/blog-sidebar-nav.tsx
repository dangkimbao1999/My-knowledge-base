"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useSearchParams } from "next/navigation";

type BlogSidebarNavProps = {
  logicalPaths: Array<{
    logicalPath: string;
    postCount: number;
  }>;
};

export function BlogSidebarNav({ logicalPaths }: BlogSidebarNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activePath = searchParams.get("path");
  const isBlogHome = pathname === "/blog";

  return (
    <nav className="blog-sidebar-nav">
      <Link className={`blog-sidebar-link ${isBlogHome && !activePath ? "active" : ""}`} href="/blog">
        <span className="blog-sidebar-link-icon">&gt;_</span>
        <span>ROOT/all</span>
      </Link>

      <div className="blog-sidebar-section-label">LOGICAL_PATHS</div>

      {logicalPaths.length === 0 ? (
        <div className="blog-sidebar-empty">NO_PUBLIC_PATHS</div>
      ) : (
        logicalPaths.map((item) => {
          const href = `/blog?path=${encodeURIComponent(item.logicalPath)}` as Route;
          const isActive = isBlogHome && activePath === item.logicalPath;

          return (
            <Link className={`blog-sidebar-link ${isActive ? "active" : ""}`} href={href} key={item.logicalPath}>
              <span className="blog-sidebar-link-icon">::</span>
              <span>{item.logicalPath}</span>
              <span className="blog-sidebar-link-count">{String(item.postCount).padStart(2, "0")}</span>
            </Link>
          );
        })
      )}
    </nav>
  );
}
