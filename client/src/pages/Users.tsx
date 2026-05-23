import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Plus, Edit, Trash2, Power, Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";

const userSchema = z.object({
  username: z.string().min(3, "اسم المستخدم 3 أحرف على الأقل"),
  email: z.string().email("بريد إلكتروني غير صالح"),
  password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل"),
  phone: z.string().optional(),
  address: z.string().optional(),
  roleId: z.string().min(1, "اختر دوراً"),
  fullName: z.string().min(1, "الاسم مطلوب"),
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
  const [showPassword, setShowPassword] = useState(false);

  const { data: users, isLoading, refetch } = trpc.users.list.useQuery({ search, status, page, limit: 10 });
  const { data: roles } = trpc.roles.list.useQuery();

  const createMutation = trpc.users.create.useMutation({
    onSuccess: () => { toast.success("تم إنشاء المستخدم بنجاح"); refetch(); setOpenCreate(false); form.reset(); },
    onError: (e) => toast.error(e.message),
  });

  const toggleStatusMutation = trpc.users.toggleStatus.useMutation({
    onSuccess: () => { toast.success("تم تحديث الحالة"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.users.delete.useMutation({
    onSuccess: () => { toast.success("تم حذف المستخدم"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const form = useForm({
    resolver: zodResolver(userSchema),
    defaultValues: {
      username: "", email: "", password: "", phone: "", address: "",
      roleId: "", fullName: "", jobTitle: "", department: "",
      monthlySalary: "", deductions: "", annualLeaveBalance: "0",
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">إدارة المستخدمين</h1>
          <p className="text-muted-foreground mt-1">إدارة حسابات الموظفين والصلاحيات</p>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />إنشاء مستخدم جديد</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>إنشاء مستخدم جديد</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <p className="text-sm font-semibold text-muted-foreground border-b pb-1">بيانات الدخول</p>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="fullName" render={({ field }) => (
                    <FormItem><FormLabel>الاسم الكامل *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="username" render={({ field }) => (
                    <FormItem><FormLabel>اسم المستخدم *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>البريد الإلكتروني *</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem><FormLabel>كلمة المرور *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input type={showPassword ? "text" : "password"} {...field} />
                          <button type="button" className="absolute left-3 top-1/2 -translate-y-1/2" onClick={() => setShowPassword(!showPassword)}>
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl><FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>رقم الهاتف</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="roleId" render={({ field }) => (
                    <FormItem><FormLabel>الدور *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue placeholder="اختر الدور" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {roles?.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
                        </SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem><FormLabel>العنوان</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <p className="text-sm font-semibold text-muted-foreground border-b pb-1 pt-2">البيانات الوظيفية</p>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="jobTitle" render={({ field }) => (
                    <FormItem><FormLabel>المسمى الوظيفي</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="department" render={({ field }) => (
                    <FormItem><FormLabel>القسم</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="monthlySalary" render={({ field }) => (
                    <FormItem><FormLabel>الراتب الشهري (₪)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="deductions" render={({ field }) => (
                    <FormItem><FormLabel>الخصومات (₪)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="annualLeaveBalance" render={({ field }) => (
                    <FormItem><FormLabel>رصيد الإجازات (أيام)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "جارٍ الإنشاء..." : "إنشاء المستخدم"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3 flex-wrap">
            <Input placeholder="بحث بالاسم أو الإيميل..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="flex-1 min-w-[200px]" />
            <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? undefined : v as any)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="inactive">غير نشط</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => { setSearch(""); setStatus(undefined); setPage(1); }}>إعادة ضبط</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? <Skeleton className="h-64 w-full" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-right">
                    <th className="py-2 px-2">الاسم</th>
                    <th className="py-2 px-2">اسم المستخدم</th>
                    <th className="py-2 px-2">البريد</th>
                    <th className="py-2 px-2">الهاتف</th>
                    <th className="py-2 px-2">الدور</th>
                    <th className="py-2 px-2">الحالة</th>
                    <th className="py-2 px-2">تاريخ الإنشاء</th>
                    <th className="py-2 px-2">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {users?.data?.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-accent/50">
                      <td className="py-2 px-2 font-medium">{user.name || "-"}</td>
                      <td className="py-2 px-2">{user.username}</td>
                      <td className="py-2 px-2">{user.email || "-"}</td>
                      <td className="py-2 px-2">{(user as any).phone || "-"}</td>
                      <td className="py-2 px-2">{roles?.find(r => r.id === user.roleId)?.name || user.role}</td>
                      <td className="py-2 px-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${user.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                          {user.isActive ? "نشط" : "غير نشط"}
                        </span>
                      </td>
                      <td className="py-2 px-2">{format(new Date(user.createdAt), "d MMM yyyy")}</td>
                      <td className="py-2 px-2 flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => toggleStatusMutation.mutate({ id: user.id })}><Power className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("هل أنت متأكد من الحذف؟")) deleteMutation.mutate({ id: user.id }); }}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users?.data?.length === 0 && <p className="text-center py-8 text-muted-foreground">لا توجد نتائج</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">إجمالي: {users?.total || 0} مستخدم</p>
        <div className="flex gap-2">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>السابق</Button>
          <Button variant="outline" disabled>صفحة {page}</Button>
          <Button variant="outline" disabled={page >= (users?.pages || 1)} onClick={() => setPage(page + 1)}>التالي</Button>
        </div>
      </div>
    </div>
  );
}
