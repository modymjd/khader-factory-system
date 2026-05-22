import { ReactNode } from "react";
import { Button, ButtonProps } from "@/components/ui/button";
import { hasPermission } from "@/lib/permissions";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface PermissionButtonProps extends ButtonProps {
  children: ReactNode;
  userPermissions?: any[];
  resource: string;
  action: "view" | "create" | "read" | "update" | "delete";
  fallback?: ReactNode;
}

/**
 * Button component that respects user permissions
 * Shows tooltip if user lacks permission
 */
export default function PermissionButton({
  children,
  userPermissions,
  resource,
  action,
  fallback,
  ...props
}: PermissionButtonProps) {
  const hasAccess = hasPermission(userPermissions, resource, action);

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button {...props} disabled>
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>ليس لديك صلاحية لتنفيذ هذا الإجراء</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return <Button {...props}>{children}</Button>;
}
