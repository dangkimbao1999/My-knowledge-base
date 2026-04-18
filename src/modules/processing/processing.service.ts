type ProcessOptions = {
  force?: boolean;
  includeRelations?: boolean;
};

export const processingService = {
  async processEntry(userId: string, entryId: string, options: ProcessOptions) {
    return {
      entryId,
      ownerId: userId,
      status: "queued",
      options
    };
  },

  async reprocessEntry(userId: string, entryId: string) {
    return {
      entryId,
      ownerId: userId,
      status: "queued",
      reason: "manual_reprocess"
    };
  },

  async getProcessingStatus(userId: string, entryId: string) {
    return {
      entryId,
      ownerId: userId,
      latestJob: null,
      currentState: "pending"
    };
  },

  async processEntryById(entryId: string) {
    return {
      entryId,
      stages: [
        "extract_source",
        "generate_summary",
        "extract_topics",
        "extract_knowledge",
        "link_relations",
        "reindex_search"
      ]
    };
  },

  async extractPdfText(fileId: string) {
    return {
      fileId,
      extracted: true
    };
  },

  async generateSummary(entryId: string) {
    return {
      entryId,
      generated: true
    };
  },

  async extractKnowledge(entryId: string) {
    return {
      entryId,
      generated: true
    };
  },

  async linkRelatedEntries(entryId: string) {
    return {
      entryId,
      linked: true
    };
  }
};
