import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";
import { Plus, Trash2, ShoppingBag, Eye } from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending:   { label: "قيد الانتظار", className: "bg-yellow-100 text-yellow-800" },
  confirmed: { label: "مؤكد",         className: "bg-blue-100 text-blue-800" },
  completed: { label: "مكتمل",         className: "bg-green-100 text-green-800" },
  cancelled: { label: "ملغي",          className: "bg-red-100 text-red-800" },
};

const PAYMENT_LABELS: Record<string, { label: string; className: string }> = {
  unpaid:  { label: "غير مدفوع", className: "bg-red-100 text-red-800" },
  partial: { label: "جزئي",      className: "bg-yellow-100 text-yellow-800" },
  paid:    { label: "مدفوع",     className: "bg-green-100 text-green-800" },
};

export default function Orders() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<any>(undefined);
  const [paymentStatus, setPaymentStatus] = useState<any>(undefined);
  const [openCreate, setOpenCreate] = useState(false);
  const [viewOrder, setViewOrder] = useState<any>(null);

  const { data: orders, isLoading, refetch } = trpc.orders.list.useQuery({ search, status, paymentStatus, page, limit: 10 });
  const { data: products } = trpc.products.list.useQuery({ page: 1, limit: 100 });
  const { data: orderDetail } = trpc.orders.getById.useQuery({ id: viewOrder?.id }, { enabled: !!viewOrder?.id });

  const createMutation = trpc.orders.create.useMutation({
    onSuccess: (d) => { toast.success(`تم إنشاء الطلب ${d.orderNumber}`); refetch(); setOpenCreate(false); form.reset(); },
    onError: (e) => toast.error(e.message),
  });

  const updateStatusMutation = trpc.orders.updateStatus.useMutation({
    onSuccess: () => { toast.success("تم تحديث الحالة"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const updatePaymentMutation = trpc.orders.updatePaymentStatus.useMutation({
    onSuccess: () => { toast.success("تم تحديث حالة الدفع"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.orders.delete.useMutation({
    onSuccess: () => { toast.success("تم حذف الطلب"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const form = useForm({
    resolver: zodResolver(z.object({
      customerName: z.string().optional(),
      customerPhone: z.string().optional(),
      notes: z.string().optional(),
      items: z.array(z.object({
        productId: z.string().min(1, "اختر منتجاً"),
        quantity: z.string().min(1),
      })).min(1, "أضف منتجاً واحداً على الأقل"),
    })),
    defaultValues: { customerName: "", customerPhone: "", notes: "", items: [{ productId: "", quantity: "1" }] },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

  const watchItems = form.watch("items");
  const totalPreview = watchItems.reduce((sum, item) => {
    const product = products?.data?.find((p: any) => p.id === parseInt(item.productId));
    if (!product || !item.quantity) return sum;
    return sum + parseFloat(String(product.price)) * parseInt(item.quantity);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">إدارة الطلبات</h1>
          <p className="text-muted-foreground mt-1">متابعة وإدارة طلبات العملاء</p>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />طلب جديد</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>إنشاء طلب جديد</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => createMutation.mutate({
                ...d,
                items: d.items.map(i => ({ productId: parseInt(i.productId), quantity: parseInt(i.quantity) })),
              }))} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="customerName" render={({ field }) => (
                    <FormItem><FormLabel>اسم العميل</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="customerPhone" render={({ field }) => (
                    <FormItem><FormLabel>رقم الهاتف</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <FormLabel>المنتجات *</FormLabel>
                    <Button type="button" size="sm" variant="outline" onClick={() => append({ productId: "", quantity: "1" })}>
                      <Plus className="h-4 w-4 ml-1" />إضافة منتج
                    </Button>
                  </div>
                  {fields.map((field, index) => {
                    const selectedProduct = products?.data?.find((p: any) => p.id === parseInt(watchItems[index]?.productId));
                    return (
                      <div key={field.id} className="flex gap-2 items-start border rounded p-2">
                        <FormField control={form.control} name={`items.${index}.productId`} render={({ field }) => (
                          <FormItem className="flex-1">
                            {index === 0 && <FormLabel>المنتج</FormLabel>}
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl><SelectTrigger><SelectValue placeholder="اختر منتجاً" /></SelectTrigger></FormControl>
                              <SelectContent>
                                {products?.data?.map((p: any) => (
                                  <SelectItem key={p.id} value={String(p.id)}>
                                    {p.name} — ₪{parseFloat(p.price).toFixed(2)} (متاح: {p.stockQuantity})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select><FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                          <FormItem className="w-20">
                            {index === 0 && <FormLabel>الكمية</FormLabel>}
                            <FormControl><Input type="number" min="1" max={selectedProduct?.stockQuantity || 999} {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        {selectedProduct && (
                          <div className="text-xs text-muted-foreground pt-6 w-24">
                            ₪{(parseFloat(String(selectedProduct.price)) * parseInt(watchItems[index]?.quantity || "0")).toFixed(2)}
                          </div>
                        )}
                        {fields.length > 1 && (
                          <Button type="button" size="sm" variant="ghost" className="mt-5" onClick={() => remove(index)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem><FormLabel>ملاحظات</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />

                <div className="flex items-center justify-between p-3 bg-accent rounded">
                  <span className="font-semibold">الإجمالي المتوقع:</span>
                  <span className="text-xl font-bold">₪{totalPreview.toFixed(2)}</span>
                </div>

                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "جارٍ الإنشاء..." : "إنشاء الطلب"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6 flex gap-3 flex-wrap">
          <Input placeholder="بحث برقم الطلب أو اسم العميل..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="flex-1 min-w-[200px]" />
          <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? undefined : v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="الحالة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحالات</SelectItem>
              <SelectItem value="pending">قيد الانتظار</SelectItem>
              <SelectItem value="confirmed">مؤكد</SelectItem>
              <SelectItem value="completed">مكتمل</SelectItem>
              <SelectItem value="cancelled">ملغي</SelectItem>
            </SelectContent>
          </Select>
          <Select value={paymentStatus || "all"} onValueChange={(v) => setPaymentStatus(v === "all" ? undefined : v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="الدفع" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحالات</SelectItem>
              <SelectItem value="unpaid">غير مدفوع</SelectItem>
              <SelectItem value="partial">جزئي</SelectItem>
              <SelectItem value="paid">مدفوع</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => { setSearch(""); setStatus(undefined); setPaymentStatus(undefined); setPage(1); }}>إعادة ضبط</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? <Skeleton className="h-64 w-full" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 px-2">رقم الطلب</th>
                    <th className="py-2 px-2">العميل</th>
                    <th className="py-2 px-2">الهاتف</th>
                    <th className="py-2 px-2">الإجمالي</th>
                    <th className="py-2 px-2">الحالة</th>
                    <th className="py-2 px-2">الدفع</th>
                    <th className="py-2 px-2">التاريخ</th>
                    <th className="py-2 px-2">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {orders?.data?.map((order: any) => (
                    <tr key={order.id} className="border-b hover:bg-accent/50">
                      <td className="py-2 px-2 font-mono font-medium">{order.orderNumber}</td>
                      <td className="py-2 px-2">{order.customerName || "-"}</td>
                      <td className="py-2 px-2">{order.customerPhone || "-"}</td>
                      <td className="py-2 px-2 font-bold">₪{parseFloat(String(order.totalAmount)).toLocaleString()}</td>
                      <td className="py-2 px-2">
                        <Select value={order.status} onValueChange={(v) => updateStatusMutation.mutate({ id: order.id, status: v as any })}>
                          <SelectTrigger className={`h-7 text-xs border-0 ${STATUS_LABELS[order.status].className}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">قيد الانتظار</SelectItem>
                            <SelectItem value="confirmed">مؤكد</SelectItem>
                            <SelectItem value="completed">مكتمل</SelectItem>
                            <SelectItem value="cancelled">ملغي</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 px-2">
                        <Select value={order.paymentStatus} onValueChange={(v) => updatePaymentMutation.mutate({ id: order.id, paymentStatus: v as any })}>
                          <SelectTrigger className={`h-7 text-xs border-0 ${PAYMENT_LABELS[order.paymentStatus].className}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unpaid">غير مدفوع</SelectItem>
                            <SelectItem value="partial">جزئي</SelectItem>
                            <SelectItem value="paid">مدفوع</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{format(new Date(order.createdAt), "d MMM", { locale: arSA })}</td>
                      <td className="py-2 px-2 flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setViewOrder(order)}><Eye className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("حذف الطلب؟")) deleteMutation.mutate({ id: order.id }); }}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {orders?.data?.length === 0 && <p className="text-center py-8 text-muted-foreground">لا توجد طلبات</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">إجمالي: {orders?.total || 0} طلب</p>
        <div className="flex gap-2">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>السابق</Button>
          <Button variant="outline" disabled={page >= (orders?.pages || 1)} onClick={() => setPage(page + 1)}>التالي</Button>
        </div>
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={!!viewOrder} onOpenChange={(o) => !o && setViewOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>تفاصيل الطلب — {viewOrder?.orderNumber}</DialogTitle></DialogHeader>
          {orderDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">العميل:</span> {orderDetail.customerName || "-"}</div>
                <div><span className="text-muted-foreground">الهاتف:</span> {orderDetail.customerPhone || "-"}</div>
                <div><span className="text-muted-foreground">الحالة:</span> {STATUS_LABELS[orderDetail.status]?.label}</div>
                <div><span className="text-muted-foreground">الدفع:</span> {PAYMENT_LABELS[orderDetail.paymentStatus]?.label}</div>
                <div><span className="text-muted-foreground">ملاحظات:</span> {orderDetail.notes || "-"}</div>
                <div><span className="text-muted-foreground">التاريخ:</span> {format(new Date(orderDetail.createdAt), "d MMM yyyy", { locale: arSA })}</div>
              </div>
              <div className="border rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-accent">
                    <tr>
                      <th className="py-2 px-3 text-right">المنتج</th>
                      <th className="py-2 px-3 text-right">الكمية</th>
                      <th className="py-2 px-3 text-right">السعر</th>
                      <th className="py-2 px-3 text-right">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderDetail.items?.map((item: any) => (
                      <tr key={item.id} className="border-t">
                        <td className="py-2 px-3">{item.productName}</td>
                        <td className="py-2 px-3">{item.quantity}</td>
                        <td className="py-2 px-3">₪{parseFloat(item.unitPrice).toFixed(2)}</td>
                        <td className="py-2 px-3 font-bold">₪{parseFloat(item.subtotal).toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className="border-t bg-accent font-bold">
                      <td colSpan={3} className="py-2 px-3">الإجمالي</td>
                      <td className="py-2 px-3">₪{parseFloat(String(orderDetail.totalAmount)).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
