import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";

const roleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export default function Roles() {
  const [openCreate, setOpenCreate] = useState(false);
  const [selectedRole, setSelectedRole] = useState<any>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);

  const { data: roles, isLoading, refetch } = trpc.roles.list.useQuery();
  const { data: allPermissions } = trpc.roles.getAllPermissions.useQuery();
  const { data: rolePermissions } = trpc.roles.getRolePermissions.useQuery(
    { roleId: selectedRole?.id || 0 },
    { enabled: !!selectedRole }
  );

  const createMutation = trpc.roles.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء الدور بنجاح");
      refetch();
      setOpenCreate(false);
      form.reset();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const assignPermissionMutation = trpc.roles.assignPermission.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة الصلاحية بنجاح");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const removePermissionMutation = trpc.roles.removePermission.useMutation({
    onSuccess: () => {
      toast.success("تم إزالة الصلاحية بنجاح");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.roles.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الدور بنجاح");
      refetch();
      setSelectedRole(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const form = useForm({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const onSubmit = (data: any) => {
    createMutation.mutate(data);
  };

  const handlePermissionToggle = (permissionId: number, isChecked: boolean) => {
    if (!selectedRole) return;

    if (isChecked) {
      assignPermissionMutation.mutate({
        roleId: selectedRole.id,
        permissionId,
      });
    } else {
      removePermissionMutation.mutate({
        roleId: selectedRole.id,
        permissionId,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">إدارة الأدوار والصلاحيات</h1>
          <p className="text-muted-foreground mt-2">
            إدارة أدوار المستخدمين والصلاحيات المرتبطة بها
          </p>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              إنشاء دور جديد
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إنشاء دور جديد</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>اسم الدور</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>الوصف</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Roles Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <>
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </>
        ) : (
          roles?.map((role) => (
            <Card
              key={role.id}
              className={`cursor-pointer transition-colors ${
                selectedRole?.id === role.id ? "border-primary bg-accent" : ""
              }`}
              onClick={() => setSelectedRole(role)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{role.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {role.description || "بدون وصف"}
                    </p>
                  </div>
                  {!role.isSystem && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate({ id: role.id });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {role.isSystem ? "دور النظام" : "دور مخصص"}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Permissions for Selected Role */}
      {selectedRole && (
        <Card>
          <CardHeader>
            <CardTitle>صلاحيات الدور: {selectedRole.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {allPermissions?.map((permission) => {
                const isAssigned = rolePermissions?.some(
                  (p) => p.id === permission.id
                );
                return (
                  <div key={permission.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`perm-${permission.id}`}
                      checked={isAssigned || false}
                      onCheckedChange={(checked) =>
                        handlePermissionToggle(permission.id, checked as boolean)
                      }
                      disabled={selectedRole.isSystem}
                    />
                    <label
                      htmlFor={`perm-${permission.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      <div>
                        <p>{permission.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {permission.resource} - {permission.action}
                        </p>
                      </div>
                    </label>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
