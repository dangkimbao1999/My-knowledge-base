import { routeHandler } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { filesService } from "@/modules/files/files.service";

export async function POST(request: Request) {
  return routeHandler(async () => {
    const auth = await requireAuth();
    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      throw new Error("Missing image file.");
    }

    return filesService.uploadImage(auth.userId, image);
  });
}
