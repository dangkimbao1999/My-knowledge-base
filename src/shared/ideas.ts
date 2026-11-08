import { z } from "zod";

export const IDEA_STATUSES = [
  "unread",
  "read",
  "selected",
  "contacted",
  "in_progress",
  "delivered",
  "rejected"
] as const;

export const IDEA_STATUS_LABELS: Record<(typeof IDEA_STATUSES)[number], string> = {
  unread: "Chưa đọc",
  read: "Đã đọc",
  selected: "Được chọn",
  contacted: "Đã liên hệ",
  in_progress: "Đang làm",
  delivered: "Delivered",
  rejected: "Reject"
};

export const createIdeaSchema = z.object({
  title: z.string().trim().min(3).max(200),
  descriptionHtml: z.string().min(1).max(100_000),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  contact: z.string().trim().max(300).optional(),
  website: z.string().optional() // honeypot: humans never see or fill this
});

export const updateIdeaStatusSchema = z.object({
  status: z.enum(IDEA_STATUSES)
});
