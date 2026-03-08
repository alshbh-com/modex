import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLogger';
import { Copy, Plus, Search } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

const DIARY_STATUSES = [
  'بدون حالة', 'تم التسليم', 'مؤجل', 'مرتجع', 'تسليم جزئي',
  'فرق شحن', 'تحويلة تسليم', 'رفض دون شحن', 'غرامة مرتجع',
];

const RETURN_STATUSES = ['مرتجع', 'فرق شحن', 'تحويلة تسليم', 'رفض دون شحن', 'غرامة مرتجع'];

interface Props {
  diary: any;
  diaryOrders: any[];
  onCopyOrder: (orderId: string) => void;
}

export default function OrangeSheet({ diary, diaryOrders, onCopyOrder }: Props) {
  const qc = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [searchBarcode, setSearchBarcode] = useState('');
  const [filterTerm, setFilterTerm] = useState('');
  const [partialDialog, setPartialDialog] = useState<{ open: boolean; diaryOrderId: string; order: any } | null>(null);
  const [collectedAmount, setCollectedAmount] = useState('');

  const { data: searchResults = [] } = useQuery({
    queryKey: ['search-orders-orange', searchBarcode],
    queryFn: async () => {
      if (!searchBarcode.trim()) return [];
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .or(`barcode.ilike.%${searchBarcode}%,customer_name.ilike.%${searchBarcode}%,tracking_id.ilike.%${searchBarcode}%`)
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: searchBarcode.length >= 2,
  });

  const addOrderToDiary = useMutation({
    mutationFn: async (orderId: string) => {
      if (diary.prevent_new_orders) throw new Error('الإضافة ممنوعة في هذه اليومية');
      if (diary.is_closed) throw new Error('اليومية مقفولة');
      const { error } = await supabase
        .from('diary_orders')
        .insert({ order_id: orderId, diary_id: diary.id });
      if (error) throw error;
      await logActivity('إضافة أوردر يدوي للشيت البرتقالي', { order_id: orderId, diary_id: diary.id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diary-orders', diary.id] });
      toast.success('تم إضافة الأوردر');
      setAddDialogOpen(false);
      setSearchBarcode('');
    },
    onError: (e: any) => toast.error(e.message || 'الأوردر موجود بالفعل'),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, partial }: { id: string; status: string; partial?: number }) => {
      if (diary.lock_status_updates) throw new Error('التعديل مقفل');
      const update: any = { status_inside_diary: status };
      if (partial !== undefined) update.partial_amount = partial;
      const { error } = await supabase.from('diary_orders').update(update).eq('id', id);
      if (error) throw error;
      await logActivity('تغيير حالة في الشيت البرتقالي', { diary_order_id: id, new_status: status });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['diary-orders', diary.id] }),
    onError: (e: any) => toast.error(e.message),
  });

  const handleStatusChange = (dOrder: any, newStatus: string) => {
    if (diary.lock_status_updates) {
      toast.error('تعديل الحالات مقفل');
      return;
    }
    if (newStatus === 'تسليم جزئي') {
      setPartialDialog({ open: true, diaryOrderId: dOrder.id, order: dOrder.orders });
      setCollectedAmount('');
      return;
    }
    updateStatus.mutate({ id: dOrder.id, status: newStatus, partial: 0 });
  };

  const handlePartialSubmit = () => {
    if (!partialDialog) return;
    const collected = parseFloat(collectedAmount);
    const shipping = partialDialog.order?.delivery_price || 0;
    if (isNaN(collected) || collected <= 0) { toast.error('أدخل مبلغ صحيح'); return; }
    if (collected < shipping) toast.warning('المبلغ المحصل أقل من الشحن!');
    updateStatus.mutate({
      id: partialDialog.diaryOrderId,
      status: 'تسليم جزئي',
      partial: Math.max(0, collected - shipping),
    });
    setPartialDialog(null);
  };

  // Filter
  const filtered = diaryOrders.filter((dOrder: any) => {
    if (!filterTerm) return true;
    const o = dOrder.orders;
    const t = filterTerm.toLowerCase();
    return o?.customer_name?.toLowerCase().includes(t) || o?.barcode?.toLowerCase().includes(t) || o?.address?.toLowerCase().includes(t);
  });

  // Totals
  const totalAmount = filtered.reduce((s: number, d: any) => s + (d.orders?.price || 0) + (d.orders?.delivery_price || 0), 0);
  const totalShipping = filtered.reduce((s: number, d: any) => s + (d.orders?.delivery_price || 0), 0);
  const totalPickup = filtered.reduce((s: number, d: any) => s + (Number(d.orders?.shipping_paid) || 0), 0);
  const totalDelivered = filtered.filter((d: any) => d.status_inside_diary === 'تم التسليم')
    .reduce((s: number, d: any) => s + (d.orders?.price || 0) + (d.orders?.delivery_price || 0), 0);
  const totalPartialDelivered = filtered.filter((d: any) => d.status_inside_diary === 'تسليم جزئي')
    .reduce((s: number, d: any) => s + (d.partial_amount || 0) + (d.orders?.delivery_price || 0), 0);
  const totalArrived = totalDelivered + totalPartialDelivered;
  const totalDue = totalAmount - (totalShipping + totalArrived + totalPickup);

  return (
    <>
      <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground">الشيت البرتقالي</h3>
          <span className="text-sm text-muted-foreground">({filtered.length} أوردر)</span>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="بحث..."
            value={filterTerm}
            onChange={(e) => setFilterTerm(e.target.value)}
            className="w-48 h-8 text-sm"
          />
          <Button size="sm" onClick={() => setAddDialogOpen(true)} disabled={diary.prevent_new_orders || diary.is_closed}>
            <Plus className="h-4 w-4 ml-1" /> إضافة أوردر
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-orange-50 dark:bg-orange-950/20">
              <TableHead className="text-right w-8">#</TableHead>
              <TableHead className="text-right">الباركود</TableHead>
              <TableHead className="text-right">الاسم</TableHead>
              <TableHead className="text-right">العنوان</TableHead>
              <TableHead className="text-right">عدد القطع</TableHead>
              <TableHead className="text-right">الإجمالي</TableHead>
              <TableHead className="text-right">الشحن</TableHead>
              <TableHead className="text-right">بيك اب</TableHead>
              <TableHead className="text-right">الواصل</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
              <TableHead className="text-right">حالة المرتجع</TableHead>
              <TableHead className="text-right w-12">نسخ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">لا توجد أوردرات</TableCell>
              </TableRow>
            ) : (
              filtered.map((dOrder: any, idx: number) => {
                const order = dOrder.orders;
                const total = (order?.price || 0) + (order?.delivery_price || 0);
                const isReturn = RETURN_STATUSES.includes(dOrder.status_inside_diary) || dOrder.status_inside_diary === 'تسليم جزئي';
                const deliveredAmount = dOrder.status_inside_diary === 'تم التسليم' ? total :
                  dOrder.status_inside_diary === 'تسليم جزئي' ? (dOrder.partial_amount || 0) + (order?.delivery_price || 0) : 0;

                return (
                  <TableRow key={dOrder.id}>
                    <TableCell className="text-sm">{idx + 1}</TableCell>
                    <TableCell className="text-sm font-mono">{order?.barcode}</TableCell>
                    <TableCell className="text-sm font-medium">{order?.customer_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{order?.address}</TableCell>
                    <TableCell className="text-sm text-center">{order?.quantity}</TableCell>
                    <TableCell className="text-sm font-medium">{total}</TableCell>
                    <TableCell className="text-sm">{order?.delivery_price}</TableCell>
                    <TableCell className="text-sm">{order?.shipping_paid || 0}</TableCell>
                    <TableCell className="text-sm font-medium text-green-600">{deliveredAmount || ''}</TableCell>
                    <TableCell>
                      <Select
                        value={dOrder.status_inside_diary}
                        onValueChange={(v) => handleStatusChange(dOrder, v)}
                        disabled={diary.lock_status_updates}
                      >
                        <SelectTrigger className="h-7 text-xs w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DIARY_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{isReturn ? dOrder.status_inside_diary : ''}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onCopyOrder(dOrder.order_id)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
          {filtered.length > 0 && (
            <TableFooter>
              <TableRow className="bg-orange-50/50 dark:bg-orange-950/10 font-bold text-sm">
                <TableCell colSpan={5} className="text-right">الإجمالي</TableCell>
                <TableCell>{totalAmount}</TableCell>
                <TableCell>{totalShipping}</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-green-600">{totalDelivered + totalPartialDelivered}</TableCell>
                <TableCell colSpan={3}></TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      {/* Add Order Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader><DialogTitle>إضافة أوردر إلى الشيت البرتقالي</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pr-9" placeholder="ابحث بالباركود أو الاسم أو رقم التتبع..." value={searchBarcode} onChange={(e) => setSearchBarcode(e.target.value)} />
            </div>
            <div className="max-h-60 overflow-auto space-y-1">
              {searchResults.map((order: any) => (
                <div key={order.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 cursor-pointer border text-sm" onClick={() => addOrderToDiary.mutate(order.id)}>
                  <div className="flex flex-col">
                    <span className="font-medium">{order.customer_name}</span>
                    <span className="text-muted-foreground text-xs">#{order.barcode} | {order.address}</span>
                  </div>
                  <span className="font-medium">{order.price}</span>
                </div>
              ))}
              {searchBarcode.length >= 2 && searchResults.length === 0 && (
                <p className="text-center text-muted-foreground py-4">لا توجد نتائج</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Partial Delivery Dialog */}
      <Dialog open={!!partialDialog?.open} onOpenChange={(o) => !o && setPartialDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>تسليم جزئي</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="bg-muted/50 p-3 rounded text-sm">
              <div>سعر الأوردر: <strong>{partialDialog?.order?.price}</strong></div>
              <div>الشحن: <strong>{partialDialog?.order?.delivery_price}</strong></div>
            </div>
            <div>
              <label className="text-sm font-medium">المبلغ المحصل</label>
              <Input type="number" value={collectedAmount} onChange={(e) => setCollectedAmount(e.target.value)} className="mt-1" />
            </div>
            {collectedAmount && parseFloat(collectedAmount) > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded text-sm border">
                <div>تسليم جزئي = <strong>{Math.max(0, parseFloat(collectedAmount) - (partialDialog?.order?.delivery_price || 0))}</strong></div>
                <div>مرتجع = <strong>{(partialDialog?.order?.price || 0) - Math.max(0, parseFloat(collectedAmount) - (partialDialog?.order?.delivery_price || 0))}</strong></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPartialDialog(null)}>إلغاء</Button>
            <Button onClick={handlePartialSubmit}>تأكيد</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
