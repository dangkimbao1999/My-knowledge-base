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
      <Link className={`blog-path-link ${isBlogHome && !activePath ? "active" : ""}`} href="/blog">
        <span className="blog-path-label">All public posts</span>
        <span className="blog-path-count">00</span>
      </Link>

      {logicalPaths.length === 0 ? (
        <div className="blog-sidebar-empty">No public paths yet.</div>
      ) : (
        logicalPaths.map((item) => {
          const href = `/blog?path=${encodeURIComponent(item.logicalPath)}` as Route;
          const isActive = isBlogHome && activePath === item.logicalPath;

          return (
            <Link className={`blog-path-link ${isActive ? "active" : ""}`} href={href} key={item.logicalPath}>
              <span className="blog-path-label">{item.logicalPath}</span>
              <span className="blog-path-count">{String(item.postCount).padStart(2, "0")}</span>
            </Link>
          );
        })
      )}
    </nav>
  );
}
