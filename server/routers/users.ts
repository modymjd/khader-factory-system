import { eq, and, like, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { users, employees, roles, auditLogs } from "../../drizzle/schema";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logAudit } from "../db";
import { requirePermission } from "../rbac";
import { createHash } from "crypto";

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

const createUserSchema = z.object({
  username: z.string().min(3).max(64),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  address: z.string().optional(),
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
  password: z.string().min(6).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
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
  list: protectedProcedure
    .use(requirePermission("users", "read"))
    .input(z.object({
      search: z.string().optional(),
      roleId: z.number().int().optional(),
      status: z.enum(["active", "inactive"]).optional(),
      page: z.number().int().default(1),
      limit: z.number().int().default(10),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const offset = (input.page - 1) * input.limit;
      const conditions = [];

      if (input.search) {
        conditions.push(sql`${users.username} LIKE ${`%${input.search}%`} OR ${users.email} LIKE ${`%${input.search}%`} OR ${users.name} LIKE ${`%${input.search}%`}`);
      }
      if (input.roleId) conditions.push(eq(users.roleId, input.roleId));
      if (input.status === "active") conditions.push(eq(users.isActive, true));
      else if (input.status === "inactive") conditions.push(eq(users.isActive, false));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [countResult, data] = await Promise.all([
        db.select({ count: sql<number>`COUNT(*)` }).from(users).where(whereClause),
        db.select({
          id: users.id,
          username: users.username,
          email: users.email,
          phone: users.phone,
          address: users.address,
          name: users.name,
          role: users.role,
          roleId: users.roleId,
          isActive: users.isActive,
          createdAt: users.createdAt,
          lastSignedIn: users.lastSignedIn,
        }).from(users).where(whereClause).limit(input.limit).offset(offset),
      ]);

      return {
        data,
        total: countResult[0]?.count || 0,
        page: input.page,
        limit: input.limit,
        pages: Math.ceil((countResult[0]?.count || 0) / input.limit),
      };
    }),

  getById: protectedProcedure
    .use(requirePermission("users", "read"))
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const user = await db.select().from(users).where(eq(users.id, input.id)).limit(1);
      if (!user.length) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      const { passwordHash: _, ...safeUser } = user[0];
      return safeUser;
    }),

  create: protectedProcedure
    .use(requirePermission("users", "create"))
    .input(createUserSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existing = await db.select().from(users).where(eq(users.username, input.username)).limit(1);
      if (existing.length > 0) throw new TRPCError({ code: "CONFLICT", message: "اسم المستخدم موجود مسبقاً" });

      const emailCheck = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
      if (emailCheck.length > 0) throw new TRPCError({ code: "CONFLICT", message: "البريد الإلكتروني موجود مسبقاً" });

      const result = await db.insert(users).values({
        username: input.username,
        email: input.email,
        passwordHash: hashPassword(input.password),
        phone: input.phone,
        address: input.address,
        roleId: input.roleId,
        name: input.fullName,
        isActive: true,
      });

      // Create employee record
      await db.insert(employees).values({
        userId: parseInt(String(result.insertId)),
        fullName: input.fullName,
        jobTitle: input.jobTitle,
        department: input.department,
        monthlySalary: input.monthlySalary,
        deductions: input.deductions || "0.00",
        annualLeaveBalance: input.annualLeaveBalance,
      });

      await logAudit(ctx.user.id, "create", "users", parseInt(String(result.insertId)), { username: input.username }, ctx.req);

      return { id: parseInt(String(result.insertId)), success: true };
    }),

  update: protectedProcedure
    .use(requirePermission("users", "update"))
    .input(updateUserSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, password, fullName, jobTitle, department, monthlySalary, deductions, annualLeaveBalance, ...userFields } = input;

      // Update password if provided
      if (password) {
        (userFields as any).passwordHash = hashPassword(password);
      }
      if (fullName) (userFields as any).name = fullName;

      if (Object.keys(userFields).length > 0) {
        await db.update(users).set(userFields).where(eq(users.id, id));
      }

      // Update employee record if exists
      if (fullName || jobTitle !== undefined || department !== undefined || monthlySalary !== undefined) {
        const emp = await db.select().from(employees).where(eq(employees.userId, id)).limit(1);
        if (emp.length > 0) {
          const empUpdate: any = {};
          if (fullName) empUpdate.fullName = fullName;
          if (jobTitle !== undefined) empUpdate.jobTitle = jobTitle;
          if (department !== undefined) empUpdate.department = department;
          if (monthlySalary !== undefined) empUpdate.monthlySalary = monthlySalary;
          if (deductions !== undefined) empUpdate.deductions = deductions;
          if (annualLeaveBalance !== undefined) empUpdate.annualLeaveBalance = annualLeaveBalance;
          await db.update(employees).set(empUpdate).where(eq(employees.userId, id));
        }
      }

      await logAudit(ctx.user.id, "update", "users", id, input, ctx.req);
      return { id, success: true };
    }),

  toggleStatus: protectedProcedure
    .use(requirePermission("users", "update"))
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const user = await db.select().from(users).where(eq(users.id, input.id)).limit(1);
      if (!user.length) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      const newStatus = !user[0].isActive;
      await db.update(users).set({ isActive: newStatus }).where(eq(users.id, input.id));
      await logAudit(ctx.user.id, "update", "users", input.id, { isActive: newStatus }, ctx.req);
      return { id: input.id, isActive: newStatus };
    }),

  delete: protectedProcedure
    .use(requirePermission("users", "delete"))
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.delete(users).where(eq(users.id, input.id));
      await logAudit(ctx.user.id, "delete", "users", input.id, { deletedUserId: input.id }, ctx.req);
      return { success: true };
    }),
});
