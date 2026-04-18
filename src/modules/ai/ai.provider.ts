export type SummaryOutput = {
  summaryMarkdown: string;
  model: string;
};

export type KnowledgeOutput = {
  items: Array<{
    title: string;
    content: string;
    sourceChunkId?: string;
  }>;
  model: string;
};

export interface AIProvider {
  summarize(input: { entryId: string; text: string }): Promise<SummaryOutput>;
  extractKnowledge(input: {
    entryId: string;
    text: string;
  }): Promise<KnowledgeOutput>;
}

export class StubAIProvider implements AIProvider {
  async summarize(input: { entryId: string; text: string }): Promise<SummaryOutput> {
    return {
      summaryMarkdown: `Stub summary for ${input.entryId}`,
      model: "stub-model"
    };
  }

  async extractKnowledge(input: {
    entryId: string;
    text: string;
  }): Promise<KnowledgeOutput> {
    return {
      items: [
        {
          title: "Stub knowledge",
          content: `Derived from ${input.entryId}`
        }
      ],
      model: "stub-model"
    };
  }
}
