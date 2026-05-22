import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subDays } from "date-fns";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";

export default function Analytics() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: revenueChart, isLoading: revenueLoading } = trpc.analytics.getRevenueChart.useQuery({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  });

  const { data: orderVolumeChart, isLoading: volumeLoading } = trpc.analytics.getOrderVolumeChart.useQuery({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  });

  const { data: dailyPerformance, isLoading: performanceLoading } = trpc.analytics.getDailyPerformance.useQuery({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    page: 1,
    limit: 30,
  });

  const { data: comparison } = trpc.analytics.getSalesComparison.useQuery({
    period1Start: subDays(new Date(startDate), 30),
    period1End: new Date(startDate),
    period2Start: new Date(startDate),
    period2End: new Date(endDate),
  });

  const handleExportPDF = () => {
    toast.success("سيتم تحميل التقرير قريباً");
  };

  const handleExportCSV = () => {
    toast.success("سيتم تحميل البيانات قريباً");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">تحليلات المبيعات</h1>
          <p className="text-muted-foreground mt-2">
            عرض شامل لأداء المبيعات والإيرادات والطلبات
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportPDF}>
            <FileText className="mr-2 h-4 w-4" />
            تحميل PDF
          </Button>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            تحميل CSV
          </Button>
        </div>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium">من</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium">إلى</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Button>تطبيق</Button>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">مقارنة الإيرادات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">الفترة الأولى</p>
                <p className="text-2xl font-bold">₪{comparison?.period1?.revenue?.toFixed(2) || "0.00"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">الفترة الثانية</p>
                <p className="text-2xl font-bold">₪{comparison?.period2?.revenue?.toFixed(2) || "0.00"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">نسبة التغير</p>
                <p className={`text-lg font-semibold ${(comparison?.revenueChange || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {(comparison?.revenueChange || 0).toFixed(2)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">مقارنة الطلبات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">الفترة الأولى</p>
                <p className="text-2xl font-bold">{comparison?.period1?.orderCount || 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">الفترة الثانية</p>
                <p className="text-2xl font-bold">{comparison?.period2?.orderCount || 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">نسبة التغير</p>
                <p className={`text-lg font-semibold ${(comparison?.orderChange || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {(comparison?.orderChange || 0).toFixed(2)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle>الإيرادات</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueChart || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => `₪${value}`} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#3b82f6" name="الإيرادات" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Order Volume Chart */}
        <Card>
          <CardHeader>
            <CardTitle>حجم الطلبات</CardTitle>
          </CardHeader>
          <CardContent>
            {volumeLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={orderVolumeChart || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="orders" fill="#10b981" name="الطلبات" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>الأداء اليومي</CardTitle>
        </CardHeader>
        <CardContent>
          {performanceLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-right py-2">التاريخ</th>
                    <th className="text-right py-2">إجمالي الطلبات</th>
                    <th className="text-right py-2">الطلبات المكتملة</th>
                    <th className="text-right py-2">الإيرادات</th>
                    <th className="text-right py-2">متوسط قيمة الطلب</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyPerformance?.data?.map((day) => (
                    <tr key={day.date} className="border-b hover:bg-accent/50">
                      <td className="py-2">{day.date}</td>
                      <td className="py-2">{day.totalOrders}</td>
                      <td className="py-2">{day.completedOrders}</td>
                      <td className="py-2">₪{day.totalRevenue.toFixed(2)}</td>
                      <td className="py-2">₪{day.avgOrderValue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {dailyPerformance?.data?.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">لا توجد بيانات للفترة المختارة</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
