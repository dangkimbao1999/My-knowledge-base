import { ImageResponse } from "next/og";
import { blogService } from "@/modules/blog/blog.service";

export const alt = "Second Brain Journal article preview";
export const contentType = "image/png";
export const size = {
  width: 1200,
  height: 630
};
export const dynamic = "force-dynamic";

type OpenGraphImageProps = {
  params: Promise<{ slug: string }>;
};

function buildDescription(description: string | null, content: string) {
  if (description?.trim()) {
    return description.trim();
  }

  return content.replace(/\s+/g, " ").trim().slice(0, 180);
}

export default async function OpenGraphImage({ params }: OpenGraphImageProps) {
  const { slug } = await params;
  const post = await blogService.getPublicPost(slug);
  const description = buildDescription(post.description, post.publishedContent);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px",
          background:
            "radial-gradient(circle at top right, rgba(59,130,246,0.24), transparent 28%), linear-gradient(135deg, #f8fbff 0%, #eef4ff 55%, #f8fafc 100%)",
          color: "#0f172a",
          fontFamily: "sans-serif"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            color: "#1d4ed8",
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase"
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "#facc15"
            }}
          />
          Second Brain Journal
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "28px"
          }}
        >
          <div
            style={{
              fontSize: 68,
              lineHeight: 1.04,
              fontWeight: 800,
              letterSpacing: "-0.05em",
              display: "-webkit-box",
              overflow: "hidden",
              WebkitLineClamp: 4,
              WebkitBoxOrient: "vertical"
            }}
          >
            {post.title}
          </div>

          <div
            style={{
              maxWidth: 920,
              color: "#475569",
              fontSize: 30,
              lineHeight: 1.45,
              display: "-webkit-box",
              overflow: "hidden",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical"
            }}
          >
            {description}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#1e3a8a",
            fontSize: 24,
            fontWeight: 700
          }}
        >
          <div>{post.slug}</div>
          <div>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("vi-VN") : "Draft"}</div>
        </div>
      </div>
    ),
    size
  );
}
