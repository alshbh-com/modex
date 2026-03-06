import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

interface Props {
  diary: any;
  diaryOrders: any[];
  onCopyOrder: (orderId: string) => void;
}

export default function OrangeSheet({ diary, diaryOrders, onCopyOrder }: Props) {
  const qc = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [searchBarcode, setSearchBarcode] = useState('');

  const { data: searchResults = [] } = useQuery({
    queryKey: ['search-orders', searchBarcode],
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
      if (diary.prevent_new_orders) {
        throw new Error('الإضافة ممنوعة في هذه اليومية');
      }
      const { error } = await supabase
        .from('diary_orders')
        .insert({ order_id: orderId, diary_id: diary.id });
      if (error) throw error;
      await logActivity('إضافة أوردر يدوي ليومية', { order_id: orderId, diary_id: diary.id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diary-orders', diary.id] });
      toast.success('تم إضافة الأوردر');
      setAddDialogOpen(false);
      setSearchBarcode('');
    },
    onError: (e: any) => toast.error(e.message || 'فشلت الإضافة'),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      if (diary.lock_status_updates) throw new Error('التعديل مقفل');
      const { error } = await supabase.from('diary_orders').update({ status_inside_diary: status }).eq('id', id);
      if (error) throw error;
      await logActivity('تغيير حالة أوردر في الشيت البرتقالي', { diary_order_id: id, new_status: status });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diary-orders', diary.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-foreground">الشيت البرتقالي</h3>
        <Button size="sm" onClick={() => setAddDialogOpen(true)} disabled={diary.prevent_new_orders}>
          <Plus className="h-4 w-4 ml-1" /> إضافة أوردر
        </Button>
      </div>

      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-orange-50 dark:bg-orange-950/20">
              <TableHead className="text-right">#</TableHead>
              <TableHead className="text-right">الباركود</TableHead>
              <TableHead className="text-right">الاسم</TableHead>
              <TableHead className="text-right">العنوان</TableHead>
              <TableHead className="text-right">عدد القطع</TableHead>
              <TableHead className="text-right">الإجمالي</TableHead>
              <TableHead className="text-right">الشحن</TableHead>
              <TableHead className="text-right">الواصل</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
              <TableHead className="text-right">حالة المرتجع</TableHead>
              <TableHead className="text-right w-16">نسخ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {diaryOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  لا توجد أوردرات
                </TableCell>
              </TableRow>
            ) : (
              diaryOrders.map((dOrder, idx) => {
                const order = dOrder.orders;
                const total = (order?.price || 0) + (order?.delivery_price || 0);
                const isReturn = ['مرتجع', 'فرق شحن', 'تحويلة تسليم', 'رفض دون شحن', 'غرامة مرتجع', 'تسليم جزئي'].includes(dOrder.status_inside_diary);
                return (
                  <TableRow key={dOrder.id}>
                    <TableCell className="text-sm">{idx + 1}</TableCell>
                    <TableCell className="text-sm font-mono">{order?.barcode}</TableCell>
                    <TableCell className="text-sm">{order?.customer_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{order?.address}</TableCell>
                    <TableCell className="text-sm">{order?.quantity}</TableCell>
                    <TableCell className="text-sm font-medium">{total}</TableCell>
                    <TableCell className="text-sm">{order?.delivery_price}</TableCell>
                    <TableCell className="text-sm font-medium">
                      {dOrder.status_inside_diary === 'تم التسليم' ? total : 
                       dOrder.status_inside_diary === 'تسليم جزئي' ? (dOrder.partial_amount || 0) + (order?.delivery_price || 0) : 0}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={dOrder.status_inside_diary}
                        onValueChange={(v) => updateStatus.mutate({ id: dOrder.id, status: v })}
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
                    <TableCell className="text-xs text-muted-foreground">
                      {isReturn ? dOrder.status_inside_diary : ''}
                    </TableCell>
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
        </Table>
      </div>

      {/* Add Order Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>إضافة أوردر إلى اليومية</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pr-9"
                placeholder="ابحث بالباركود أو الاسم..."
                value={searchBarcode}
                onChange={(e) => setSearchBarcode(e.target.value)}
              />
            </div>
            <div className="max-h-60 overflow-auto space-y-1">
              {searchResults.map((order: any) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-2 rounded hover:bg-muted/50 cursor-pointer border text-sm"
                  onClick={() => addOrderToDiary.mutate(order.id)}
                >
                  <div>
                    <span className="font-medium">{order.customer_name}</span>
                    <span className="text-muted-foreground mr-2">#{order.barcode}</span>
                  </div>
                  <span className="font-medium">{order.price} ج.م</span>
                </div>
              ))}
              {searchBarcode.length >= 2 && searchResults.length === 0 && (
                <p className="text-center text-muted-foreground py-4">لا توجد نتائج</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
