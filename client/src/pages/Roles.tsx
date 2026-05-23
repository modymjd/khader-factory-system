import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Shield } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";

const PERMISSION_LABELS: Record<string, string> = {
  "users:view": "عرض المستخدمين",
  "users:create": "إنشاء مستخدمين",
  "users:read": "قراءة بيانات المستخدمين",
  "users:update": "تعديل المستخدمين",
  "users:delete": "حذف المستخدمين",
  "products:view": "عرض المنتجات",
  "products:create": "إضافة منتجات",
  "products:read": "قراءة بيانات المنتجات",
  "products:update": "تعديل المنتجات",
  "products:delete": "حذف المنتجات",
  "orders:view": "عرض الطلبات",
  "orders:create": "إنشاء طلبات",
  "orders:read": "قراءة بيانات الطلبات",
  "orders:update": "تعديل الطلبات",
  "orders:delete": "حذف الطلبات",
  "attendance:view": "عرض الحضور",
  "attendance:create": "تسجيل الحضور",
  "attendance:read": "قراءة سجلات الحضور",
  "attendance:update": "تعديل سجلات الحضور",
  "attendance:delete": "حذف سجلات الحضور",
  "analytics:view": "عرض التحليلات",
  "analytics:read": "قراءة التقارير",
  "roles:view": "عرض الأدوار",
  "roles:create": "إنشاء أدوار",
  "roles:read": "قراءة بيانات الأدوار",
  "roles:update": "تعديل الأدوار",
  "roles:delete": "حذف الأدوار",
  "audit_logs:view": "عرض سجل العمليات",
  "audit_logs:read": "قراءة سجل العمليات",
  "dashboard:view": "عرض لوحة المعلومات",
  "dashboard:read": "قراءة بيانات لوحة المعلومات",
  "salary:view": "عرض الرواتب",
  "salary:create": "إنشاء كشوف الرواتب",
  "salary:read": "قراءة بيانات الرواتب",
  "salary:update": "تعديل الرواتب",
  "salary:delete": "حذف سجلات الرواتب",
};

const RESOURCE_LABELS: Record<string, string> = {
  users: "المستخدمون",
  products: "المنتجات",
  orders: "الطلبات",
  attendance: "الحضور والغياب",
  analytics: "التحليلات",
  roles: "الأدوار",
  audit_logs: "سجل العمليات",
  dashboard: "لوحة المعلومات",
  salary: "الرواتب",
};

const roleSchema = z.object({
  name: z.string().min(1, "اسم الدور مطلوب"),
  description: z.string().optional(),
});

export default function Roles() {
  const [openCreate, setOpenCreate] = useState(false);
  const [selectedRole, setSelectedRole] = useState<any>(null);

  const { data: roles, isLoading, refetch } = trpc.roles.list.useQuery();
  const { data: allPermissions } = trpc.roles.getAllPermissions.useQuery();
  const { data: rolePermissions, refetch: refetchPerms } = trpc.roles.getRolePermissions.useQuery(
    { roleId: selectedRole?.id || 0 },
    { enabled: !!selectedRole }
  );

  const createMutation = trpc.roles.create.useMutation({
    onSuccess: () => { toast.success("تم إنشاء الدور بنجاح"); refetch(); setOpenCreate(false); form.reset(); },
    onError: (e) => toast.error(e.message),
  });

  const assignPermissionMutation = trpc.roles.assignPermission.useMutation({
    onSuccess: () => refetchPerms(),
    onError: (e) => toast.error(e.message),
  });

  const removePermissionMutation = trpc.roles.removePermission.useMutation({
    onSuccess: () => refetchPerms(),
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.roles.delete.useMutation({
    onSuccess: () => { toast.success("تم حذف الدور"); refetch(); setSelectedRole(null); },
    onError: (e) => toast.error(e.message),
  });

  const form = useForm({ resolver: zodResolver(roleSchema), defaultValues: { name: "", description: "" } });

  // Group permissions by resource
  const groupedPermissions = allPermissions?.reduce((acc: any, p) => {
    if (!acc[p.resource]) acc[p.resource] = [];
    acc[p.resource].push(p);
    return acc;
  }, {}) || {};

  const handlePermissionToggle = (permissionId: number, isChecked: boolean) => {
    if (!selectedRole || selectedRole.isSystem) return;
    if (isChecked) {
      assignPermissionMutation.mutate({ roleId: selectedRole.id, permissionId });
    } else {
      removePermissionMutation.mutate({ roleId: selectedRole.id, permissionId });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">إدارة الأدوار والصلاحيات</h1>
          <p className="text-muted-foreground mt-1">إدارة أدوار المستخدمين وتحديد صلاحياتهم</p>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />إنشاء دور جديد</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>إنشاء دور جديد</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>اسم الدور *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>الوصف</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "جارٍ الإنشاء..." : "إنشاء"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {isLoading ? [1,2,3].map(i => <Skeleton key={i} className="h-32" />) : roles?.map((role) => (
          <Card key={role.id}
            className={`cursor-pointer transition-all hover:shadow-md ${selectedRole?.id === role.id ? "border-primary ring-1 ring-primary" : ""}`}
            onClick={() => setSelectedRole(role)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Shield className={`h-5 w-5 ${role.isSystem ? "text-blue-500" : "text-gray-500"}`} />
                  <CardTitle className="text-base">{role.name}</CardTitle>
                </div>
                {!role.isSystem && (
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); if (confirm("حذف هذا الدور؟")) deleteMutation.mutate({ id: role.id }); }}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{role.description || "بدون وصف"}</p>
              <span className={`mt-2 inline-block text-xs px-2 py-0.5 rounded ${role.isSystem ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                {role.isSystem ? "دور النظام" : "دور مخصص"}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedRole && (
        <Card>
          <CardHeader>
            <CardTitle>صلاحيات الدور: {selectedRole.name}</CardTitle>
            {selectedRole.isSystem && <p className="text-sm text-yellow-600">⚠️ لا يمكن تعديل أدوار النظام</p>}
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {Object.entries(groupedPermissions).map(([resource, perms]: any) => (
                <div key={resource}>
                  <h4 className="font-semibold text-sm mb-3 pb-1 border-b">
                    {RESOURCE_LABELS[resource] || resource}
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {perms.map((perm: any) => {
                      const isAssigned = rolePermissions?.some(p => p.id === perm.id);
                      const label = PERMISSION_LABELS[`${perm.resource}:${perm.action}`] || `${perm.action} - ${perm.resource}`;
                      return (
                        <div key={perm.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`perm-${perm.id}`}
                            checked={isAssigned || false}
                            onCheckedChange={(checked) => handlePermissionToggle(perm.id, checked as boolean)}
                            disabled={selectedRole.isSystem}
                          />
                          <label htmlFor={`perm-${perm.id}`} className="text-sm cursor-pointer">{label}</label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
