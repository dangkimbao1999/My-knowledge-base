export const notesService = {
  async createNote(userId: string, entryId: string, input: Record<string, unknown>) {
    return {
      id: crypto.randomUUID(),
      entryId,
      ownerId: userId,
      ...input
    };
  },

  async updateNote(
    userId: string,
    entryId: string,
    noteId: string,
    input: Record<string, unknown>
  ) {
    return {
      id: noteId,
      entryId,
      ownerId: userId,
      ...input
    };
  },

  async deleteNote(userId: string, entryId: string, noteId: string) {
    return {
      id: noteId,
      entryId,
      ownerId: userId,
      deletedBy: userId
    };
  },

  async listNotes(userId: string, entryId: string) {
    return {
      entryId,
      ownerId: userId,
      items: []
    };
  }
};
