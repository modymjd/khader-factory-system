import { eq, and, like, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { products } from "../../drizzle/schema";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logAudit } from "../db";

const createProductSchema = z.object({
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(256),
  category: z.string().optional(),
  description: z.string().optional(),
  price: z.string().min(1),
  stockQuantity: z.number().int().default(0),
  productImage: z.string().optional(),
});

const updateProductSchema = z.object({
  id: z.number().int(),
  sku: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(256).optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  price: z.string().optional(),
  stockQuantity: z.number().int().optional(),
  productImage: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const productsRouter = router({
  // List products with filters and pagination
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        category: z.string().optional(),
        status: z.enum(["active", "inactive"]).optional(),
        page: z.number().int().default(1),
        limit: z.number().int().default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const offset = (input.page - 1) * input.limit;
      let query = db.select().from(products);

      // Apply filters
      const conditions = [];

      if (input.search) {
        conditions.push(
          sql`${products.name} LIKE ${`%${input.search}%`} OR ${products.sku} LIKE ${`%${input.search}%`}`
        );
      }

      if (input.category) {
        conditions.push(eq(products.category, input.category));
      }

      if (input.status === "active") {
        conditions.push(eq(products.isActive, true));
      } else if (input.status === "inactive") {
        conditions.push(eq(products.isActive, false));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      // Get total count
      const countResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(products)
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

  // Get product detail
  getById: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const product = await db
        .select()
        .from(products)
        .where(eq(products.id, input.id))
        .limit(1);

      if (!product.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Product not found",
        });
      }

      return product[0];
    }),

  // Create product
  create: protectedProcedure
    .input(createProductSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check if SKU already exists
      const existing = await db
        .select()
        .from(products)
        .where(eq(products.sku, input.sku))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "SKU already exists",
        });
      }

      // Create product
      const result = await db.insert(products).values({
        sku: input.sku,
        name: input.name,
        category: input.category,
        description: input.description,
        price: input.price,
        stockQuantity: input.stockQuantity,
        productImage: input.productImage,
        isActive: true,
      });

      // Log audit
      await logAudit(
        ctx.user.id,
        "create",
        "products",
        parseInt(String(result.insertId)),
        { sku: input.sku, name: input.name },
        ctx.req
      );

      return { id: result.insertId, ...input };
    }),

  // Update product
  update: protectedProcedure
    .input(updateProductSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, ...updateData } = input;

      // Update product
      await db.update(products).set(updateData).where(eq(products.id, id));

      // Log audit
      await logAudit(
        ctx.user.id,
        "update",
        "products",
        id,
        updateData,
        ctx.req
      );

      return { id, ...updateData };
    }),

  // Toggle product active status
  toggleStatus: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const product = await db
        .select()
        .from(products)
        .where(eq(products.id, input.id))
        .limit(1);

      if (!product.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Product not found",
        });
      }

      const newStatus = !product[0].isActive;

      await db
        .update(products)
        .set({ isActive: newStatus })
        .where(eq(products.id, input.id));

      // Log audit
      await logAudit(
        ctx.user.id,
        "update",
        "products",
        input.id,
        { isActive: newStatus },
        ctx.req
      );

      return { id: input.id, isActive: newStatus };
    }),

  // Delete product
  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.delete(products).where(eq(products.id, input.id));

      // Log audit
      await logAudit(
        ctx.user.id,
        "delete",
        "products",
        input.id,
        { deletedProductId: input.id },
        ctx.req
      );

      return { success: true };
    }),

  // Get categories
  getCategories: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const categories = await db
      .selectDistinct({ category: products.category })
      .from(products)
      .where(sql`${products.category} IS NOT NULL`);

    return categories.map((c) => c.category).filter(Boolean);
  }),

  // Get stock alerts (low stock products)
  getStockAlerts: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Products with stock <= 5
    const alerts = await db
      .select()
      .from(products)
      .where(sql`${products.stockQuantity} <= 5 AND ${products.isActive} = true`);

    return alerts;
  }),
});
