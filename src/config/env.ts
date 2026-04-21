import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  APP_USERNAME: z.string().min(1),
  APP_PASSWORD: z.string().min(1),
  APP_USER_ID: z.string().min(1).default("local-user"),
  APP_DISPLAY_NAME: z.string().min(1).default("Local User"),
  STORAGE_MODE: z.enum(["local", "s3"]).default("local"),
  UPLOAD_ROOT: z.string().default("./uploads"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_API_BASE: z.string().url().default("https://api.openai.com/v1"),
  LLM_MODEL: z.string().default("gpt-5.4-mini"),
  EMBEDDING_MODEL: z.string().optional(),
  OPENAI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),
  APP_URL: z.string().url().default("http://localhost:3000")
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  APP_USERNAME: process.env.APP_USERNAME,
  APP_PASSWORD: process.env.APP_PASSWORD,
  APP_USER_ID: process.env.APP_USER_ID,
  APP_DISPLAY_NAME: process.env.APP_DISPLAY_NAME,
  STORAGE_MODE: process.env.STORAGE_MODE,
  UPLOAD_ROOT: process.env.UPLOAD_ROOT,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_API_BASE: process.env.OPENAI_API_BASE,
  LLM_MODEL: process.env.LLM_MODEL,
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL,
  OPENAI_TEMPERATURE: process.env.OPENAI_TEMPERATURE,
  APP_URL: process.env.APP_URL
});
