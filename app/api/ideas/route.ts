import { parseJson, routeHandler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createIdeaSchema } from "@/shared/ideas";

// ponytail: public endpoint guarded only by honeypot + size limits; add IP rate limit if spam shows up.
export async function POST(request: Request) {
  return routeHandler(async () => {
    const { website, contact, ...input } = await parseJson(request, createIdeaSchema);

    if (website) {
      return { id: null };
    }

    const idea = await prisma.ideaSubmission.create({
      data: { ...input, contact: contact || null },
      select: { id: true }
    });
    return idea;
  }, { status: 201 });
}

export async function GET() {
  return routeHandler(async () => {
    await requireAuth();
    return prisma.ideaSubmission.findMany({ orderBy: { createdAt: "desc" } });
  });
}
