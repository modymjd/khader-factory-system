import { eq, and, gte, lte, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { orders, orderItems, auditLogs, users } from "../../drizzle/schema";
import { z } from "zod";

export const analyticsRouter = router({
  // Get revenue chart data
  getRevenueChart: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const data = await db
        .select({
          date: sql<string>`DATE(${orders.createdAt})`,
          revenue: sql<number>`SUM(CAST(${orders.totalAmount} AS DECIMAL(12,2)))`,
        })
        .from(orders)
        .where(
          and(
            gte(orders.createdAt, input.startDate),
            lte(orders.createdAt, input.endDate),
            eq(orders.status, "completed")
          )
        )
        .groupBy(sql`DATE(${orders.createdAt})`)
        .orderBy(sql`DATE(${orders.createdAt})`);

      return data.map((item) => ({
        date: item.date,
        revenue: parseFloat(String(item.revenue || 0)),
      }));
    }),

  // Get order volume chart data
  getOrderVolumeChart: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const data = await db
        .select({
          date: sql<string>`DATE(${orders.createdAt})`,
          count: sql<number>`COUNT(*)`,
        })
        .from(orders)
        .where(
          and(
            gte(orders.createdAt, input.startDate),
            lte(orders.createdAt, input.endDate)
          )
        )
        .groupBy(sql`DATE(${orders.createdAt})`)
        .orderBy(sql`DATE(${orders.createdAt})`);

      return data.map((item) => ({
        date: item.date,
        orders: item.count,
      }));
    }),

  // Get daily performance table
  getDailyPerformance: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
        page: z.number().int().default(1),
        limit: z.number().int().default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const offset = (input.page - 1) * input.limit;

      const data = await db
        .select({
          date: sql<string>`DATE(${orders.createdAt})`,
          totalOrders: sql<number>`COUNT(*)`,
          completedOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'completed' THEN 1 ELSE 0 END)`,
          totalRevenue: sql<number>`SUM(CASE WHEN ${orders.status} = 'completed' THEN CAST(${orders.totalAmount} AS DECIMAL(12,2)) ELSE 0 END)`,
          avgOrderValue: sql<number>`AVG(CAST(${orders.totalAmount} AS DECIMAL(12,2)))`,
        })
        .from(orders)
        .where(
          and(
            gte(orders.createdAt, input.startDate),
            lte(orders.createdAt, input.endDate)
          )
        )
        .groupBy(sql`DATE(${orders.createdAt})`)
        .orderBy(sql`DATE(${orders.createdAt}) DESC`)
        .limit(input.limit)
        .offset(offset);

      const countResult = await db
        .select({ count: sql<number>`COUNT(DISTINCT DATE(${orders.createdAt}))` })
        .from(orders)
        .where(
          and(
            gte(orders.createdAt, input.startDate),
            lte(orders.createdAt, input.endDate)
          )
        );

      const total = countResult[0]?.count || 0;

      return {
        data: data.map((item) => ({
          date: item.date,
          totalOrders: item.totalOrders,
          completedOrders: item.completedOrders || 0,
          totalRevenue: parseFloat(String(item.totalRevenue || 0)),
          avgOrderValue: parseFloat(String(item.avgOrderValue || 0)),
        })),
        total,
        page: input.page,
        limit: input.limit,
        pages: Math.ceil(total / input.limit),
      };
    }),

  // Get sales comparison data
  getSalesComparison: protectedProcedure
    .input(
      z.object({
        period1Start: z.date(),
        period1End: z.date(),
        period2Start: z.date(),
        period2End: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Period 1 data
      const period1 = await db
        .select({
          revenue: sql<number>`SUM(CAST(${orders.totalAmount} AS DECIMAL(12,2)))`,
          orderCount: sql<number>`COUNT(*)`,
        })
        .from(orders)
        .where(
          and(
            gte(orders.createdAt, input.period1Start),
            lte(orders.createdAt, input.period1End),
            eq(orders.status, "completed")
          )
        );

      // Period 2 data
      const period2 = await db
        .select({
          revenue: sql<number>`SUM(CAST(${orders.totalAmount} AS DECIMAL(12,2)))`,
          orderCount: sql<number>`COUNT(*)`,
        })
        .from(orders)
        .where(
          and(
            gte(orders.createdAt, input.period2Start),
            lte(orders.createdAt, input.period2End),
            eq(orders.status, "completed")
          )
        );

      const p1Revenue = parseFloat(String(period1[0]?.revenue || 0));
      const p2Revenue = parseFloat(String(period2[0]?.revenue || 0));
      const p1Orders = period1[0]?.orderCount || 0;
      const p2Orders = period2[0]?.orderCount || 0;

      return {
        period1: {
          revenue: p1Revenue,
          orderCount: p1Orders,
        },
        period2: {
          revenue: p2Revenue,
          orderCount: p2Orders,
        },
        revenueChange: p1Revenue > 0 ? ((p2Revenue - p1Revenue) / p1Revenue) * 100 : 0,
        orderChange: p1Orders > 0 ? ((p2Orders - p1Orders) / p1Orders) * 100 : 0,
      };
    }),

  // Get audit logs with filters
  getAuditLogs: protectedProcedure
    .input(
      z.object({
        actor: z.number().int().optional(),
        resource: z.string().optional(),
        action: z.enum(["create", "read", "update", "delete", "login", "logout"]).optional(),
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
      const conditions = [];

      if (input.actor) {
        conditions.push(eq(auditLogs.actor, input.actor));
      }

      if (input.resource) {
        conditions.push(eq(auditLogs.resource, input.resource));
      }

      if (input.action) {
        conditions.push(eq(auditLogs.action, input.action));
      }

      if (input.startDate) {
        conditions.push(gte(auditLogs.createdAt, input.startDate));
      }

      if (input.endDate) {
        conditions.push(lte(auditLogs.createdAt, input.endDate));
      }

      // Get total count
      const countResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(auditLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const total = countResult[0]?.count || 0;

      // Get paginated results
      const data = await db
        .select()
        .from(auditLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(sql`${auditLogs.createdAt} DESC`)
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

  // Get audit log detail
  getAuditLogDetail: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const log = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.id, input.id))
        .limit(1);

      if (!log.length) {
        throw new Error("Audit log not found");
      }

      return log[0];
    }),
});
