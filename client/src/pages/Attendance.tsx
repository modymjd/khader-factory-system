import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { QrCode, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function Attendance() {
  const [page, setPage] = useState(1);
  const [employeeId, setEmployeeId] = useState("");
  const [qrValue, setQrValue] = useState("");
  const [manualCheckInTime, setManualCheckInTime] = useState("");
  const [manualCheckOutTime, setManualCheckOutTime] = useState("");
  const [selectedAttendanceId, setSelectedAttendanceId] = useState<number | null>(null);

  const { data: attendance, isLoading, refetch } = trpc.attendance.list.useQuery({
    employeeId: employeeId ? parseInt(employeeId) : undefined,
    page,
    limit: 10,
  });

  const { data: stats } = trpc.attendance.getStatistics.useQuery({
    employeeId: employeeId ? parseInt(employeeId) : undefined,
  });

  const checkInQRMutation = trpc.attendance.checkInQR.useMutation({
    onSuccess: () => {
      toast.success("تم تسجيل الحضور بنجاح");
      setQrValue("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const checkOutQRMutation = trpc.attendance.checkOutQR.useMutation({
    onSuccess: () => {
      toast.success("تم تسجيل المغادرة بنجاح");
      setQrValue("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const checkInManualMutation = trpc.attendance.checkInManual.useMutation({
    onSuccess: () => {
      toast.success("تم تسجيل الحضور اليدوي بنجاح");
      setManualCheckInTime("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const checkOutManualMutation = trpc.attendance.checkOutManual.useMutation({
    onSuccess: () => {
      toast.success("تم تسجيل المغادرة اليدوية بنجاح");
      setManualCheckOutTime("");
      setSelectedAttendanceId(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">نظام الحضور والغياب</h1>
        <p className="text-muted-foreground mt-2">
          تسجيل الحضور والمغادرة باستخدام رمز QR أو الإدخال اليدوي
        </p>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">إجمالي السجلات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalRecords || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">المكتملة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.completedRecords || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">قيد الانتظار</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats?.pendingRecords || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* QR and Manual Entry */}
      <Card>
        <CardHeader>
          <CardTitle>تسجيل الحضور</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="qr" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="qr">
                <QrCode className="mr-2 h-4 w-4" />
                رمز QR
              </TabsTrigger>
              <TabsTrigger value="manual">
                <Clock className="mr-2 h-4 w-4" />
                إدخال يدوي
              </TabsTrigger>
            </TabsList>

            <TabsContent value="qr" className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">أدخل قيمة رمز QR</label>
                <Input
                  placeholder="QR Code Value"
                  value={qrValue}
                  onChange={(e) => setQrValue(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => {
                    if (qrValue) {
                      checkInQRMutation.mutate({ qrCodeValue: qrValue });
                    } else {
                      toast.error("أدخل قيمة رمز QR");
                    }
                  }}
                  disabled={checkInQRMutation.isPending}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  تسجيل الحضور
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    if (qrValue) {
                      checkOutQRMutation.mutate({ qrCodeValue: qrValue });
                    } else {
                      toast.error("أدخل قيمة رمز QR");
                    }
                  }}
                  disabled={checkOutQRMutation.isPending}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  تسجيل المغادرة
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="manual" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">رقم الموظف</label>
                  <Input
                    type="number"
                    placeholder="أدخل رقم الموظف"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">وقت الحضور</label>
                  <Input
                    type="datetime-local"
                    value={manualCheckInTime}
                    onChange={(e) => setManualCheckInTime(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    if (employeeId && manualCheckInTime) {
                      checkInManualMutation.mutate({
                        employeeId: parseInt(employeeId),
                        checkInTime: new Date(manualCheckInTime),
                      });
                    } else {
                      toast.error("أكمل جميع الحقول");
                    }
                  }}
                  disabled={checkInManualMutation.isPending}
                >
                  تسجيل الحضور اليدوي
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Attendance Log */}
      <Card>
        <CardHeader>
          <CardTitle>سجل الحضور</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="ابحث برقم الموظف..."
              value={employeeId}
              onChange={(e) => {
                setEmployeeId(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-right py-2">رقم الموظف</th>
                    <th className="text-right py-2">التاريخ</th>
                    <th className="text-right py-2">وقت الحضور</th>
                    <th className="text-right py-2">وقت المغادرة</th>
                    <th className="text-right py-2">الحالة</th>
                    <th className="text-right py-2">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance?.data?.map((record) => (
                    <tr key={record.id} className="border-b hover:bg-accent/50">
                      <td className="py-2">{record.employeeId}</td>
                      <td className="py-2">{format(new Date(record.date), "d MMM yyyy")}</td>
                      <td className="py-2">
                        {record.checkInTime
                          ? format(new Date(record.checkInTime), "HH:mm:ss")
                          : "-"}
                      </td>
                      <td className="py-2">
                        {record.checkOutTime
                          ? format(new Date(record.checkOutTime), "HH:mm:ss")
                          : "-"}
                      </td>
                      <td className="py-2">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            record.checkOutTime
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {record.checkOutTime ? "مكتمل" : "قيد الانتظار"}
                        </span>
                      </td>
                      <td className="py-2">
                        {!record.checkOutTime && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedAttendanceId(record.id)}
                              >
                                أضف المغادرة
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>تسجيل المغادرة</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <label className="text-sm font-medium">وقت المغادرة</label>
                                  <Input
                                    type="datetime-local"
                                    value={manualCheckOutTime}
                                    onChange={(e) => setManualCheckOutTime(e.target.value)}
                                  />
                                </div>
                                <Button
                                  className="w-full"
                                  onClick={() => {
                                    if (selectedAttendanceId && manualCheckOutTime) {
                                      checkOutManualMutation.mutate({
                                        attendanceId: selectedAttendanceId,
                                        checkOutTime: new Date(manualCheckOutTime),
                                      });
                                    }
                                  }}
                                  disabled={checkOutManualMutation.isPending}
                                >
                                  تسجيل المغادرة
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {attendance?.data?.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">لا توجد سجلات حضور</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          إجمالي السجلات: {attendance?.total || 0}
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
            disabled={page >= (attendance?.pages || 1)}
            onClick={() => setPage(page + 1)}
          >
            التالي
          </Button>
        </div>
      </div>
    </div>
  );
}
