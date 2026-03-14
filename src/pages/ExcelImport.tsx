import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useQuery } from '@tanstack/react-query';

interface ParsedOrder {
  customer_name: string;
  customer_phone: string;
  customer_code?: string;
  product_name?: string;
  quantity: number;
  price: number;
  delivery_price: number;
  address?: string;
  color?: string;
  size?: string;
  notes?: string;
}

const COLUMN_MAP: Record<string, keyof ParsedOrder> = {
  'اسم العميل': 'customer_name',
  'customer_name': 'customer_name',
  'الاسم': 'customer_name',
  'رقم الهاتف': 'customer_phone',
  'الهاتف': 'customer_phone',
  'الموبايل': 'customer_phone',
  'customer_phone': 'customer_phone',
  'phone': 'customer_phone',
  'كود العميل': 'customer_code',
  'الكود': 'customer_code',
  'customer_code': 'customer_code',
  'المنتج': 'product_name',
  'اسم المنتج': 'product_name',
  'product_name': 'product_name',
  'product': 'product_name',
  'الكمية': 'quantity',
  'quantity': 'quantity',
  'السعر': 'price',
  'price': 'price',
  'سعر التوصيل': 'delivery_price',
  'الشحن': 'delivery_price',
  'delivery_price': 'delivery_price',
  'العنوان': 'address',
  'address': 'address',
  'المحافظة': 'address',
  'اللون': 'color',
  'color': 'color',
  'المقاس': 'size',
  'size': 'size',
  'ملاحظات': 'notes',
  'notes': 'notes',
};

