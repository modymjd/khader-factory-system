import { eq, and, gte, lte, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { orders, orderItems, products } from "../../drizzle/schema";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logAudit } from "../db";
import { nanoid } from "nanoid";

const createOrderSchema = z.object({
  customerId: z.number().int().optional(),
  items: z.array(
    z.object({
      productId: z.number().int(),
      quantity: z.number().int().min(1),
      unitPrice: z.string(),
    })
  ),
  notes: z.string().optional(),
});

const updateOrderStatusSchema = z.object({
  id: z.number().int(),
  status: z.enum(["pending", "confirmed", "completed", "cancelled"]),
});

const updatePaymentStatusSchema = z.object({
  id: z.number().int(),
  paymentStatus: z.enum(["unpaid", "partial", "paid"]),
});

export const ordersRouter = router({
  // List orders with filters and pagination
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.enum(["pending", "confirmed", "completed", "cancelled"]).optional(),
        paymentStatus: z.enum(["unpaid", "partial", "paid"]).optional(),
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
      let query = db.select().from(orders);

      // Apply filters
      const conditions = [];

      if (input.search) {
        conditions.push(
          sql`${orders.orderNumber} LIKE ${`%${input.search}%`}`
        );
      }

      if (input.status) {
        conditions.push(eq(orders.status, input.status));
      }

      if (input.paymentStatus) {
        conditions.push(eq(orders.paymentStatus, input.paymentStatus));
      }

      if (input.startDate) {
        conditions.push(gte(orders.createdAt, input.startDate));
      }

      if (input.endDate) {
        conditions.push(lte(orders.createdAt, input.endDate));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      // Get total count
      const countResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(orders)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const total = countResult[0]?.count || 0;

      // Get paginated results
      const data = await query
        .orderBy(sql`${orders.createdAt} DESC`)
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

  // Get order detail with items
  getById: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const order = await db
        .select()
        .from(orders)
        .where(eq(orders.id, input.id))
        .limit(1);

      if (!order.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, input.id));

      return {
        ...order[0],
        items,
      };
    }),

  // Create order
  create: protectedProcedure
    .input(createOrderSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Calculate total amount
      let totalAmount = 0;
      for (const item of input.items) {
        const product = await db
          .select()
          .from(products)
          .where(eq(products.id, item.productId))
          .limit(1);

        if (!product.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Product ${item.productId} not found`,
          });
        }

        totalAmount += parseFloat(item.unitPrice) * item.quantity;
      }

      // Create order
      const orderNumber = `ORD-${Date.now()}-${nanoid(6)}`;
      const result = await db.insert(orders).values({
        orderNumber,
        customerId: input.customerId,
        totalAmount: totalAmount.toString(),
        status: "pending",
        paymentStatus: "unpaid",
        notes: input.notes,
        createdBy: ctx.user.id,
      });

      const orderId = Number(result.insertId);

      // Create order items
      for (const item of input.items) {
        const subtotal = parseFloat(item.unitPrice) * item.quantity;
        await db.insert(orderItems).values({
          orderId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: subtotal.toString(),
        });
      }

      // Log audit
      await logAudit(
        ctx.user.id,
        "create",
        "orders",
        orderId,
        { orderNumber, totalAmount },
        ctx.req
      );

      return { id: orderId, orderNumber, totalAmount };
    }),

  // Update order status
  updateStatus: protectedProcedure
    .input(updateOrderStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const order = await db
        .select()
        .from(orders)
        .where(eq(orders.id, input.id))
        .limit(1);

      if (!order.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      // Validate status workflow
      const validTransitions: Record<string, string[]> = {
        pending: ["confirmed", "cancelled"],
        confirmed: ["completed", "cancelled"],
        completed: [],
        cancelled: [],
      };

      if (!validTransitions[order[0].status].includes(input.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot transition from ${order[0].status} to ${input.status}`,
        });
      }

      await db
        .update(orders)
        .set({ status: input.status })
        .where(eq(orders.id, input.id));

      // Log audit
      await logAudit(
        ctx.user.id,
        "update",
        "orders",
        input.id,
        { status: input.status },
        ctx.req
      );

      return { id: input.id, status: input.status };
    }),

  // Update payment status
  updatePaymentStatus: protectedProcedure
    .input(updatePaymentStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(orders)
        .set({ paymentStatus: input.paymentStatus })
        .where(eq(orders.id, input.id));

      // Log audit
      await logAudit(
        ctx.user.id,
        "update",
        "orders",
        input.id,
        { paymentStatus: input.paymentStatus },
        ctx.req
      );

      return { id: input.id, paymentStatus: input.paymentStatus };
    }),

  // Delete order
  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Delete order items first
      await db.delete(orderItems).where(eq(orderItems.orderId, input.id));

      // Delete order
      await db.delete(orders).where(eq(orders.id, input.id));

      // Log audit
      await logAudit(
        ctx.user.id,
        "delete",
        "orders",
        input.id,
        { deletedOrderId: input.id },
        ctx.req
      );

      return { success: true };
    }),

  // Get order by order number
  getByOrderNumber: protectedProcedure
    .input(z.object({ orderNumber: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const order = await db
        .select()
        .from(orders)
        .where(eq(orders.orderNumber, input.orderNumber))
        .limit(1);

      if (!order.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order[0].id));

      return {
        ...order[0],
        items,
      };
    }),
});
