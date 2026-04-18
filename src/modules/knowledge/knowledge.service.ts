export const knowledgeService = {
  async listKnowledge(userId: string, topicSlug?: string) {
    return {
      ownerId: userId,
      topicSlug,
      items: []
    };
  }
};