export default function ExcelImport() {
  const [selectedOffice, setSelectedOffice] = useState('');
  const [parsedOrders, setParsedOrders] = useState<ParsedOrder[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: offices = [] } = useQuery({
    queryKey: ['offices-for-import'],
    queryFn: async () => {
      const { data } = await supabase.from('offices').select('id, name').order('name');
      return data || [];
    },
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (raw.length === 0) {
          toast.error('الملف فارغ');
          return;
        }

        const orders: ParsedOrder[] = raw.map((row) => {
          const order: Partial<ParsedOrder> = {};
          for (const [col, val] of Object.entries(row)) {
            const key = COLUMN_MAP[col.trim()];
            if (key) {
              if (key === 'quantity') order[key] = parseInt(String(val)) || 1;
              else if (key === 'price' || key === 'delivery_price') order[key] = parseFloat(String(val)) || 0;
              else (order as any)[key] = String(val).trim();
            }
          }
          return {
            customer_name: order.customer_name || '',
            customer_phone: order.customer_phone || '',
            customer_code: order.customer_code || '',
            product_name: order.product_name || 'بدون منتج',
            quantity: order.quantity || 1,
            price: order.price || 0,
            delivery_price: order.delivery_price || 0,
            address: order.address || '',
            color: order.color || '',
            size: order.size || '',
            notes: order.notes || '',
          };
        });

        setParsedOrders(orders);
        toast.success(`تم قراءة ${orders.length} أوردر من الملف`);
      } catch {
        toast.error('خطأ في قراءة الملف');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!selectedOffice) {
      toast.error('اختر المكتب أولاً');
      return;
    }
    if (parsedOrders.length === 0) {
      toast.error('لا توجد أوردرات للاستيراد');
      return;
    }

    setImporting(true);
    setProgress(0);
    let success = 0;
    let failed = 0;

    // Insert in batches of 20
    const batchSize = 20;
    for (let i = 0; i < parsedOrders.length; i += batchSize) {
      const batch = parsedOrders.slice(i, i + batchSize).map((o) => ({
        customer_name: o.customer_name || 'بدون اسم',
        customer_phone: o.customer_phone || '',
        customer_code: o.customer_code || null,
        product_name: o.product_name || 'بدون منتج',
        quantity: o.quantity,
        price: o.price,
        delivery_price: o.delivery_price,
        address: o.address || '',
        color: o.color || '',
        size: o.size || '',
        notes: o.notes || '',
        office_id: selectedOffice,
        tracking_id: 'temp',
      }));

      const { data, error } = await supabase.from('orders').insert(batch).select('id');
      if (error) {
        failed += batch.length;
      } else {
        success += data.length;
      }
      setProgress(Math.round(((i + batchSize) / parsedOrders.length) * 100));
    }

    setResult({ success, failed });
    setImporting(false);
    setProgress(100);

    if (failed === 0) {
      toast.success(`تم استيراد ${success} أوردر بنجاح`);
    } else {
      toast.error(`نجح ${success} وفشل ${failed}`);
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['اسم العميل', 'رقم الهاتف', 'كود العميل', 'المنتج', 'الكمية', 'السعر', 'سعر التوصيل', 'العنوان', 'اللون', 'المقاس', 'ملاحظات'],
      ['أحمد محمد', '01012345678', 'C001', 'تيشيرت', 2, 250, 50, 'القاهرة - المعادي', 'أسود', 'L', ''],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    XLSX.writeFile(wb, 'نموذج_استيراد_الأوردرات.xlsx');
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold">استيراد أوردرات من Excel</h1>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="h-4 w-4 ml-1" />
          تحميل النموذج
        </Button>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">إعدادات الاستيراد</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">اختر المكتب</label>
              <Select value={selectedOffice} onValueChange={setSelectedOffice}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="اختر المكتب..." />
                </SelectTrigger>
                <SelectContent>
                  {offices.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">ملف Excel</label>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFile}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full border-dashed border-2 border-border h-10"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4 ml-1" />
                {fileName || 'اختر ملف Excel'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {parsedOrders.length > 0 && (
        <>
          <Card className="bg-card border-border">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                معاينة البيانات ({parsedOrders.length} أوردر)
              </CardTitle>
              <Button onClick={handleImport} disabled={importing || !selectedOffice}>
                {importing ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Upload className="h-4 w-4 ml-1" />}
                {importing ? 'جاري الاستيراد...' : `استيراد ${parsedOrders.length} أوردر`}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {importing && (
                <div className="px-4 pb-3">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1 text-center">{progress}%</p>
                </div>
              )}

              {result && (
                <div className="px-4 pb-3 flex gap-3">
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle2 className="h-3 w-3 ml-1" />
                    نجح: {result.success}
                  </Badge>
                  {result.failed > 0 && (
                    <Badge variant="destructive">
                      <XCircle className="h-3 w-3 ml-1" />
                      فشل: {result.failed}
                    </Badge>
                  )}
                </div>
              )}

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-right">#</TableHead>
                      <TableHead className="text-right">العميل</TableHead>
                      <TableHead className="text-right">الهاتف</TableHead>
                      <TableHead className="text-right">الكود</TableHead>
                      <TableHead className="text-right">المنتج</TableHead>
                      <TableHead className="text-right">الكمية</TableHead>
                      <TableHead className="text-right">السعر</TableHead>
                      <TableHead className="text-right">التوصيل</TableHead>
                      <TableHead className="text-right">العنوان</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedOrders.slice(0, 50).map((o, i) => (
                      <TableRow key={i} className="border-border">
                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="text-sm font-medium">{o.customer_name || '-'}</TableCell>
                        <TableCell className="text-sm" dir="ltr">{o.customer_phone || '-'}</TableCell>
                        <TableCell className="text-sm">{o.customer_code || '-'}</TableCell>
                        <TableCell className="text-sm">{o.product_name}</TableCell>
                        <TableCell className="text-sm">{o.quantity}</TableCell>
                        <TableCell className="text-sm font-bold">{o.price}</TableCell>
                        <TableCell className="text-sm">{o.delivery_price}</TableCell>
                        <TableCell className="text-sm">{o.address || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsedOrders.length > 50 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    يتم عرض أول 50 أوردر فقط... الباقي ({parsedOrders.length - 50}) سيتم استيرادهم أيضاً
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {parsedOrders.length === 0 && !fileName && (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center space-y-3">
            <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium">ارفع ملف Excel لاستيراد الأوردرات</p>
              <p className="text-sm text-muted-foreground mt-1">
                الأعمدة المطلوبة: اسم العميل، رقم الهاتف، السعر
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                حمّل النموذج للتعرف على الصيغة المطلوبة
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
