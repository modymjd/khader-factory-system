import { eq, and, like, sql, desc } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { orders, orderItems, products, users } from "../../drizzle/schema";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logAudit } from "../db";
import { nanoid } from "nanoid";

export const ordersRouter = router({
  list: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      status: z.enum(["pending","confirmed","completed","cancelled"]).optional(),
      paymentStatus: z.enum(["unpaid","partial","paid"]).optional(),
      page: z.number().int().default(1),
      limit: z.number().int().default(10),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const offset = (input.page - 1) * input.limit;
      const conditions = [];
      if (input.search) conditions.push(sql`${orders.orderNumber} LIKE ${`%${input.search}%`} OR ${orders.customerName} LIKE ${`%${input.search}%`}`);
      if (input.status) conditions.push(eq(orders.status, input.status));
      if (input.paymentStatus) conditions.push(eq(orders.paymentStatus, input.paymentStatus));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [countResult, data] = await Promise.all([
        db.select({ count: sql<number>`COUNT(*)` }).from(orders).where(whereClause),
        db.select().from(orders).where(whereClause)
          .orderBy(desc(orders.createdAt))
          .limit(input.limit).offset(offset),
      ]);

      return {
        data,
        total: countResult[0]?.count || 0,
        pages: Math.ceil((countResult[0]?.count || 0) / input.limit),
      };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const order = await db.select().from(orders).where(eq(orders.id, input.id)).limit(1);
      if (!order.length) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

      const items = await db.select({
        id: orderItems.id,
        productId: orderItems.productId,
        productName: products.name,
        productSku: products.sku,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        subtotal: orderItems.subtotal,
      }).from(orderItems)
        .leftJoin(products, eq(orderItems.productId, products.id))
        .where(eq(orderItems.orderId, input.id));

      return { ...order[0], items };
    }),

  create: protectedProcedure
    .input(z.object({
      customerName: z.string().optional(),
      customerPhone: z.string().optional(),
      notes: z.string().optional(),
      items: z.array(z.object({
        productId: z.number().int(),
        quantity: z.number().int().min(1),
      })).min(1, "يجب إضافة منتج واحد على الأقل"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Calculate totals from products
      let totalAmount = 0;
      const itemsWithPrices = [];

      for (const item of input.items) {
        const product = await db.select().from(products).where(eq(products.id, item.productId)).limit(1);
        if (!product.length) throw new TRPCError({ code: "NOT_FOUND", message: `المنتج ${item.productId} غير موجود` });
        if (product[0].stockQuantity < item.quantity) throw new TRPCError({ code: "BAD_REQUEST", message: `المخزون غير كافي للمنتج: ${product[0].name}` });

        const unitPrice = parseFloat(String(product[0].price));
        const subtotal = unitPrice * item.quantity;
        totalAmount += subtotal;
        itemsWithPrices.push({ ...item, unitPrice: unitPrice.toFixed(2), subtotal: subtotal.toFixed(2), productName: product[0].name });
      }

      const orderNumber = `ORD-${Date.now()}-${nanoid(4).toUpperCase()}`;

      const result = await db.insert(orders).values({
        orderNumber,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        totalAmount: totalAmount.toFixed(2),
        notes: input.notes,
        createdBy: ctx.user.id,
        status: "pending",
        paymentStatus: "unpaid",
      });

      const orderId = Number(result.insertId);

      // Insert order items and update stock
      for (const item of itemsWithPrices) {
        await db.insert(orderItems).values({
          orderId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
        });

        await db.update(products)
          .set({ stockQuantity: sql`${products.stockQuantity} - ${item.quantity}` })
          .where(eq(products.id, item.productId));
      }

      await logAudit(ctx.user.id, "create", "orders", orderId, { orderNumber, totalAmount }, ctx.req);
      return { id: orderId, orderNumber, success: true };
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.number().int(), status: z.enum(["pending","confirmed","completed","cancelled"]) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(orders).set({ status: input.status }).where(eq(orders.id, input.id));
      await logAudit(ctx.user.id, "update", "orders", input.id, { status: input.status }, ctx.req);
      return { success: true };
    }),

  updatePaymentStatus: protectedProcedure
    .input(z.object({ id: z.number().int(), paymentStatus: z.enum(["unpaid","partial","paid"]) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(orders).set({ paymentStatus: input.paymentStatus }).where(eq(orders.id, input.id));
      await logAudit(ctx.user.id, "update", "orders", input.id, { paymentStatus: input.paymentStatus }, ctx.req);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(orderItems).where(eq(orderItems.orderId, input.id));
      await db.delete(orders).where(eq(orders.id, input.id));
      await logAudit(ctx.user.id, "delete", "orders", input.id, {}, ctx.req);
      return { success: true };
    }),
});
