import { eq, and, gte, lte, sql, desc, like } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { attendance, employeeQRCodes, employees } from "../../drizzle/schema";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logAudit } from "../db";
import QRCode from "qrcode";

export const attendanceRouter = router({
  // Search employees by name
  searchEmployees: protectedProcedure
    .input(z.object({ search: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const conditions = input.search
        ? [sql`${employees.fullName} LIKE ${`%${input.search}%`}`]
        : [];
      const data = await db.select({
        id: employees.id,
        fullName: employees.fullName,
        department: employees.department,
        jobTitle: employees.jobTitle,
      }).from(employees)
        .where(conditions.length > 0 ? conditions[0] : undefined)
        .limit(20);
      return data;
    }),

  // Generate or refresh QR code
  generateQRCode: protectedProcedure
    .input(z.object({ employeeId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const emp = await db.select().from(employees).where(eq(employees.id, input.employeeId)).limit(1);
      if (!emp.length) throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found" });

      const qrCodeValue = `EMP-${input.employeeId}-${emp[0].fullName.replace(/\s/g,"-")}`;
      const qrCodeDataUrl = await QRCode.toDataURL(qrCodeValue);

      const existing = await db.select().from(employeeQRCodes).where(eq(employeeQRCodes.employeeId, input.employeeId)).limit(1);

      if (existing.length > 0) {
        await db.update(employeeQRCodes).set({ qrCode: qrCodeDataUrl, qrCodeValue }).where(eq(employeeQRCodes.employeeId, input.employeeId));
      } else {
        await db.insert(employeeQRCodes).values({ employeeId: input.employeeId, qrCode: qrCodeDataUrl, qrCodeValue });
      }

      return { qrCode: qrCodeDataUrl, qrCodeValue, employeeName: emp[0].fullName };
    }),

  getQRCode: protectedProcedure
    .input(z.object({ employeeId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const qr = await db.select().from(employeeQRCodes).where(eq(employeeQRCodes.employeeId, input.employeeId)).limit(1);
      return qr.length ? qr[0] : null;
    }),

  // Get all employees QR codes
  getAllQRCodes: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    return await db.select({
      id: employees.id,
      fullName: employees.fullName,
      department: employees.department,
      qrCode: employeeQRCodes.qrCode,
      qrCodeValue: employeeQRCodes.qrCodeValue,
    }).from(employees)
      .leftJoin(employeeQRCodes, eq(employees.id, employeeQRCodes.employeeId));
  }),

  // Check in by QR
  checkInQR: protectedProcedure
    .input(z.object({ qrCodeValue: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const qr = await db.select().from(employeeQRCodes).where(eq(employeeQRCodes.qrCodeValue, input.qrCodeValue)).limit(1);
      if (!qr.length) throw new TRPCError({ code: "NOT_FOUND", message: "رمز QR غير صالح" });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existing = await db.select().from(attendance)
        .where(and(eq(attendance.employeeId, qr[0].employeeId), gte(attendance.date, today)))
        .limit(1);

      if (existing.length > 0 && existing[0].checkInTime) {
        throw new TRPCError({ code: "CONFLICT", message: "تم تسجيل الحضور مسبقاً لهذا اليوم" });
      }

      if (existing.length > 0) {
        await db.update(attendance).set({ checkInTime: new Date(), checkInMethod: "qr" }).where(eq(attendance.id, existing[0].id));
        return { success: true, message: "تم تسجيل الحضور" };
      }

      await db.insert(attendance).values({
        employeeId: qr[0].employeeId,
        date: new Date(),
        checkInTime: new Date(),
        checkInMethod: "qr",
      });

      return { success: true, message: "تم تسجيل الحضور" };
    }),

  // Check out by QR
  checkOutQR: protectedProcedure
    .input(z.object({ qrCodeValue: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const qr = await db.select().from(employeeQRCodes).where(eq(employeeQRCodes.qrCodeValue, input.qrCodeValue)).limit(1);
      if (!qr.length) throw new TRPCError({ code: "NOT_FOUND", message: "رمز QR غير صالح" });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const record = await db.select().from(attendance)
        .where(and(eq(attendance.employeeId, qr[0].employeeId), gte(attendance.date, today)))
        .limit(1);

      if (!record.length || !record[0].checkInTime) {
        throw new TRPCError({ code: "NOT_FOUND", message: "لا يوجد تسجيل حضور لهذا الموظف اليوم" });
      }

      await db.update(attendance).set({ checkOutTime: new Date(), checkOutMethod: "qr" }).where(eq(attendance.id, record[0].id));
      return { success: true, message: "تم تسجيل المغادرة" };
    }),

  // Manual check in by employee ID
  checkInManual: protectedProcedure
    .input(z.object({ employeeId: z.number().int(), checkInTime: z.date().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const checkIn = input.checkInTime || new Date();

      const existing = await db.select().from(attendance)
        .where(and(eq(attendance.employeeId, input.employeeId), gte(attendance.date, today)))
        .limit(1);

      if (existing.length > 0 && existing[0].checkInTime) {
        throw new TRPCError({ code: "CONFLICT", message: "تم تسجيل الحضور مسبقاً" });
      }

      if (existing.length > 0) {
        await db.update(attendance).set({ checkInTime: checkIn, checkInMethod: "manual" }).where(eq(attendance.id, existing[0].id));
      } else {
        await db.insert(attendance).values({
          employeeId: input.employeeId,
          date: new Date(),
          checkInTime: checkIn,
          checkInMethod: "manual",
        });
      }

      return { success: true };
    }),

  // Manual check out
  checkOutManual: protectedProcedure
    .input(z.object({ attendanceId: z.number().int(), checkOutTime: z.date().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(attendance).set({ checkOutTime: input.checkOutTime || new Date(), checkOutMethod: "manual" }).where(eq(attendance.id, input.attendanceId));
      return { success: true };
    }),

  // List attendance
  list: protectedProcedure
    .input(z.object({
      employeeId: z.number().int().optional(),
      page: z.number().int().default(1),
      limit: z.number().int().default(20),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const offset = (input.page - 1) * input.limit;
      const conditions = input.employeeId ? [eq(attendance.employeeId, input.employeeId)] : [];
      const whereClause = conditions.length > 0 ? conditions[0] : undefined;

      const [countResult, data] = await Promise.all([
        db.select({ count: sql<number>`COUNT(*)` }).from(attendance).where(whereClause),
        db.select({
          id: attendance.id,
          employeeId: attendance.employeeId,
          employeeName: employees.fullName,
          date: attendance.date,
          checkInTime: attendance.checkInTime,
          checkOutTime: attendance.checkOutTime,
          checkInMethod: attendance.checkInMethod,
          checkOutMethod: attendance.checkOutMethod,
          notes: attendance.notes,
        }).from(attendance)
          .leftJoin(employees, eq(attendance.employeeId, employees.id))
          .where(whereClause)
          .orderBy(desc(attendance.date))
          .limit(input.limit).offset(offset),
      ]);

      return {
        data,
        total: countResult[0]?.count || 0,
        pages: Math.ceil((countResult[0]?.count || 0) / input.limit),
      };
    }),

  getStatistics: protectedProcedure
    .input(z.object({ employeeId: z.number().int().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions = input.employeeId ? [eq(attendance.employeeId, input.employeeId)] : [];
      const whereClause = conditions.length > 0 ? conditions[0] : undefined;

      const stats = await db.select({
        totalRecords: sql<number>`COUNT(*)`,
        completedRecords: sql<number>`SUM(CASE WHEN ${attendance.checkOutTime} IS NOT NULL THEN 1 ELSE 0 END)`,
        pendingRecords: sql<number>`SUM(CASE WHEN ${attendance.checkInTime} IS NOT NULL AND ${attendance.checkOutTime} IS NULL THEN 1 ELSE 0 END)`,
      }).from(attendance).where(whereClause);

      return stats[0];
    }),
});
