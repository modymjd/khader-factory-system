import { sql, desc } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { users, auditLogs, orders, employees } from "../../drizzle/schema";

export const dashboardRouter = router({
  // KPI metrics
  getMetrics: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [totalUsers] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users);

    const [activeUsers] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users)
      .where(sql`${users.isActive} = true`);

    const [totalEmployees] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(employees);

    const [totalOrders] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(orders);

    return {
      totalUsers: totalUsers?.count || 0,
      activeUsers: activeUsers?.count || 0,
      totalEmployees: totalEmployees?.count || 0,
      totalOrders: totalOrders?.count || 0,
    };
  }),

  // Activity chart (last 7 days audit log count per day)
  getActivityChart: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const data = await db
      .select({
        date: sql<string>`DATE(${auditLogs.createdAt})`,
        count: sql<number>`COUNT(*)`,
      })
      .from(auditLogs)
      .where(sql`${auditLogs.createdAt} >= DATE_SUB(NOW(), INTERVAL 7 DAY)`)
      .groupBy(sql`DATE(${auditLogs.createdAt})`)
      .orderBy(sql`DATE(${auditLogs.createdAt})`);

    return data.map((item) => ({
      date: item.date,
      activity: item.count,
    }));
  }),

  // Latest users
  getLatestUsers: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const data = await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(5);

    return data;
  }),

  // Latest audit logs
  getLatestAuditLogs: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const data = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(10);

    return data;
  }),
});
