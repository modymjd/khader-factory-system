import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Plus, Edit, Trash2, Power, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";

const productSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  category: z.string().optional(),
  description: z.string().optional(),
  price: z.string().min(1),
  stockQuantity: z.string().min(0),
});

export default function Products() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | undefined>();
  const [openCreate, setOpenCreate] = useState(false);

  const { data: products, isLoading, refetch } = trpc.products.list.useQuery({
    search,
    category: category || undefined,
    status,
    page,
    limit: 10,
  });

  const { data: categories } = trpc.products.getCategories.useQuery();
  const { data: stockAlerts } = trpc.products.getStockAlerts.useQuery();

  const createMutation = trpc.products.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء المنتج بنجاح");
      refetch();
      setOpenCreate(false);
      form.reset();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const toggleStatusMutation = trpc.products.toggleStatus.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث الحالة بنجاح");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.products.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف المنتج بنجاح");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const form = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku: "",
      name: "",
      category: "",
      description: "",
      price: "",
      stockQuantity: "0",
    },
  });

  const onSubmit = (data: any) => {
    createMutation.mutate({
      ...data,
      stockQuantity: parseInt(data.stockQuantity || "0"),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">إدارة المنتجات</h1>
          <p className="text-muted-foreground mt-2">
            إضافة وتحرير وإدارة المنتجات والمخزون
          </p>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              إضافة قطعة جديدة
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>إضافة منتج جديد</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>اسم المنتج</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sku"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SKU</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>التصنيف</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>السعر</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="stockQuantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>الكمية</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
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
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "جاري الإضافة..." : "إضافة"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المنتجات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products?.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">المنتجات النشطة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products?.data?.filter(p => p.isActive).length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">تنبيهات المخزون</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stockAlerts?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">التصنيفات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Input
              placeholder="بحث باسم المنتج أو رمز SKU..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <Select value={category} onValueChange={(v) => {
              setCategory(v === "all" ? "" : v);
              setPage(1);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="جميع التصنيفات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع التصنيفات</SelectItem>
                {categories?.map((cat) => (
                  {cat && <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>}
                ))}
              </SelectContent>
            </Select>
            <Select value={status || ""} onValueChange={(v) => setStatus(v === "all" ? undefined : v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="جميع الحالات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="inactive">غير نشط</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button className="flex-1">تطبيق</Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setSearch("");
                  setCategory("");
                  setStatus(undefined);
                  setPage(1);
                }}
              >
                إعادة ضبط
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-right py-2">صورة</th>
                    <th className="text-right py-2">اسم المنتج</th>
                    <th className="text-right py-2">SKU</th>
                    <th className="text-right py-2">التصنيف</th>
                    <th className="text-right py-2">السعر</th>
                    <th className="text-right py-2">المخزون / حد التنبيه</th>
                    <th className="text-right py-2">الحالة</th>
                    <th className="text-right py-2">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {products?.data?.map((product) => (
                    <tr key={product.id} className="border-b hover:bg-accent/50">
                      <td className="py-2">
                        {product.productImage && (
                          <img
                            src={product.productImage}
                            alt={product.name}
                            className="h-8 w-8 rounded"
                          />
                        )}
                      </td>
                      <td className="py-2">{product.name}</td>
                      <td className="py-2">{product.sku}</td>
                      <td className="py-2">{product.category}</td>
                      <td className="py-2">₪{parseFloat(product.price).toFixed(2)}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-1">
                          {product.stockQuantity <= 5 && (
                            <AlertCircle className="h-4 w-4 text-orange-600" />
                          )}
                          <span>{product.stockQuantity}</span>
                        </div>
                      </td>
                      <td className="py-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${product.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                          {product.isActive ? "نشط" : "غير نشط"}
                        </span>
                      </td>
                      <td className="py-2 flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleStatusMutation.mutate({ id: product.id })}
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate({ id: product.id })}
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
          {products?.data?.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">لا توجد منتجات</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          إجمالي المنتجات: {products?.total || 0}
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
            disabled={page >= (products?.pages || 1)}
            onClick={() => setPage(page + 1)}
          >
            التالي
          </Button>
        </div>
      </div>
    </div>
  );
}
