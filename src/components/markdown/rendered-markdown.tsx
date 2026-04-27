"use client";

import type { ComponentPropsWithoutRef } from "react";
import { useEffect, useRef } from "react";

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

export function RenderedMarkdown({ html, ...props }: RenderedMarkdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
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
  }, [html]);

  return <div {...props} dangerouslySetInnerHTML={{ __html: html }} ref={containerRef} />;
}
