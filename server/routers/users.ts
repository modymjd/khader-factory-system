import { eq, and, like, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { users, employees, roles, auditLogs } from "../../drizzle/schema";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logAudit } from "../db";
import { requirePermission } from "../rbac";

const createUserSchema = z.object({
  username: z.string().min(3).max(64),
  email: z.string().email().optional(),
  roleId: z.number().int(),
  fullName: z.string().min(1).max(128),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  monthlySalary: z.string().optional(),
  deductions: z.string().optional(),
  annualLeaveBalance: z.number().int().default(0),
});

const updateUserSchema = z.object({
  id: z.number().int(),
  username: z.string().min(3).max(64).optional(),
  email: z.string().email().optional(),
  roleId: z.number().int().optional(),
  fullName: z.string().min(1).max(128).optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  monthlySalary: z.string().optional(),
  deductions: z.string().optional(),
  annualLeaveBalance: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const usersRouter = router({
  // List users with filters and pagination
  list: protectedProcedure
    .use(requirePermission("users", "read"))
    .input(
      z.object({
        search: z.string().optional(),
        roleId: z.number().int().optional(),
        status: z.enum(["active", "inactive"]).optional(),
        page: z.number().int().default(1),
        limit: z.number().int().default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const offset = (input.page - 1) * input.limit;
      let query = db.select().from(users);

      // Apply filters
      const conditions = [];

      if (input.search) {
        conditions.push(
          sql`${users.username} LIKE ${`%${input.search}%`} OR ${users.email} LIKE ${`%${input.search}%`}`
        );
      }

      if (input.roleId) {
        conditions.push(eq(users.roleId, input.roleId));
      }

      if (input.status === "active") {
        conditions.push(eq(users.isActive, true));
      } else if (input.status === "inactive") {
        conditions.push(eq(users.isActive, false));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      // Get total count
      const countResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(users)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const total = countResult[0]?.count || 0;

      // Get paginated results
      const data = await query.limit(input.limit).offset(offset);

      return {
        data,
        total,
        page: input.page,
        limit: input.limit,
        pages: Math.ceil(total / input.limit),
      };
    }),

  // Get user detail
  getById: protectedProcedure
    .use(requirePermission("users", "read"))
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, input.id))
        .limit(1);

      if (!user.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      return user[0];
    }),

  // Create user
  create: protectedProcedure
    .use(requirePermission("users", "create"))
    .input(createUserSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check if username already exists
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.username, input.username))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Username already exists",
        });
      }

      // Create user
      const result = await db.insert(users).values({
        username: input.username,
        email: input.email,
        roleId: input.roleId,
        passwordHash: "", // Will be set by admin later
        isActive: true,
      });

      // Log audit
      await logAudit(
        ctx.user.id,
        "create",
        "users",
        Number(result.insertId),
        { username: input.username, email: input.email },
        ctx.req
      );

      return { id: result.insertId, ...input };
    }),

  // Update user
  update: protectedProcedure
    .use(requirePermission("users", "update"))
    .input(updateUserSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, ...updateData } = input;

      // Update user
      await db.update(users).set(updateData).where(eq(users.id, id));

      // Log audit
      await logAudit(
        ctx.user.id,
        "update",
        "users",
        id,
        updateData,
        ctx.req
      );

      return { id, ...updateData };
    }),

  // Toggle user active status
  toggleStatus: protectedProcedure
    .use(requirePermission("users", "update"))
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, input.id))
        .limit(1);

      if (!user.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const newStatus = !user[0].isActive;

      await db
        .update(users)
        .set({ isActive: newStatus })
        .where(eq(users.id, input.id));

      // Log audit
      await logAudit(
        ctx.user.id,
        "update",
        "users",
        input.id,
        { isActive: newStatus },
        ctx.req
      );

      return { id: input.id, isActive: newStatus };
    }),

  // Delete user
  delete: protectedProcedure
    .use(requirePermission("users", "delete"))
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.delete(users).where(eq(users.id, input.id));

      // Log audit
      await logAudit(
        ctx.user.id,
        "delete",
        "users",
        input.id,
        { deletedUserId: input.id },
        ctx.req
      );

      return { success: true };
    }),
});
