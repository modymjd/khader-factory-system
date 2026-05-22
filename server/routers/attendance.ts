import { eq, and, gte, lte, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { attendance, employeeQRCodes, employees } from "../../drizzle/schema";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logAudit } from "../db";
import QRCode from "qrcode";

export const attendanceRouter = router({
  // Generate QR code for employee
  generateQRCode: protectedProcedure
    .input(z.object({ employeeId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const employee = await db
        .select()
        .from(employees)
        .where(eq(employees.id, input.employeeId))
        .limit(1);

      if (!employee.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Employee not found",
        });
      }

      // Check if QR code already exists
      const existing = await db
        .select()
        .from(employeeQRCodes)
        .where(eq(employeeQRCodes.employeeId, input.employeeId))
        .limit(1);

      const qrCodeValue = `EMP-${input.employeeId}-${Date.now()}`;
      const qrCodeDataUrl = await QRCode.toDataURL(qrCodeValue);

      if (existing.length > 0) {
        // Update existing
        await db
          .update(employeeQRCodes)
          .set({
            qrCode: qrCodeDataUrl,
            qrCodeValue,
          })
          .where(eq(employeeQRCodes.employeeId, input.employeeId));

        return { qrCode: qrCodeDataUrl, qrCodeValue };
      } else {
        // Create new
        await db.insert(employeeQRCodes).values({
          employeeId: input.employeeId,
          qrCode: qrCodeDataUrl,
          qrCodeValue,
        });

        return { qrCode: qrCodeDataUrl, qrCodeValue };
      }
    }),

  // Get employee QR code
  getQRCode: protectedProcedure
    .input(z.object({ employeeId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const qrCode = await db
        .select()
        .from(employeeQRCodes)
        .where(eq(employeeQRCodes.employeeId, input.employeeId))
        .limit(1);

      if (!qrCode.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "QR code not found",
        });
      }

      return qrCode[0];
    }),

  // Check-in with QR code
  checkInQR: protectedProcedure
    .input(z.object({ qrCodeValue: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const qrCode = await db
        .select()
        .from(employeeQRCodes)
        .where(eq(employeeQRCodes.qrCodeValue, input.qrCodeValue))
        .limit(1);

      if (!qrCode.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid QR code",
        });
      }

      const employeeId = qrCode[0].employeeId;
      const now = new Date();

      // Create attendance record
      const result = await db.insert(attendance).values({
        employeeId,
        checkInTime: now,
        checkInMethod: "qr",
        date: now,
      });

      // Log audit
      await logAudit(
        ctx.user.id,
        "create",
        "attendance",
        Number(result.insertId),
        { employeeId, checkInTime: now },
        ctx.req
      );

      return { id: result.insertId, employeeId, checkInTime: now };
    }),

  // Check-out with QR code
  checkOutQR: protectedProcedure
    .input(z.object({ qrCodeValue: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const qrCode = await db
        .select()
        .from(employeeQRCodes)
        .where(eq(employeeQRCodes.qrCodeValue, input.qrCodeValue))
        .limit(1);

      if (!qrCode.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid QR code",
        });
      }

      const employeeId = qrCode[0].employeeId;
      const now = new Date();

      // Find today's check-in record
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayRecord = await db
        .select()
        .from(attendance)
        .where(
          and(
            eq(attendance.employeeId, employeeId),
            gte(attendance.date, today),
            lte(attendance.date, new Date())
          )
        )
        .orderBy(sql`${attendance.createdAt} DESC`)
        .limit(1);

      if (!todayRecord.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No check-in record found for today",
        });
      }

      // Update check-out time
      await db
        .update(attendance)
        .set({
          checkOutTime: now,
          checkOutMethod: "qr",
        })
        .where(eq(attendance.id, todayRecord[0].id));

      // Log audit
      await logAudit(
        ctx.user.id,
        "update",
        "attendance",
        todayRecord[0].id,
        { checkOutTime: now },
        ctx.req
      );

      return { id: todayRecord[0].id, employeeId, checkOutTime: now };
    }),

  // Manual check-in
  checkInManual: protectedProcedure
    .input(
      z.object({
        employeeId: z.number().int(),
        checkInTime: z.date(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db.insert(attendance).values({
        employeeId: input.employeeId,
        checkInTime: input.checkInTime,
        checkInMethod: "manual",
        notes: input.notes,
        date: input.checkInTime,
      });

      // Log audit
      await logAudit(
        ctx.user.id,
        "create",
        "attendance",
        Number(result.insertId),
        { employeeId: input.employeeId, checkInTime: input.checkInTime },
        ctx.req
      );

      return { id: result.insertId, ...input };
    }),

  // Manual check-out
  checkOutManual: protectedProcedure
    .input(
      z.object({
        attendanceId: z.number().int(),
        checkOutTime: z.date(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(attendance)
        .set({
          checkOutTime: input.checkOutTime,
          checkOutMethod: "manual",
          notes: input.notes,
        })
        .where(eq(attendance.id, input.attendanceId));

      // Log audit
      await logAudit(
        ctx.user.id,
        "update",
        "attendance",
        input.attendanceId,
        { checkOutTime: input.checkOutTime },
        ctx.req
      );

      return { id: input.attendanceId, ...input };
    }),

  // Get attendance log with filters
  list: protectedProcedure
    .input(
      z.object({
        employeeId: z.number().int().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        page: z.number().int().default(1),
        limit: z.number().int().default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const offset = (input.page - 1) * input.limit;
      let query = db.select().from(attendance);

      const conditions = [];

      if (input.employeeId) {
        conditions.push(eq(attendance.employeeId, input.employeeId));
      }

      if (input.startDate) {
        conditions.push(gte(attendance.date, input.startDate));
      }

      if (input.endDate) {
        conditions.push(lte(attendance.date, input.endDate));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      // Get total count
      const countResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(attendance)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const total = countResult[0]?.count || 0;

      // Get paginated results
      const data = await query
        .orderBy(sql`${attendance.createdAt} DESC`)
        .limit(input.limit)
        .offset(offset);

      return {
        data,
        total,
        page: input.page,
        limit: input.limit,
        pages: Math.ceil(total / input.limit),
      };
    }),

  // Get attendance statistics
  getStatistics: protectedProcedure
    .input(
      z.object({
        employeeId: z.number().int().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions = [];

      if (input.employeeId) {
        conditions.push(eq(attendance.employeeId, input.employeeId));
      }

      if (input.startDate) {
        conditions.push(gte(attendance.date, input.startDate));
      }

      if (input.endDate) {
        conditions.push(lte(attendance.date, input.endDate));
      }

      // Total attendance records
      const totalRecords = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(attendance)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      // Completed check-ins and check-outs
      const completedRecords = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(attendance)
        .where(
          and(
            sql`${attendance.checkOutTime} IS NOT NULL`,
            conditions.length > 0 ? and(...conditions) : undefined
          )
        );

      return {
        totalRecords: totalRecords[0]?.count || 0,
        completedRecords: completedRecords[0]?.count || 0,
        pendingRecords: (totalRecords[0]?.count || 0) - (completedRecords[0]?.count || 0),
      };
    }),
});
