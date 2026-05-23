import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Plus, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Orders() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"pending" | "confirmed" | "completed" | "cancelled" | undefined>();
  const [paymentStatus, setPaymentStatus] = useState<"unpaid" | "paid" | "refunded" | undefined>();
  const [openCreate, setOpenCreate] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const { data: orders, isLoading, refetch } = trpc.orders.list.useQuery({
    search,
    status,
    paymentStatus,
    page,
    limit: 10,
  });

  const updateStatusMutation = trpc.orders.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث حالة الطلب بنجاح");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updatePaymentMutation = trpc.orders.updatePaymentStatus.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث حالة الدفع بنجاح");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.orders.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الطلب بنجاح");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getPaymentColor = (status: string) => {
    const colors: Record<string, string> = {
      unpaid: "bg-red-100 text-red-800",
      paid: "bg-green-100 text-green-800",
      refunded: "bg-blue-100 text-blue-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">إدارة الطلبات</h1>
          <p className="text-muted-foreground mt-2">
            إنشاء وإدارة الطلبات وتتبع حالتها
          </p>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              إنشاء طلب جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>إنشاء طلب جديد</DialogTitle>
            </DialogHeader>
            <div className="text-center py-8">
              <p className="text-muted-foreground">سيتم تطوير هذه الميزة قريباً</p>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Input
              placeholder="ابحث برقم الطلب..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <Select value={status || ""} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="حالة الطلب" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="pending">قيد الانتظار</SelectItem>
                <SelectItem value="confirmed">مؤكد</SelectItem>
                <SelectItem value="completed">مكتمل</SelectItem>
                <SelectItem value="cancelled">ملغى</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paymentStatus || ""} onValueChange={(v) => setPaymentStatus(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="حالة الدفع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="unpaid">لم يتم الدفع</SelectItem>
                <SelectItem value="paid">مدفوع</SelectItem>
                <SelectItem value="refunded">مسترجع</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button className="flex-1">تطبيق</Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setSearch("");
                  setStatus(undefined);
                  setPaymentStatus(undefined);
                  setPage(1);
                }}
              >
                إعادة ضبط
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-right py-2">رقم الطلب</th>
                    <th className="text-right py-2">المبلغ الإجمالي</th>
                    <th className="text-right py-2">حالة الطلب</th>
                    <th className="text-right py-2">حالة الدفع</th>
                    <th className="text-right py-2">التاريخ</th>
                    <th className="text-right py-2">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {orders?.data?.map((order) => (
                    <tr key={order.id} className="border-b hover:bg-accent/50">
                      <td className="py-2 font-medium">{order.orderNumber}</td>
                      <td className="py-2">₪{parseFloat(order.totalAmount).toFixed(2)}</td>
                      <td className="py-2">
                        <Select
                          value={order.status}
                          onValueChange={(newStatus) =>
                            updateStatusMutation.mutate({
                              id: order.id,
                              status: newStatus as any,
                            })
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">قيد الانتظار</SelectItem>
                            <SelectItem value="confirmed">مؤكد</SelectItem>
                            <SelectItem value="completed">مكتمل</SelectItem>
                            <SelectItem value="cancelled">ملغى</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2">
                        <Select
                          value={order.paymentStatus}
                          onValueChange={(newStatus) =>
                            updatePaymentMutation.mutate({
                              id: order.id,
                              paymentStatus: newStatus as any,
                            })
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unpaid">لم يتم الدفع</SelectItem>
                            <SelectItem value="paid">مدفوع</SelectItem>
                            <SelectItem value="refunded">مسترجع</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2">{format(new Date(order.createdAt), "d MMM yyyy")}</td>
                      <td className="py-2 flex gap-2">
                        <Button size="sm" variant="ghost">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate({ id: order.id })}
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
          {orders?.data?.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">لا توجد طلبات</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          إجمالي الطلبات: {orders?.total || 0}
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
            disabled={page >= (orders?.pages || 1)}
            onClick={() => setPage(page + 1)}
          >
            التالي
          </Button>
        </div>
      </div>
    </div>
  );
}
