import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { eq, and } from "drizzle-orm";
import { rolePermissions, permissions, users } from "../drizzle/schema";

/**
 * Check if user has a specific permission
 */
export async function userHasPermission(
  userId: number,
  resource: string,
  action: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    // Get user's role
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user.length) return false;

    // Admin users have all permissions
    if (user[0].role === "admin") return true;

    // Check if user's role has the permission
    const hasPermission = await db
      .select()
      .from(rolePermissions)
      .innerJoin(
        permissions,
        eq(rolePermissions.permissionId, permissions.id)
      )
      .where(
        and(
          eq(rolePermissions.roleId, user[0].roleId || 0),
          eq(permissions.resource, resource),
          eq(permissions.action, action)
        )
      )
      .limit(1);

    return hasPermission.length > 0;
  } catch (error) {
    console.error("[RBAC] Error checking permission:", error);
    return false;
  }
}

/**
 * Get all permissions for a user
 */
export async function getUserPermissions(userId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user.length) return [];

    // Admin users have all permissions (return empty array as signal)
    if (user[0].role === "admin") return [];

    const userPermissions = await db
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
      .where(eq(rolePermissions.roleId, user[0].roleId || 0));

    return userPermissions;
  } catch (error) {
    console.error("[RBAC] Error getting user permissions:", error);
    return [];
  }
}

/**
 * Middleware to enforce permission check in procedures
 */
export function requirePermission(resource: string, action: string) {
  return async (opts: any) => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }

    // Admin users bypass permission checks
    if (ctx.user.role === "admin") {
      return next({ ctx });
    }

    const hasPermission = await userHasPermission(
      ctx.user.id,
      resource,
      action
    );

    if (!hasPermission) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `You don't have permission to ${action} ${resource}`,
      });
    }

    return next({ ctx });
  };
}
