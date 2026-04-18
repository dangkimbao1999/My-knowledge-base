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
  }
};
