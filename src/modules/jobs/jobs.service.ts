export const jobsService = {
  async createJob(input: Record<string, unknown>) {
    return {
      id: crypto.randomUUID(),
      status: "queued",
      ...input
    };
  }
};
