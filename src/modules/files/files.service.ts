import { ApiError } from "@/lib/api";
import { uploadImageToR2 } from "@/modules/files/r2-storage";

export const filesService = {
  async uploadPdf(userId: string, input: Record<string, unknown>) {
    return {
      id: crypto.randomUUID(),
      ownerId: userId,
      storageKey: `uploads/${crypto.randomUUID()}.pdf`,
      ...input
    };
  },

  async attachPdf(userId: string, input: Record<string, unknown>) {
    return {
      ownerId: userId,
      ...input,
      attached: true
    };
  },

  async getFileMetadata(userId: string, fileId: string) {
    return {
      id: fileId,
      ownerId: userId,
      mimeType: "application/pdf",
      processingState: "pending"
    };
  },

  async uploadImage(userId: string, file: File) {
    if (!file.size) {
      throw new ApiError("Image file is empty.");
    }

    const uploaded = await uploadImageToR2({
      body: new Uint8Array(await file.arrayBuffer()),
      contentType: file.type,
      fileName: file.name || `image-${crypto.randomUUID()}.png`
    });

    return {
      ownerId: userId,
      mimeType: file.type,
      sizeBytes: file.size,
      storageKey: uploaded.key,
      url: uploaded.url
    };
  }
};
