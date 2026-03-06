import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLogger';
import { Copy } from 'lucide-react';
import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

const DIARY_STATUSES = [
  'بدون حالة',
  'تم التسليم',
  'مؤجل',
  'مرتجع',
  'تسليم جزئي',
  'فرق شحن',
  'تحويلة تسليم',
  'رفض دون شحن',
  'غرامة مرتجع',
];

const RETURN_STATUSES = ['مرتجع', 'فرق شحن', 'تحويلة تسليم', 'رفض دون شحن', 'غرامة مرتجع'];

interface Props {
  diary: any;
  diaryOrders: any[];
  onCopyOrder: (orderId: string) => void;
}

export default function FinancialSheet({ diary, diaryOrders, onCopyOrder }: Props) {
  const qc = useQueryClient();
  const [partialDialog, setPartialDialog] = useState<{ open: boolean; diaryOrderId: string; order: any } | null>(null);
  const [collectedAmount, setCollectedAmount] = useState('');

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, partial }: { id: string; status: string; partial?: number }) => {
      const update: any = { status_inside_diary: status };
      if (partial !== undefined) update.partial_amount = partial;
      const { error } = await supabase.from('diary_orders').update(update).eq('id', id);
      if (error) throw error;
      await logActivity('تغيير حالة أوردر في يومية', { diary_order_id: id, new_status: status });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diary-orders', diary.id] });
      toast.success('تم تحديث الحالة');
    },
  });

  const updateNColumn = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      const { error } = await supabase.from('diary_orders').update({ n_column: value.slice(0, 1) }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['diary-orders', diary.id] }),
  });

  const handleStatusChange = (diaryOrder: any, newStatus: string) => {
    if (diary.lock_status_updates) {
      toast.error('تعديل الحالات مقفل في هذه اليومية');
      return;
    }
    if (newStatus === 'تسليم جزئي') {
      setPartialDialog({ open: true, diaryOrderId: diaryOrder.id, order: diaryOrder.orders });
      setCollectedAmount('');
      return;
    }
    updateStatus.mutate({ id: diaryOrder.id, status: newStatus, partial: 0 });
  };

  const handlePartialSubmit = () => {
    if (!partialDialog) return;
    const collected = parseFloat(collectedAmount);
    const shipping = partialDialog.order?.delivery_price || 0;
    if (isNaN(collected) || collected <= 0) {
      toast.error('أدخل مبلغ صحيح');
      return;
    }
    if (collected < shipping) {
      toast.warning('المبلغ المحصل أقل من مصاريف الشحن!');
    }
    const partialDelivery = collected - shipping;
    updateStatus.mutate({
      id: partialDialog.diaryOrderId,
      status: 'تسليم جزئي',
      partial: Math.max(0, partialDelivery),
    });
    setPartialDialog(null);
  };

  // Calculate totals
  const calcRow = (dOrder: any) => {
    const price = dOrder.orders?.price || 0;
    const status = dOrder.status_inside_diary;
    const partial = dOrder.partial_amount || 0;

    return {
      executed: status === 'تم التسليم' ? price : 0,
      postponed: status === 'مؤجل' ? price : 0,
      returned: RETURN_STATUSES.includes(status) ? (status === 'تسليم جزئي' ? 0 : price) : (status === 'تسليم جزئي' ? (price - partial) : 0),
      partial: status === 'تسليم جزئي' ? partial : 0,
      shippingDiff: status === 'فرق شحن' ? price : 0,
      transferDelivery: status === 'تحويلة تسليم' ? price : 0,
      refuseNoShipping: status === 'رفض دون شحن' ? price : 0,
      returnPenalty: status === 'غرامة مرتجع' ? price : 0,
      returnStatus: RETURN_STATUSES.includes(status) || status === 'تسليم جزئي' ? status : '',
    };
  };

  const totals = diaryOrders.reduce(
    (acc, dOrder) => {
      const row = calcRow(dOrder);
      acc.executed += row.executed;
      acc.postponed += row.postponed;
      acc.returned += row.returned;
      acc.partial += row.partial;
      return acc;
    },
    { executed: 0, postponed: 0, returned: 0, partial: 0 }
  );

  return (
    <>
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-right w-8">#</TableHead>
              <TableHead className="text-right">الاسم</TableHead>
              <TableHead className="text-right w-10">ن</TableHead>
              <TableHead className="text-right">الكود</TableHead>
              <TableHead className="text-right">السعر</TableHead>
              <TableHead className="text-right">منفذ</TableHead>
              <TableHead className="text-right">نزول</TableHead>
              <TableHead className="text-right">مرتجع</TableHead>
              <TableHead className="text-right">تسليم جزئي</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
              <TableHead className="text-right">حالة المرتجع</TableHead>
              <TableHead className="text-right w-16">نسخ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {diaryOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                  لا توجد أوردرات في هذه اليومية
                </TableCell>
              </TableRow>
            ) : (
              diaryOrders.map((dOrder, idx) => {
                const order = dOrder.orders;
                const row = calcRow(dOrder);
                return (
                  <TableRow key={dOrder.id}>
                    <TableCell className="text-sm">{idx + 1}</TableCell>
                    <TableCell className="text-sm font-medium">{order?.customer_name}</TableCell>
                    <TableCell>
                      <Input
                        className="w-8 h-7 text-center p-0 text-xs"
                        maxLength={1}
                        value={dOrder.n_column || ''}
                        onChange={(e) => updateNColumn.mutate({ id: dOrder.id, value: e.target.value })}
                        disabled={diary.lock_status_updates}
                      />
                    </TableCell>
                    <TableCell className="text-sm">{order?.barcode || order?.customer_code}</TableCell>
                    <TableCell className="text-sm font-medium">{order?.price}</TableCell>
                    <TableCell className="text-sm text-green-600">{row.executed || ''}</TableCell>
                    <TableCell className="text-sm text-yellow-600">{row.postponed || ''}</TableCell>
                    <TableCell className="text-sm text-red-600">{row.returned || ''}</TableCell>
                    <TableCell className="text-sm text-blue-600">{row.partial || ''}</TableCell>
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
                    <TableCell className="text-xs text-muted-foreground">{row.returnStatus}</TableCell>
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
          {diaryOrders.length > 0 && (
            <TableFooter>
              <TableRow className="bg-muted/30 font-bold">
                <TableCell colSpan={5} className="text-right">الإجمالي</TableCell>
                <TableCell className="text-green-600">{totals.executed}</TableCell>
                <TableCell className="text-yellow-600">{totals.postponed}</TableCell>
                <TableCell className="text-red-600">{totals.returned}</TableCell>
                <TableCell className="text-blue-600">{totals.partial}</TableCell>
                <TableCell colSpan={3}></TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      {/* Partial Delivery Dialog */}
      <Dialog open={!!partialDialog?.open} onOpenChange={(o) => !o && setPartialDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تسليم جزئي</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              سعر الأوردر: {partialDialog?.order?.price} | الشحن: {partialDialog?.order?.delivery_price}
            </div>
            <div>
              <label className="text-sm font-medium">المبلغ المحصل من العميل</label>
              <Input
                type="number"
                value={collectedAmount}
                onChange={(e) => setCollectedAmount(e.target.value)}
                placeholder="أدخل المبلغ المحصل"
                className="mt-1"
              />
            </div>
            {collectedAmount && (
              <div className="text-sm space-y-1 bg-muted/50 p-3 rounded">
                <div>تسليم جزئي = {Math.max(0, parseFloat(collectedAmount) - (partialDialog?.order?.delivery_price || 0))}</div>
                <div>مرتجع = {(partialDialog?.order?.price || 0) - Math.max(0, parseFloat(collectedAmount) - (partialDialog?.order?.delivery_price || 0))}</div>
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
