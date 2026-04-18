import { env } from "@/config/env";
import { ApiError } from "@/lib/api";
import { createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function ensureAppUser() {
  return prisma.user.upsert({
    where: {
      username: env.APP_USERNAME
    },
    update: {
      id: env.APP_USER_ID,
      displayName: env.APP_DISPLAY_NAME,
      email: `${env.APP_USERNAME}@local.invalid`,
      passwordHash: "env-managed"
    },
    create: {
      id: env.APP_USER_ID,
      username: env.APP_USERNAME,
      displayName: env.APP_DISPLAY_NAME,
      email: `${env.APP_USERNAME}@local.invalid`,
      passwordHash: "env-managed"
    }
  });
}

export const authService = {
  async register() {
    throw new ApiError(
      "Register is disabled in single-user MVP mode. Use the username/password from the environment.",
      405
    );
  },

  async login(input: { username: string; password: string }) {
    if (input.username !== env.APP_USERNAME || input.password !== env.APP_PASSWORD) {
      throw new ApiError("Invalid username or password", 401);
    }

    const persistedUser = await ensureAppUser();
    const user = {
      id: persistedUser.id,
      username: persistedUser.username,
      displayName: persistedUser.displayName
    };

    return {
      sessionToken: createSessionToken({
        userId: user.id,
        username: user.username,
        exp: Date.now() + 1000 * 60 * 60 * 24 * 30
      }),
      user
    };
  },

  async currentUser(userId: string) {
    if (userId !== env.APP_USER_ID) {
      throw new ApiError("User not found", 404);
    }

    const user = await ensureAppUser();

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName
    };
  }
};
