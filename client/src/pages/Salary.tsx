import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";
import { Plus, Wallet, Clock, CheckCircle, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";

const currentMonth = format(new Date(), "yyyy-MM");

const LEAVE_TYPES: Record<string, string> = {
  annual: "إجازة سنوية",
  sick: "إجازة مرضية",
  unpaid: "إجازة بدون راتب",
  emergency: "إجازة طارئة",
};

const LEAVE_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "قيد الانتظار", className: "bg-yellow-100 text-yellow-800" },
  approved: { label: "مقبولة", className: "bg-green-100 text-green-800" },
  rejected: { label: "مرفوضة", className: "bg-red-100 text-red-800" },
};

export default function Salary() {
  const [tab, setTab] = useState("salaries");
  const [month, setMonth] = useState(currentMonth);
  const [page, setPage] = useState(1);
  const [openCreate, setOpenCreate] = useState(false);
  const [openLeave, setOpenLeave] = useState(false);

  const { data: employees } = trpc.attendance.searchEmployees.useQuery({});
  const { data: salaries, isLoading, refetch } = trpc.salary.list.useQuery({ month, page, limit: 10 });
  const { data: summary } = trpc.salary.getSummary.useQuery({ month });
  const { data: leaves, refetch: refetchLeaves } = trpc.salary.leaveList.useQuery({ page: 1, limit: 20 });

  const createMutation = trpc.salary.create.useMutation({
    onSuccess: () => { toast.success("تم إنشاء كشف الراتب"); refetch(); setOpenCreate(false); salaryForm.reset(); },
    onError: (e) => toast.error(e.message),
  });

  const markPaidMutation = trpc.salary.markPaid.useMutation({
    onSuccess: () => { toast.success("تم تحديث حالة الدفع"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.salary.delete.useMutation({
    onSuccess: () => { toast.success("تم الحذف"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const generateMutation = trpc.salary.generateMonthly.useMutation({
    onSuccess: (d) => { toast.success(d.message); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const leaveCreateMutation = trpc.salary.leaveCreate.useMutation({
    onSuccess: () => { toast.success("تم تقديم طلب الإجازة"); refetchLeaves(); setOpenLeave(false); leaveForm.reset(); },
    onError: (e) => toast.error(e.message),
  });

  const leaveStatusMutation = trpc.salary.leaveUpdateStatus.useMutation({
    onSuccess: () => { toast.success("تم تحديث الحالة"); refetchLeaves(); },
    onError: (e) => toast.error(e.message),
  });

  const salaryForm = useForm({
    resolver: zodResolver(z.object({
      employeeId: z.string().min(1),
      month: z.string(),
      baseSalary: z.string().min(1),
      deductions: z.string().default("0"),
      bonuses: z.string().default("0"),
      notes: z.string().optional(),
    })),
    defaultValues: { employeeId: "", month: currentMonth, baseSalary: "", deductions: "0", bonuses: "0", notes: "" },
  });

  const leaveForm = useForm({
    resolver: zodResolver(z.object({
      employeeId: z.string().min(1),
      type: z.enum(["annual","sick","unpaid","emergency"]),
      startDate: z.string(),
      endDate: z.string(),
      reason: z.string().optional(),
    })),
    defaultValues: { employeeId: "", type: "annual" as const, startDate: "", endDate: "", reason: "" },
  });

  const calcDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const s = new Date(start), e = new Date(end);
    return Math.max(1, Math.ceil((e.getTime() - s.getTime()) / 86400000) + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">الرواتب والإجازات</h1>
          <p className="text-muted-foreground mt-1">إدارة رواتب الموظفين وطلبات الإجازة</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { title: "إجمالي المدفوع", value: `₪${parseFloat(String(summary?.totalPaid || 0)).toLocaleString()}`, icon: CheckCircle, color: "text-green-600" },
          { title: "إجمالي المعلق", value: `₪${parseFloat(String(summary?.totalPending || 0)).toLocaleString()}`, icon: Clock, color: "text-yellow-600" },
          { title: "مدفوعة", value: `${summary?.paidCount || 0} موظف`, icon: Wallet, color: "text-blue-600" },
          { title: "معلقة", value: `${summary?.pendingCount || 0} موظف`, icon: Wallet, color: "text-orange-600" },
        ].map((item) => (
          <Card key={item.title}>
            <CardContent className="pt-6 flex items-center gap-4">
              <item.icon className={`h-8 w-8 ${item.color}`} />
              <div>
                <p className="text-sm text-muted-foreground">{item.title}</p>
                <p className="text-xl font-bold">{item.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="salaries">كشوف الرواتب</TabsTrigger>
          <TabsTrigger value="leaves">طلبات الإجازة</TabsTrigger>
        </TabsList>

        {/* Salaries Tab */}
        <TabsContent value="salaries" className="space-y-4">
          <Card>
            <CardContent className="pt-6 flex gap-3 flex-wrap">
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
              <Button variant="outline" onClick={() => generateMutation.mutate({ month })} disabled={generateMutation.isPending}>
                {generateMutation.isPending ? "جارٍ التوليد..." : "توليد رواتب الشهر"}
              </Button>
              <Dialog open={openCreate} onOpenChange={setOpenCreate}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" />إضافة راتب</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>إضافة كشف راتب</DialogTitle></DialogHeader>
                  <Form {...salaryForm}>
                    <form onSubmit={salaryForm.handleSubmit((d) => createMutation.mutate({ ...d, employeeId: parseInt(d.employeeId) }))} className="space-y-4">
                      <FormField control={salaryForm.control} name="employeeId" render={({ field }) => (
                        <FormItem><FormLabel>الموظف</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue placeholder="اختر موظف" /></SelectTrigger></FormControl>
                            <SelectContent>{employees?.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.fullName}</SelectItem>)}</SelectContent>
                          </Select><FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={salaryForm.control} name="month" render={({ field }) => (
                        <FormItem><FormLabel>الشهر</FormLabel><FormControl><Input type="month" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <div className="grid grid-cols-3 gap-3">
                        <FormField control={salaryForm.control} name="baseSalary" render={({ field }) => (
                          <FormItem><FormLabel>الراتب الأساسي</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={salaryForm.control} name="deductions" render={({ field }) => (
                          <FormItem><FormLabel>الخصومات</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={salaryForm.control} name="bonuses" render={({ field }) => (
                          <FormItem><FormLabel>المكافآت</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      <FormField control={salaryForm.control} name="notes" render={({ field }) => (
                        <FormItem><FormLabel>ملاحظات</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <Button type="submit" className="w-full" disabled={createMutation.isPending}>إضافة</Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              {isLoading ? <Skeleton className="h-64 w-full" /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 px-2">الموظف</th>
                        <th className="py-2 px-2">القسم</th>
                        <th className="py-2 px-2">الشهر</th>
                        <th className="py-2 px-2">الراتب الأساسي</th>
                        <th className="py-2 px-2">الخصومات</th>
                        <th className="py-2 px-2">المكافآت</th>
                        <th className="py-2 px-2">الصافي</th>
                        <th className="py-2 px-2">الحالة</th>
                        <th className="py-2 px-2">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salaries?.data?.map((s) => (
                        <tr key={s.id} className="border-b hover:bg-accent/50">
                          <td className="py-2 px-2 font-medium">{s.employeeName}</td>
                          <td className="py-2 px-2 text-muted-foreground">{s.department || "-"}</td>
                          <td className="py-2 px-2">{s.month}</td>
                          <td className="py-2 px-2">₪{parseFloat(String(s.baseSalary)).toLocaleString()}</td>
                          <td className="py-2 px-2 text-red-600">₪{parseFloat(String(s.deductions || 0)).toLocaleString()}</td>
                          <td className="py-2 px-2 text-green-600">₪{parseFloat(String(s.bonuses || 0)).toLocaleString()}</td>
                          <td className="py-2 px-2 font-bold">₪{parseFloat(String(s.netSalary)).toLocaleString()}</td>
                          <td className="py-2 px-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${s.status === "paid" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                              {s.status === "paid" ? "مدفوع" : "معلق"}
                            </span>
                          </td>
                          <td className="py-2 px-2 flex gap-1">
                            {s.status === "pending" && (
                              <Button size="sm" variant="outline" onClick={() => markPaidMutation.mutate({ id: s.id })}>دفع</Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => { if (confirm("حذف؟")) deleteMutation.mutate({ id: s.id }); }}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {salaries?.data?.length === 0 && <p className="text-center py-8 text-muted-foreground">لا توجد سجلات رواتب لهذا الشهر</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leaves Tab */}
        <TabsContent value="leaves" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={openLeave} onOpenChange={setOpenLeave}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />طلب إجازة جديد</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>تقديم طلب إجازة</DialogTitle></DialogHeader>
                <Form {...leaveForm}>
                  <form onSubmit={leaveForm.handleSubmit((d) => {
                    const days = calcDays(d.startDate, d.endDate);
                    leaveCreateMutation.mutate({
                      employeeId: parseInt(d.employeeId),
                      type: d.type,
                      startDate: new Date(d.startDate),
                      endDate: new Date(d.endDate),
                      days,
                      reason: d.reason,
                    });
                  })} className="space-y-4">
                    <FormField control={leaveForm.control} name="employeeId" render={({ field }) => (
                      <FormItem><FormLabel>الموظف</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger><SelectValue placeholder="اختر موظف" /></SelectTrigger></FormControl>
                          <SelectContent>{employees?.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.fullName}</SelectItem>)}</SelectContent>
                        </Select><FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={leaveForm.control} name="type" render={({ field }) => (
                      <FormItem><FormLabel>نوع الإجازة</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {Object.entries(LEAVE_TYPES).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                          </SelectContent>
                        </Select><FormMessage />
                      </FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={leaveForm.control} name="startDate" render={({ field }) => (
                        <FormItem><FormLabel>تاريخ البداية</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={leaveForm.control} name="endDate" render={({ field }) => (
                        <FormItem><FormLabel>تاريخ النهاية</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                    {leaveForm.watch("startDate") && leaveForm.watch("endDate") && (
                      <p className="text-sm text-muted-foreground">عدد الأيام: {calcDays(leaveForm.watch("startDate"), leaveForm.watch("endDate"))} يوم</p>
                    )}
                    <FormField control={leaveForm.control} name="reason" render={({ field }) => (
                      <FormItem><FormLabel>السبب</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <Button type="submit" className="w-full" disabled={leaveCreateMutation.isPending}>تقديم الطلب</Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 px-2">الموظف</th>
                      <th className="py-2 px-2">نوع الإجازة</th>
                      <th className="py-2 px-2">من</th>
                      <th className="py-2 px-2">إلى</th>
                      <th className="py-2 px-2">الأيام</th>
                      <th className="py-2 px-2">السبب</th>
                      <th className="py-2 px-2">الحالة</th>
                      <th className="py-2 px-2">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves?.data?.map((l) => (
                      <tr key={l.id} className="border-b hover:bg-accent/50">
                        <td className="py-2 px-2 font-medium">{l.employeeName}</td>
                        <td className="py-2 px-2">{LEAVE_TYPES[l.type]}</td>
                        <td className="py-2 px-2">{format(new Date(l.startDate), "d MMM", { locale: arSA })}</td>
                        <td className="py-2 px-2">{format(new Date(l.endDate), "d MMM", { locale: arSA })}</td>
                        <td className="py-2 px-2">{l.days} يوم</td>
                        <td className="py-2 px-2 text-muted-foreground">{l.reason || "-"}</td>
                        <td className="py-2 px-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${LEAVE_STATUS[l.status].className}`}>
                            {LEAVE_STATUS[l.status].label}
                          </span>
                        </td>
                        <td className="py-2 px-2">
                          {l.status === "pending" && (
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" className="text-green-700 border-green-300" onClick={() => leaveStatusMutation.mutate({ id: l.id, status: "approved" })}>قبول</Button>
                              <Button size="sm" variant="outline" className="text-red-700 border-red-300" onClick={() => leaveStatusMutation.mutate({ id: l.id, status: "rejected" })}>رفض</Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {leaves?.data?.length === 0 && <p className="text-center py-8 text-muted-foreground">لا توجد طلبات إجازة</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
