import { parseJson, routeHandler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateIdeaStatusSchema } from "@/shared/ideas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return routeHandler(async () => {
    await requireAuth();
    const { id } = await params;
    const { status } = await parseJson(request, updateIdeaStatusSchema);
    return prisma.ideaSubmission.update({ where: { id }, data: { status }, select: { id: true, status: true } });
  });
}
