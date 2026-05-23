import { eq, and, desc, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { employees, salaryTransactions, leaveRequests, users } from "../../drizzle/schema";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logAudit } from "../db";

export const salaryRouter = router({
  // List salary transactions
  list: protectedProcedure
    .input(z.object({
      employeeId: z.number().int().optional(),
      month: z.string().optional(),
      status: z.enum(["pending", "paid"]).optional(),
      page: z.number().int().default(1),
      limit: z.number().int().default(10),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const offset = (input.page - 1) * input.limit;
      const conditions = [];
      if (input.employeeId) conditions.push(eq(salaryTransactions.employeeId, input.employeeId));
      if (input.month) conditions.push(eq(salaryTransactions.month, input.month));
      if (input.status) conditions.push(eq(salaryTransactions.status, input.status));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [countResult, data] = await Promise.all([
        db.select({ count: sql<number>`COUNT(*)` }).from(salaryTransactions).where(whereClause),
        db.select({
          id: salaryTransactions.id,
          employeeId: salaryTransactions.employeeId,
          employeeName: employees.fullName,
          department: employees.department,
          month: salaryTransactions.month,
          baseSalary: salaryTransactions.baseSalary,
          deductions: salaryTransactions.deductions,
          bonuses: salaryTransactions.bonuses,
          netSalary: salaryTransactions.netSalary,
          status: salaryTransactions.status,
          notes: salaryTransactions.notes,
          paidAt: salaryTransactions.paidAt,
          createdAt: salaryTransactions.createdAt,
        })
        .from(salaryTransactions)
        .leftJoin(employees, eq(salaryTransactions.employeeId, employees.id))
        .where(whereClause)
        .orderBy(desc(salaryTransactions.createdAt))
        .limit(input.limit).offset(offset),
      ]);

      return {
        data,
        total: countResult[0]?.count || 0,
        pages: Math.ceil((countResult[0]?.count || 0) / input.limit),
      };
    }),

  // Create salary transaction
  create: protectedProcedure
    .input(z.object({
      employeeId: z.number().int(),
      month: z.string().regex(/^\d{4}-\d{2}$/),
      baseSalary: z.string(),
      deductions: z.string().default("0"),
      bonuses: z.string().default("0"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const net = parseFloat(input.baseSalary) - parseFloat(input.deductions) + parseFloat(input.bonuses);

      const result = await db.insert(salaryTransactions).values({
        employeeId: input.employeeId,
        month: input.month,
        baseSalary: input.baseSalary,
        deductions: input.deductions,
        bonuses: input.bonuses,
        netSalary: net.toFixed(2),
        notes: input.notes,
        status: "pending",
      });

      await logAudit(ctx.user.id, "create", "salary", Number(result.insertId), input, ctx.req);
      return { id: Number(result.insertId), success: true };
    }),

  // Mark salary as paid
  markPaid: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.update(salaryTransactions).set({
        status: "paid",
        paidAt: new Date(),
      }).where(eq(salaryTransactions.id, input.id));

      await logAudit(ctx.user.id, "update", "salary", input.id, { status: "paid" }, ctx.req);
      return { success: true };
    }),

  // Delete salary transaction
  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(salaryTransactions).where(eq(salaryTransactions.id, input.id));
      return { success: true };
    }),

  // Get summary for all employees
  getSummary: protectedProcedure
    .input(z.object({ month: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const summary = await db.select({
        totalEmployees: sql<number>`COUNT(DISTINCT ${salaryTransactions.employeeId})`,
        totalPaid: sql<number>`SUM(CASE WHEN ${salaryTransactions.status} = 'paid' THEN CAST(${salaryTransactions.netSalary} AS DECIMAL(12,2)) ELSE 0 END)`,
        totalPending: sql<number>`SUM(CASE WHEN ${salaryTransactions.status} = 'pending' THEN CAST(${salaryTransactions.netSalary} AS DECIMAL(12,2)) ELSE 0 END)`,
        paidCount: sql<number>`SUM(CASE WHEN ${salaryTransactions.status} = 'paid' THEN 1 ELSE 0 END)`,
        pendingCount: sql<number>`SUM(CASE WHEN ${salaryTransactions.status} = 'pending' THEN 1 ELSE 0 END)`,
      }).from(salaryTransactions).where(eq(salaryTransactions.month, input.month));

      return summary[0];
    }),

  // Generate monthly salaries for all employees
  generateMonthly: protectedProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const allEmployees = await db.select().from(employees);
      let created = 0;

      for (const emp of allEmployees) {
        if (!emp.monthlySalary) continue;

        const existing = await db.select().from(salaryTransactions)
          .where(and(eq(salaryTransactions.employeeId, emp.id), eq(salaryTransactions.month, input.month)))
          .limit(1);

        if (existing.length > 0) continue;

        const base = parseFloat(String(emp.monthlySalary));
        const ded = parseFloat(String(emp.deductions || 0));
        const net = base - ded;

        await db.insert(salaryTransactions).values({
          employeeId: emp.id,
          month: input.month,
          baseSalary: base.toFixed(2),
          deductions: ded.toFixed(2),
          bonuses: "0.00",
          netSalary: net.toFixed(2),
          status: "pending",
        });
        created++;
      }

      return { created, message: `تم إنشاء ${created} سجل راتب` };
    }),

  // --- Leave Requests ---
  leaveList: protectedProcedure
    .input(z.object({
      employeeId: z.number().int().optional(),
      status: z.enum(["pending", "approved", "rejected"]).optional(),
      page: z.number().int().default(1),
      limit: z.number().int().default(10),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const offset = (input.page - 1) * input.limit;
      const conditions = [];
      if (input.employeeId) conditions.push(eq(leaveRequests.employeeId, input.employeeId));
      if (input.status) conditions.push(eq(leaveRequests.status, input.status));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [countResult, data] = await Promise.all([
        db.select({ count: sql<number>`COUNT(*)` }).from(leaveRequests).where(whereClause),
        db.select({
          id: leaveRequests.id,
          employeeId: leaveRequests.employeeId,
          employeeName: employees.fullName,
          type: leaveRequests.type,
          startDate: leaveRequests.startDate,
          endDate: leaveRequests.endDate,
          days: leaveRequests.days,
          status: leaveRequests.status,
          reason: leaveRequests.reason,
          createdAt: leaveRequests.createdAt,
        })
        .from(leaveRequests)
        .leftJoin(employees, eq(leaveRequests.employeeId, employees.id))
        .where(whereClause)
        .orderBy(desc(leaveRequests.createdAt))
        .limit(input.limit).offset(offset),
      ]);

      return {
        data,
        total: countResult[0]?.count || 0,
        pages: Math.ceil((countResult[0]?.count || 0) / input.limit),
      };
    }),

  leaveCreate: protectedProcedure
    .input(z.object({
      employeeId: z.number().int(),
      type: z.enum(["annual", "sick", "unpaid", "emergency"]),
      startDate: z.date(),
      endDate: z.date(),
      days: z.number().int(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db.insert(leaveRequests).values(input);
      await logAudit(ctx.user.id, "create", "leave", Number(result.insertId), input, ctx.req);
      return { id: Number(result.insertId), success: true };
    }),

  leaveUpdateStatus: protectedProcedure
    .input(z.object({
      id: z.number().int(),
      status: z.enum(["approved", "rejected"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.update(leaveRequests).set({
        status: input.status,
        approvedBy: ctx.user.id,
      }).where(eq(leaveRequests.id, input.id));

      // If approved, deduct from annual leave balance
      if (input.status === "approved") {
        const leave = await db.select().from(leaveRequests).where(eq(leaveRequests.id, input.id)).limit(1);
        if (leave.length && leave[0].type === "annual") {
          await db.update(employees)
            .set({ annualLeaveBalance: sql`${employees.annualLeaveBalance} - ${leave[0].days}` })
            .where(eq(employees.id, leave[0].employeeId));
        }
      }

      await logAudit(ctx.user.id, "update", "leave", input.id, { status: input.status }, ctx.req);
      return { success: true };
    }),
});
