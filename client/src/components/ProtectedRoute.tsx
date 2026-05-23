import { ReactNode } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { hasPermission } from "@/lib/permissions";
import { Loader2 } from "lucide-react";
import { Redirect } from "wouter";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredResource?: string;
  requiredAction?: "view" | "create" | "read" | "update" | "delete";
  adminOnly?: boolean;
}

export default function ProtectedRoute({
  children,
  requiredResource,
  requiredAction = "view",
  adminOnly = false,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Not logged in → redirect to login
  if (!user) {
    return <Redirect to="/" />;
  }

  if (adminOnly && user.role !== "admin") {
    return <Redirect to="/" />;
  }

  // Check resource permission
  if (requiredResource) {
    const hasAccess = hasPermission(
      (user as any).permissions,
      requiredResource,
      requiredAction
    );
    if (!hasAccess) {
      // Admin always has access regardless of permission table
      if (user.role !== "admin") {
        return <Redirect to="/" />;
      }
    }
  }

  return <>{children}</>;
}
