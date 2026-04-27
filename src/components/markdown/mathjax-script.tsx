"use client";

import Script from "next/script";

export function MathJaxScript() {
  return (
    <>
      <Script id="mathjax-config" strategy="beforeInteractive">
        {`
          window.MathJax = {
            tex: {
              inlineMath: [["$", "$"], ["\\\\(", "\\\\)"]],
              displayMath: [["$$", "$$"], ["\\\\[", "\\\\]"]],
              processEscapes: true
            },
            options: {
              skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"]
            },
            svg: {
              fontCache: "global"
            }
          };
        `}
      </Script>
      <Script
        id="mathjax-runtime"
        src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"
        strategy="afterInteractive"
        onReady={() => {
          window.dispatchEvent(new Event("mathjax-ready"));
        }}
      />
    </>
  );
}
