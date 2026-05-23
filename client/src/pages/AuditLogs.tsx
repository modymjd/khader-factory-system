import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subDays } from "date-fns";
import { Eye } from "lucide-react";

export default function AuditLogs() {
  const [page, setPage] = useState(1);
  const [actor, setActor] = useState("");
  const [resource, setResource] = useState("");
  const [action, setAction] = useState<"create" | "read" | "update" | "delete" | "login" | "logout" | undefined>();
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const { data: logs, isLoading, refetch } = trpc.analytics.getAuditLogs.useQuery({
    actor: actor ? parseInt(actor) : undefined,
    resource: resource || undefined,
    action,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    page,
    limit: 10,
  });

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      create: "bg-green-100 text-green-800",
      read: "bg-blue-100 text-blue-800",
      update: "bg-yellow-100 text-yellow-800",
      delete: "bg-red-100 text-red-800",
      login: "bg-purple-100 text-purple-800",
      logout: "bg-gray-100 text-gray-800",
    };
    return colors[action] || "bg-gray-100 text-gray-800";
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      create: "إنشاء",
      read: "قراءة",
      update: "تحديث",
      delete: "حذف",
      login: "دخول",
      logout: "خروج",
    };
    return labels[action] || action;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">سجل العمليات</h1>
        <p className="text-muted-foreground mt-2">
          تتبع جميع العمليات والتغييرات في النظام
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <Input
              placeholder="رقم المستخدم"
              value={actor}
              onChange={(e) => {
                setActor(e.target.value);
                setPage(1);
              }}
            />
            <Input
              placeholder="نوع المورد"
              value={resource}
              onChange={(e) => {
                setResource(e.target.value);
                setPage(1);
              }}
            />
            <Select value={action || ""} onValueChange={(v) => setAction(v === "all" ? undefined : v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="نوع العملية" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع العمليات</SelectItem>
                <SelectItem value="create">إنشاء</SelectItem>
                <SelectItem value="read">قراءة</SelectItem>
                <SelectItem value="update">تحديث</SelectItem>
                <SelectItem value="delete">حذف</SelectItem>
                <SelectItem value="login">دخول</SelectItem>
                <SelectItem value="logout">خروج</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
            />
            <div className="flex gap-2">
              <Button className="flex-1">تطبيق</Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setActor("");
                  setResource("");
                  setAction(undefined);
                  setStartDate(format(subDays(new Date(), 30), "yyyy-MM-dd"));
                  setEndDate(format(new Date(), "yyyy-MM-dd"));
                  setPage(1);
                }}
              >
                إعادة ضبط
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-right py-2">المستخدم</th>
                    <th className="text-right py-2">العملية</th>
                    <th className="text-right py-2">النوع</th>
                    <th className="text-right py-2">معرف المورد</th>
                    <th className="text-right py-2">الوقت</th>
                    <th className="text-right py-2">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {logs?.data?.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-accent/50">
                      <td className="py-2">{log.actor}</td>
                      <td className="py-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                          {getActionLabel(log.action)}
                        </span>
                      </td>
                      <td className="py-2">{log.resource}</td>
                      <td className="py-2">{log.resourceId || "-"}</td>
                      <td className="py-2">{format(new Date(log.createdAt), "d MMM yyyy, HH:mm:ss")}</td>
                      <td className="py-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedLog(log)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>تفاصيل السجل</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm font-medium">المستخدم</p>
                                  <p className="text-sm text-muted-foreground">{selectedLog?.actor}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">العملية</p>
                                  <p className="text-sm text-muted-foreground">{getActionLabel(selectedLog?.action)}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">النوع</p>
                                  <p className="text-sm text-muted-foreground">{selectedLog?.resource}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">معرف المورد</p>
                                  <p className="text-sm text-muted-foreground">{selectedLog?.resourceId || "-"}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">عنوان IP</p>
                                  <p className="text-sm text-muted-foreground">{selectedLog?.ipAddress}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">الوقت</p>
                                  <p className="text-sm text-muted-foreground">
                                    {format(new Date(selectedLog?.createdAt), "d MMM yyyy, HH:mm:ss")}
                                  </p>
                                </div>
                              </div>
                              <div>
                                <p className="text-sm font-medium">التغييرات</p>
                                <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-40">
                                  {JSON.stringify(selectedLog?.changes, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {logs?.data?.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">لا توجد سجلات</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          إجمالي السجلات: {logs?.total || 0}
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
            disabled={page >= (logs?.pages || 1)}
            onClick={() => setPage(page + 1)}
          >
            التالي
          </Button>
        </div>
      </div>
    </div>
  );
}
