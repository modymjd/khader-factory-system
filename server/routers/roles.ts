import { eq, and, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { roles, permissions, rolePermissions } from "../../drizzle/schema";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logAudit } from "../db";

const createRoleSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().optional(),
});

const updateRoleSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1).max(64).optional(),
  description: z.string().optional(),
});

export const rolesRouter = router({
  // List all roles
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const allRoles = await db.select().from(roles);
    return allRoles;
  }),

  // Get role detail with permissions
  getById: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const role = await db
        .select()
        .from(roles)
        .where(eq(roles.id, input.id))
        .limit(1);

      if (!role.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Role not found",
        });
      }

      // Get permissions for this role
      const rolePerms = await db
        .select({
          id: permissions.id,
          name: permissions.name,
          resource: permissions.resource,
          action: permissions.action,
        })
        .from(rolePermissions)
        .innerJoin(
          permissions,
          eq(rolePermissions.permissionId, permissions.id)
        )
        .where(eq(rolePermissions.roleId, input.id));

      return {
        ...role[0],
        permissions: rolePerms,
      };
    }),

  // Create role
  create: protectedProcedure
    .input(createRoleSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check if role already exists
      const existing = await db
        .select()
        .from(roles)
        .where(eq(roles.name, input.name))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Role already exists",
        });
      }

      const result = await db.insert(roles).values({
        name: input.name,
        description: input.description,
        isSystem: false,
      });

      // Log audit
      await logAudit(
        ctx.user.id,
        "create",
        "roles",
        parseInt(String(result.insertId)),
        { name: input.name },
        ctx.req
      );

      return { id: result.insertId, ...input };
    }),

  // Update role
  update: protectedProcedure
    .input(updateRoleSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, ...updateData } = input;

      // Check if it's a system role
      const role = await db
        .select()
        .from(roles)
        .where(eq(roles.id, id))
        .limit(1);

      if (role.length && role[0].isSystem) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot modify system roles",
        });
      }

      await db.update(roles).set(updateData).where(eq(roles.id, id));

      // Log audit
      await logAudit(
        ctx.user.id,
        "update",
        "roles",
        id,
        updateData,
        ctx.req
      );

      return { id, ...updateData };
    }),

  // Delete role
  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const role = await db
        .select()
        .from(roles)
        .where(eq(roles.id, input.id))
        .limit(1);

      if (!role.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Role not found",
        });
      }

      if (role[0].isSystem) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot delete system roles",
        });
      }

      // Delete role permissions first
      await db
        .delete(rolePermissions)
        .where(eq(rolePermissions.roleId, input.id));

      // Delete role
      await db.delete(roles).where(eq(roles.id, input.id));

      // Log audit
      await logAudit(
        ctx.user.id,
        "delete",
        "roles",
        input.id,
        { deletedRoleId: input.id },
        ctx.req
      );

      return { success: true };
    }),

  // Get all permissions
  getAllPermissions: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const allPerms = await db.select().from(permissions);
    return allPerms;
  }),

  // Assign permission to role
  assignPermission: protectedProcedure
    .input(
      z.object({
        roleId: z.number().int(),
        permissionId: z.number().int(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check if already assigned
      const existing = await db
        .select()
        .from(rolePermissions)
        .where(
          and(
            eq(rolePermissions.roleId, input.roleId),
            eq(rolePermissions.permissionId, input.permissionId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return existing[0];
      }

      const result = await db.insert(rolePermissions).values({
        roleId: input.roleId,
        permissionId: input.permissionId,
      });

      // Log audit
      await logAudit(
        ctx.user.id,
        "create",
        "rolePermissions",
        parseInt(String(result.insertId)),
        { roleId: input.roleId, permissionId: input.permissionId },
        ctx.req
      );

      return { id: result.insertId, ...input };
    }),

  // Remove permission from role
  removePermission: protectedProcedure
    .input(
      z.object({
        roleId: z.number().int(),
        permissionId: z.number().int(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .delete(rolePermissions)
        .where(
          and(
            eq(rolePermissions.roleId, input.roleId),
            eq(rolePermissions.permissionId, input.permissionId)
          )
        );

      // Log audit
      await logAudit(
        ctx.user.id,
        "delete",
        "rolePermissions",
        input.roleId,
        { roleId: input.roleId, permissionId: input.permissionId },
        ctx.req
      );

      return { success: true };
    }),

  // Get role permissions
  getRolePermissions: protectedProcedure
    .input(z.object({ roleId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const perms = await db
        .select({
          id: permissions.id,
          name: permissions.name,
          resource: permissions.resource,
          action: permissions.action,
        })
        .from(rolePermissions)
        .innerJoin(
          permissions,
          eq(rolePermissions.permissionId, permissions.id)
        )
        .where(eq(rolePermissions.roleId, input.roleId));

      return perms;
    }),
});
