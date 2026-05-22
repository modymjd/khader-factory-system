import { ReactNode } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { hasPermission, canView } from "@/lib/permissions";
import NotFound from "@/pages/NotFound";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredResource?: string;
  requiredAction?: "view" | "create" | "read" | "update" | "delete";
  adminOnly?: boolean;
}

/**
 * ProtectedRoute component that enforces RBAC permissions
 * Wraps routes to ensure user has required permissions
 */
export default function ProtectedRoute({
  children,
  requiredResource,
  requiredAction = "view",
  adminOnly = false,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Check if user is authenticated
  if (!user) {
    return <NotFound />;
  }

  // Check admin requirement
  if (adminOnly && user.role !== "admin") {
    return <NotFound />;
  }

  // Check resource permission if specified
  if (requiredResource) {
    const hasAccess = hasPermission(
      user.permissions,
      requiredResource,
      requiredAction
    );

    if (!hasAccess) {
      return <NotFound />;
    }
  }

  return <>{children}</>;
}
