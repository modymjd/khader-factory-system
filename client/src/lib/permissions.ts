/**
 * Permission checker utility for frontend RBAC enforcement
 */

export type Permission = {
  id: number;
  name: string;
  resource: string;
  action: "create" | "read" | "update" | "delete" | "view";
};

export type UserRole = {
  id: number;
  name: string;
  permissions: Permission[];
};

/**
 * Check if user has a specific permission
 */
export function hasPermission(
  userPermissions: Permission[] | undefined,
  resource: string,
  action: string
): boolean {
  if (!userPermissions) return false;

  return userPermissions.some(
    (p) => p.resource === resource && p.action === action
  );
}

/**
 * Check if user can view a resource
 */
export function canView(
  userPermissions: Permission[] | undefined,
  resource: string
): boolean {
  return hasPermission(userPermissions, resource, "view") ||
    hasPermission(userPermissions, resource, "read");
}

/**
 * Check if user can create a resource
 */
export function canCreate(
  userPermissions: Permission[] | undefined,
  resource: string
): boolean {
  return hasPermission(userPermissions, resource, "create");
}

/**
 * Check if user can edit a resource
 */
export function canEdit(
  userPermissions: Permission[] | undefined,
  resource: string
): boolean {
  return hasPermission(userPermissions, resource, "update");
}

/**
 * Check if user can delete a resource
 */
export function canDelete(
  userPermissions: Permission[] | undefined,
  resource: string
): boolean {
  return hasPermission(userPermissions, resource, "delete");
}

/**
 * Check if user is admin
 */
export function isAdmin(userRole: string | undefined): boolean {
  return userRole === "admin";
}

/**
 * Get all resources user has access to
 */
export function getAccessibleResources(
  userPermissions: Permission[] | undefined
): string[] {
  if (!userPermissions) return [];

  const resources = new Set<string>();
  userPermissions.forEach((p) => {
    resources.add(p.resource);
  });

  return Array.from(resources);
}
