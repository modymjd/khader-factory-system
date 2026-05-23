import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Plus, Edit, Trash2, Power } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";

const userSchema = z.object({
  username: z.string().min(3),
  email: z.string().email().optional(),
  roleId: z.string(),
  fullName: z.string().min(1),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  monthlySalary: z.string().optional(),
  deductions: z.string().optional(),
  annualLeaveBalance: z.string().optional(),
});

export default function Users() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | undefined>();
  const [openCreate, setOpenCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: users, isLoading, refetch } = trpc.users.list.useQuery({
    search,
    status,
    page,
    limit: 10,
  });

  const createMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء المستخدم بنجاح");
      refetch();
      setOpenCreate(false);
      form.reset();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const toggleStatusMutation = trpc.users.toggleStatus.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث الحالة بنجاح");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.users.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف المستخدم بنجاح");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const form = useForm({
    resolver: zodResolver(userSchema),
    defaultValues: {
      username: "",
      email: "",
      roleId: "2",
      fullName: "",
      jobTitle: "",
      department: "",
      monthlySalary: "",
      deductions: "",
      annualLeaveBalance: "0",
    },
  });

  const onSubmit = (data: any) => {
    createMutation.mutate({
      ...data,
      roleId: parseInt(data.roleId),
      annualLeaveBalance: parseInt(data.annualLeaveBalance || "0"),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">إدارة المستخدمين</h1>
          <p className="text-muted-foreground mt-2">
            إدارة حسابات الموظفين، الأدوار الوظيفية وصلاحيات الوصول
          </p>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              إنشاء مستخدم جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>إنشاء مستخدم جديد</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>الاسم الكامل</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>اسم المستخدم</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>البريد الإلكتروني</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="roleId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>الدور</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1">مدير النظام</SelectItem>
                            <SelectItem value="2">مستخدم عادي</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="jobTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>المسمى الوظيفي</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>القسم</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Input
              placeholder="ابحث عن طريق الاسم..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <Input placeholder="مثال: admin_2024" />
            <Input placeholder="مدير مبيعات، مطور..." />
            <Select value={status || ""} onValueChange={(v) => setStatus(v === "all" ? undefined : v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="inactive">غير نشط</SelectItem>
              </SelectContent>
            </Select>
            <Button>تطبيق</Button>
            <Button variant="outline" onClick={() => {
              setSearch("");
              setStatus(undefined);
              setPage(1);
            }}>
              إعادة ضبط
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-right py-2">الاسم الكامل</th>
                    <th className="text-right py-2">اسم الحساب</th>
                    <th className="text-right py-2">الملف الوظيفي</th>
                    <th className="text-right py-2">الراتب والخصومات</th>
                    <th className="text-right py-2">الغياب والإجازات</th>
                    <th className="text-right py-2">الحضور والملاحظات</th>
                    <th className="text-right py-2">النوع</th>
                    <th className="text-right py-2">الحالة</th>
                    <th className="text-right py-2">تاريخ الإنشاء</th>
                    <th className="text-right py-2">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {users?.data?.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-accent/50">
                      <td className="py-2">-</td>
                      <td className="py-2">{user.username}</td>
                      <td className="py-2">-</td>
                      <td className="py-2">-</td>
                      <td className="py-2">-</td>
                      <td className="py-2">-</td>
                      <td className="py-2">-</td>
                      <td className="py-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${user.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                          {user.isActive ? "نشط" : "غير نشط"}
                        </span>
                      </td>
                      <td className="py-2">{format(new Date(user.createdAt), "d MMM yyyy")}</td>
                      <td className="py-2 flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleStatusMutation.mutate({ id: user.id })}
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate({ id: user.id })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {users?.data?.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">لا توجد نتائج</p>
              <p className="text-sm text-muted-foreground">حاول تعديل معايير البحث أو تصفية الحقول</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          عرض {users?.data?.length || 0} إلى {users?.total || 0} من أصل {users?.total || 0} مستخدم
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            السابق
          </Button>
          <Button variant="outline" disabled>
            صفحة {page}
          </Button>
          <Button
            variant="outline"
            disabled={page >= (users?.pages || 1)}
            onClick={() => setPage(page + 1)}
          >
            التالي
          </Button>
        </div>
      </div>
    </div>
  );
}
