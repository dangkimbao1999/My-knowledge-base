"use client";

import type { ComponentPropsWithoutRef } from "react";
import { memo, useEffect, useMemo, useRef } from "react";

type MathJaxApi = {
  startup?: {
    promise?: Promise<unknown>;
  };
  typesetPromise?: (elements?: HTMLElement[]) => Promise<unknown>;
  typesetClear?: (elements?: HTMLElement[]) => void;
};

declare global {
  interface Window {
    MathJax?: MathJaxApi;
  }
}

type RenderedMarkdownProps = ComponentPropsWithoutRef<"div"> & {
  html: string;
};

function hasMathMarkup(html: string) {
  return (
    html.includes('class="math-display"') ||
    html.includes("$$") ||
    html.includes("\\(") ||
    html.includes("\\[")
  );
}

function RenderedMarkdownInner({ html, ...props }: RenderedMarkdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldTypesetMath = useMemo(() => hasMathMarkup(html), [html]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || !shouldTypesetMath) {
      return;
    }

    let isCancelled = false;

    const typeset = () => {
      const mathJax = window.MathJax;

      if (!mathJax?.typesetPromise) {
        return;
      }

      void Promise.resolve(mathJax.startup?.promise)
        .catch(() => undefined)
        .then(() => {
          if (isCancelled || !containerRef.current) {
            return;
          }

          mathJax.typesetClear?.([container]);
          return mathJax.typesetPromise?.([container]);
        })
        .catch(() => undefined);
    };

    typeset();
    window.addEventListener("mathjax-ready", typeset);

    return () => {
      isCancelled = true;
      window.removeEventListener("mathjax-ready", typeset);
      window.MathJax?.typesetClear?.([container]);
    };
  }, [html, shouldTypesetMath]);

  return <div {...props} dangerouslySetInnerHTML={{ __html: html }} ref={containerRef} />;
}

export const RenderedMarkdown = memo(RenderedMarkdownInner);
