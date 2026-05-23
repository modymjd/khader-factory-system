import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";
import { QrCode, Camera, UserCheck, Download } from "lucide-react";
import { toast } from "sonner";

export default function Attendance() {
  const [tab, setTab] = useState("manual");
  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [scanMode, setScanMode] = useState<"checkin" | "checkout" | null>(null);
  const [page, setPage] = useState(1);
  const [qrEmployee, setQrEmployee] = useState<any>(null);
  const [openQrDialog, setOpenQrDialog] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { data: employees } = trpc.attendance.searchEmployees.useQuery({ search: search || "" });
  const { data: allQRCodes } = trpc.attendance.getAllQRCodes.useQuery();
  const { data: records, isLoading, refetch } = trpc.attendance.list.useQuery({ page, limit: 20 });
  const { data: stats } = trpc.attendance.getStatistics.useQuery({});

  const checkInManualMutation = trpc.attendance.checkInManual.useMutation({
    onSuccess: () => { toast.success("تم تسجيل الحضور ✅"); refetch(); setSelectedEmployee(null); },
    onError: (e) => toast.error(e.message),
  });

  const checkOutManualMutation = trpc.attendance.checkOutManual.useMutation({
    onSuccess: () => { toast.success("تم تسجيل المغادرة ✅"); refetch(); setSelectedEmployee(null); },
    onError: (e) => toast.error(e.message),
  });

  const checkInQRMutation = trpc.attendance.checkInQR.useMutation({
    onSuccess: () => { toast.success("تم تسجيل الحضور عبر QR ✅"); refetch(); stopCamera(); setScanMode(null); },
    onError: (e) => { toast.error(e.message); stopCamera(); setScanMode(null); },
  });

  const checkOutQRMutation = trpc.attendance.checkOutQR.useMutation({
    onSuccess: () => { toast.success("تم تسجيل المغادرة عبر QR ✅"); refetch(); stopCamera(); setScanMode(null); },
    onError: (e) => { toast.error(e.message); stopCamera(); setScanMode(null); },
  });

  const generateQRMutation = trpc.attendance.generateQRCode.useMutation({
    onSuccess: (data) => { setQrEmployee(data); setOpenQrDialog(true); },
    onError: (e) => toast.error(e.message),
  });

  const startCamera = async (mode: "checkin" | "checkout") => {
    setScanMode(mode);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      // Use BarcodeDetector if available
      if ("BarcodeDetector" in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
        const interval = setInterval(async () => {
          if (!videoRef.current) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              clearInterval(interval);
              const value = barcodes[0].rawValue;
              if (mode === "checkin") checkInQRMutation.mutate({ qrCodeValue: value });
              else checkOutQRMutation.mutate({ qrCodeValue: value });
            }
          } catch {}
        }, 500);
        return () => clearInterval(interval);
      } else {
        toast.error("المتصفح لا يدعم قراءة QR. استخدم Chrome.");
        stopCamera();
        setScanMode(null);
      }
    } catch {
      toast.error("لا يمكن الوصول للكاميرا");
      setScanMode(null);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setScanMode(null);
  };

  const downloadQR = (qrCode: string, name: string) => {
    const a = document.createElement("a");
    a.href = qrCode;
    a.download = `qr-${name}.png`;
    a.click();
  };

  // Today's records
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">الحضور والانصراف</h1>
          <p className="text-muted-foreground mt-1">{format(new Date(), "EEEE، d MMMM yyyy", { locale: arSA })}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { title: "إجمالي السجلات", value: stats?.totalRecords || 0 },
          { title: "اكتملت المناوبة", value: stats?.completedRecords || 0 },
          { title: "لم يسجلوا انصرافاً", value: stats?.pendingRecords || 0 },
        ].map(s => (
          <Card key={s.title}>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold">{s.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); stopCamera(); }}>
        <TabsList>
          <TabsTrigger value="manual"><UserCheck className="h-4 w-4 ml-2" />تسجيل يدوي</TabsTrigger>
          <TabsTrigger value="qr"><Camera className="h-4 w-4 ml-2" />QR / كاميرا</TabsTrigger>
          <TabsTrigger value="qrcodes"><QrCode className="h-4 w-4 ml-2" />رموز QR</TabsTrigger>
          <TabsTrigger value="records">سجل الحضور</TabsTrigger>
        </TabsList>

        {/* Manual Tab */}
        <TabsContent value="manual" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>تسجيل الحضور / الانصراف يدوياً</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="ابحث باسم الموظف..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {employees && employees.length > 0 && (
                <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  {employees.map((emp) => (
                    <div key={emp.id}
                      className={`flex items-center justify-between p-3 cursor-pointer hover:bg-accent border-b last:border-0 ${selectedEmployee?.id === emp.id ? "bg-accent" : ""}`}
                      onClick={() => setSelectedEmployee(emp)}
                    >
                      <div>
                        <p className="font-medium">{emp.fullName}</p>
                        <p className="text-xs text-muted-foreground">{emp.department} — {emp.jobTitle}</p>
                      </div>
                      {selectedEmployee?.id === emp.id && (
                        <div className="flex gap-2">
                          <Button size="sm" className="bg-green-600 hover:bg-green-700"
                            onClick={(e) => { e.stopPropagation(); checkInManualMutation.mutate({ employeeId: emp.id }); }}
                            disabled={checkInManualMutation.isPending}
                          >حضور</Button>
                          <Button size="sm" variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              const todayRecord = records?.data?.find(r => r.employeeId === emp.id && new Date(r.date) >= today);
                              if (todayRecord) checkOutManualMutation.mutate({ attendanceId: todayRecord.id });
                              else toast.error("لا يوجد تسجيل حضور لهذا الموظف اليوم");
                            }}
                            disabled={checkOutManualMutation.isPending}
                          >انصراف</Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {employees?.length === 0 && search && <p className="text-center text-muted-foreground py-4">لا توجد نتائج</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* QR Camera Tab */}
        <TabsContent value="qr" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>تسجيل عبر رمز QR والكاميرا</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {!scanMode ? (
                <div className="flex gap-4 justify-center">
                  <Button className="bg-green-600 hover:bg-green-700 h-16 px-8" onClick={() => startCamera("checkin")}>
                    <Camera className="ml-2 h-5 w-5" />تسجيل حضور بـ QR
                  </Button>
                  <Button variant="outline" className="h-16 px-8" onClick={() => startCamera("checkout")}>
                    <Camera className="ml-2 h-5 w-5" />تسجيل انصراف بـ QR
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-center text-sm font-medium text-muted-foreground">
                    {scanMode === "checkin" ? "🟢 جاري تسجيل الحضور — وجّه الكاميرا نحو رمز QR" : "🔴 جاري تسجيل الانصراف — وجّه الكاميرا نحو رمز QR"}
                  </p>
                  <div className="relative rounded-xl overflow-hidden border-2 border-dashed border-primary max-w-sm mx-auto">
                    <video ref={videoRef} autoPlay playsInline className="w-full" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-48 border-4 border-primary rounded-xl opacity-50" />
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <Button variant="outline" onClick={stopCamera}>إلغاء</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* QR Codes Tab */}
        <TabsContent value="qrcodes" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>رموز QR للموظفين</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {allQRCodes?.map((emp) => (
                  <Card key={emp.id} className="text-center">
                    <CardContent className="pt-4 space-y-2">
                      <p className="font-medium text-sm">{emp.fullName}</p>
                      <p className="text-xs text-muted-foreground">{emp.department}</p>
                      {emp.qrCode ? (
                        <>
                          <img src={emp.qrCode} alt="QR" className="mx-auto w-24 h-24" />
                          <div className="flex gap-1 justify-center">
                            <Button size="sm" variant="outline" onClick={() => downloadQR(emp.qrCode!, emp.fullName)}>
                              <Download className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => generateQRMutation.mutate({ employeeId: emp.id })}>تجديد</Button>
                          </div>
                        </>
                      ) : (
                        <Button size="sm" onClick={() => generateQRMutation.mutate({ employeeId: emp.id })} disabled={generateQRMutation.isPending}>
                          <QrCode className="ml-1 h-3 w-3" />توليد QR
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Records Tab */}
        <TabsContent value="records">
          <Card>
            <CardContent className="pt-6">
              {isLoading ? <Skeleton className="h-64 w-full" /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 px-2">الموظف</th>
                        <th className="py-2 px-2">التاريخ</th>
                        <th className="py-2 px-2">وقت الحضور</th>
                        <th className="py-2 px-2">طريقة الحضور</th>
                        <th className="py-2 px-2">وقت الانصراف</th>
                        <th className="py-2 px-2">طريقة الانصراف</th>
                        <th className="py-2 px-2">ساعات العمل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records?.data?.map((r) => {
                        const hours = r.checkInTime && r.checkOutTime
                          ? ((new Date(r.checkOutTime).getTime() - new Date(r.checkInTime).getTime()) / 3600000).toFixed(1)
                          : "-";
                        return (
                          <tr key={r.id} className="border-b hover:bg-accent/50">
                            <td className="py-2 px-2 font-medium">{r.employeeName}</td>
                            <td className="py-2 px-2">{format(new Date(r.date), "d MMM yyyy", { locale: arSA })}</td>
                            <td className="py-2 px-2 text-green-700">{r.checkInTime ? format(new Date(r.checkInTime), "HH:mm") : "-"}</td>
                            <td className="py-2 px-2 text-xs">{r.checkInMethod === "qr" ? "QR" : r.checkInMethod === "manual" ? "يدوي" : "-"}</td>
                            <td className="py-2 px-2 text-red-700">{r.checkOutTime ? format(new Date(r.checkOutTime), "HH:mm") : "-"}</td>
                            <td className="py-2 px-2 text-xs">{r.checkOutMethod === "qr" ? "QR" : r.checkOutMethod === "manual" ? "يدوي" : "-"}</td>
                            <td className="py-2 px-2 font-medium">{hours !== "-" ? `${hours} ساعة` : "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {records?.data?.length === 0 && <p className="text-center py-8 text-muted-foreground">لا توجد سجلات</p>}
                </div>
              )}
              <div className="flex justify-between items-center mt-4">
                <p className="text-sm text-muted-foreground">إجمالي: {records?.total || 0} سجل</p>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>السابق</Button>
                  <Button variant="outline" disabled={page >= (records?.pages || 1)} onClick={() => setPage(page + 1)}>التالي</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* QR Dialog */}
      <Dialog open={openQrDialog} onOpenChange={setOpenQrDialog}>
        <DialogContent className="text-center max-w-sm">
          <DialogHeader><DialogTitle>رمز QR — {qrEmployee?.employeeName}</DialogTitle></DialogHeader>
          {qrEmployee?.qrCode && <img src={qrEmployee.qrCode} alt="QR" className="mx-auto w-48 h-48" />}
          <Button onClick={() => downloadQR(qrEmployee?.qrCode, qrEmployee?.employeeName)}>
            <Download className="ml-2 h-4 w-4" />تحميل الرمز
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
