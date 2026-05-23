import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { users, sessions } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { getUserPermissions } from "./rbac";
import { sdk } from "./_core/sdk";
import { createHash } from "crypto";

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export const authRouter = router({
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return null;

    const db = await getDb();
    if (!db) return ctx.user;

    const userDetails = await db
      .select()
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    if (!userDetails.length) return null;

    const permissions = await getUserPermissions(ctx.user.id);

    return {
      ...userDetails[0],
      permissions,
    };
  }),

  login: publicProcedure
    .input(
      z.object({
        username: z.string(),
        password: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const userRows = await db
        .select()
        .from(users)
        .where(eq(users.username, input.username))
        .limit(1);

      if (!userRows.length) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "اسم المستخدم أو كلمة المرور غير صحيحة",
        });
      }

      const user = userRows[0];

      // Verify password: compare hashed input vs stored hash
      const inputHash = hashPassword(input.password);
      if (user.passwordHash !== inputHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "اسم المستخدم أو كلمة المرور غير صحيحة",
        });
      }

      if (!user.isActive) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "هذا الحساب معطّل. تواصل مع المسؤول",
        });
      }

      // Create JWT session token (sdk.verifySession expects JWT, not raw ID)
      const jwtToken = await sdk.createSessionToken(user.openId ?? String(user.id), {
        expiresInMs: ONE_YEAR_MS,
        name: user.name || user.username,
      });

      // Store session in DB for tracking / revocation
      const expiresAt = new Date(Date.now() + ONE_YEAR_MS);
      await db.insert(sessions).values({
        id: jwtToken.slice(-128), // store last 128 chars as unique key
        userId: user.id,
        expiresAt,
        ipAddress: ctx.req.ip || null,
        userAgent: ctx.req.headers["user-agent"] || null,
      });

      // Set cookie with JWT
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, jwtToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      const { passwordHash: _ph, ...safeUser } = user;
      return { success: true, user: safeUser };
    }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, cookieOptions);
    return { success: true };
  }),
});
