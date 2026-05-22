import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Users, UserCheck, Shield, Activity } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: metrics, isLoading: metricsLoading } = trpc.dashboard.getMetrics.useQuery();
  const { data: activityChart, isLoading: chartLoading } = trpc.dashboard.getActivityChart.useQuery();
  const { data: latestUsers, isLoading: usersLoading } = trpc.dashboard.getLatestUsers.useQuery();
  const { data: latestLogs, isLoading: logsLoading } = trpc.dashboard.getLatestAuditLogs.useQuery();

  const KPICard = ({ icon: Icon, label, value, loading }: any) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">لوحة المعلومات</h1>
        <p className="text-muted-foreground mt-2">
          نظرة عامة شاملة على أداء النظام وإدارة المستخدمين
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {format(new Date(), "EEEE، d MMMM yyyy", { locale: arSA })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          icon={Users}
          label="إجمالي المستخدمين"
          value={metrics?.totalUsers || 0}
          loading={metricsLoading}
        />
        <KPICard
          icon={UserCheck}
          label="المستخدمون النشطون"
          value={metrics?.activeUsers || 0}
          loading={metricsLoading}
        />
        <KPICard
          icon={Shield}
          label="عدد الأدوار"
          value={metrics?.totalRoles || 0}
          loading={metricsLoading}
        />
        <KPICard
          icon={Activity}
          label="العمليات الأخيرة"
          value={metrics?.recentOperations || 0}
          loading={metricsLoading}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Activity Chart */}
        <Card>
          <CardHeader>
            <CardTitle>توزيع العمليات</CardTitle>
            <p className="text-sm text-muted-foreground">
              حجم العمليات المنفذة خلال آخر 7 أيام
            </p>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={activityChart || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="operations" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Placeholder for second chart */}
        <Card>
          <CardHeader>
            <CardTitle>الوصول السريع</CardTitle>
            <p className="text-sm text-muted-foreground">
              اختصارات سريعة لإدارة أقسام النظام
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              <button className="p-3 rounded-lg border border-border hover:bg-accent transition-colors text-sm font-medium">
                إدارة المستخدمين
              </button>
              <button className="p-3 rounded-lg border border-border hover:bg-accent transition-colors text-sm font-medium">
                الأدوار
              </button>
              <button className="p-3 rounded-lg border border-border hover:bg-accent transition-colors text-sm font-medium">
                سجل العمليات
              </button>
              <button className="p-3 rounded-lg border border-border hover:bg-accent transition-colors text-sm font-medium">
                الإعدادات
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Latest Users */}
      <Card>
        <CardHeader>
          <CardTitle>أحدث المستخدمين</CardTitle>
          <a href="/users" className="text-sm text-primary hover:underline">
            عرض الكل
          </a>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-right py-2">الاسم</th>
                    <th className="text-right py-2">الدور</th>
                    <th className="text-right py-2">الحالة</th>
                    <th className="text-right py-2">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {latestUsers?.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-accent/50">
                      <td className="py-2">{user.username}</td>
                      <td className="py-2">{user.roleId}</td>
                      <td className="py-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${user.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                          {user.isActive ? "نشط" : "غير نشط"}
                        </span>
                      </td>
                      <td className="py-2">{format(new Date(user.createdAt), "d MMM yyyy")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Latest Audit Logs */}
      <Card>
        <CardHeader>
          <CardTitle>أحدث سجلات النظام</CardTitle>
          <a href="/auditlogs" className="text-sm text-primary hover:underline">
            عرض الكل
          </a>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-right py-2">المنفذ</th>
                    <th className="text-right py-2">العملية</th>
                    <th className="text-right py-2">النوع</th>
                    <th className="text-right py-2">الوقت</th>
                  </tr>
                </thead>
                <tbody>
                  {latestLogs?.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-accent/50">
                      <td className="py-2">{log.actor}</td>
                      <td className="py-2">{log.action}</td>
                      <td className="py-2">{log.resource}</td>
                      <td className="py-2">{format(new Date(log.createdAt), "d MMM yyyy, HH:mm")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
