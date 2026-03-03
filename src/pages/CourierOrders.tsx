import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LogOut, Eye, Phone, MessageSquare, Send } from 'lucide-react';
import { toast } from 'sonner';

const SHIPPING_OPTIONS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100];

export default function CourierOrders() {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [noteText, setNoteText] = useState('');
  const [notes, setNotes] = useState<any[]>([]);
  const [savingNote, setSavingNote] = useState(false);
  const [shippingDialog, setShippingDialog] = useState<any | null>(null);
  const [partialDialog, setPartialDialog] = useState<any | null>(null);
  const [partialAmount, setPartialAmount] = useState('');

  useEffect(() => {
    load();
    supabase.from('order_statuses').select('*').order('sort_order').then(({ data }) => setStatuses(data || []));
  }, []);

  const load = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_statuses(name, color), offices(name)')
      .eq('courier_id', user?.id || '')
      .eq('is_closed', false)
      .order('created_at', { ascending: false });
    setOrders(data || []);
  };

  const totalPrice = orders.reduce((sum, o) => sum + Number(o.price) + Number(o.delivery_price), 0);

  const rejectWithShipStatus = statuses.find(s => s.name === 'رفض ودفع شحن');
  const postponedStatus = statuses.find(s => s.name === 'مؤجل');
  const partialDeliveryStatus = statuses.find(s => s.name === 'تسليم جزئي');
  const receivedHalfShipStatus = statuses.find(s => s.name === 'استلم ودفع نص الشحن');

  const updateStatus = async (orderId: string, statusId: string) => {
    if (statusId === rejectWithShipStatus?.id) {
      setShippingDialog({ orderId, statusId, type: 'reject' });
      return;
    }

    if (statusId === receivedHalfShipStatus?.id) {
      setShippingDialog({ orderId, statusId, type: 'half_ship' });
      return;
    }

    if (statusId === partialDeliveryStatus?.id) {
      const order = orders.find(o => o.id === orderId);
      setPartialDialog({ orderId, statusId, order });
      setPartialAmount('');
      return;
    }

    await supabase.from('orders').update({ status_id: statusId }).eq('id', orderId);

    if (statusId === postponedStatus?.id) {
      await supabase.from('orders').update({ courier_id: null, status_id: null }).eq('id', orderId);
    }

    toast.success('تم تحديث الحالة');
    load();
  };

  const confirmShippingPaid = async (amount: number) => {
    if (!shippingDialog) return;
    await supabase.from('orders').update({ 
      status_id: shippingDialog.statusId,
      shipping_paid: amount,
    }).eq('id', shippingDialog.orderId);
    toast.success(`تم - مصاريف الشحن المدفوعة: ${amount} ج.م`);
    setShippingDialog(null);
    load();
  };

  const confirmPartialDelivery = async () => {
    if (!partialDialog) return;
    const received = parseFloat(partialAmount) || 0;
    await supabase.from('orders').update({ 
      status_id: partialDialog.statusId,
      partial_amount: received,
    }).eq('id', partialDialog.orderId);
    const returnAmount = Number(partialDialog.order?.price || 0) - received;
    toast.success(`تسليم جزئي: ${received} ج.م - مرتجع: ${returnAmount} ج.م`);
    setPartialDialog(null);
    load();
  };

  const openDetails = async (order: any) => {
    setSelectedOrder(order);
    const { data } = await supabase.from('order_notes').select('*').eq('order_id', order.id).order('created_at', { ascending: false });
    setNotes(data || []);
  };

  const addNote = async () => {
    if (!noteText.trim() || !selectedOrder) return;
    setSavingNote(true);
    await supabase.from('order_notes').insert({ order_id: selectedOrder.id, user_id: user?.id || '', note: noteText.trim() });
    setNoteText('');
    const { data } = await supabase.from('order_notes').select('*').eq('order_id', selectedOrder.id).order('created_at', { ascending: false });
    setNotes(data || []);
    setSavingNote(false);
    toast.success('تم إضافة الملاحظة');
  };

  const moveOrder = (index: number, direction: number) => {
    const newOrders = [...orders];
    const [item] = newOrders.splice(index, 1);
    newOrders.splice(index + direction, 0, item);
    setOrders(newOrders);
  };

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold">أوردراتي</h1>
          <Button variant="ghost" className="text-destructive" onClick={logout}>
            <LogOut className="h-4 w-4 ml-2" />خروج
          </Button>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-3 flex justify-between items-center">
            <span className="text-sm text-muted-foreground">إجمالي الأوردرات: {orders.length}</span>
            <span className="font-bold text-lg">{totalPrice} ج.م</span>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="w-10">ترتيب</TableHead>
                    <TableHead className="text-right">الكود</TableHead>
                    <TableHead className="text-right">العميل</TableHead>
                    <TableHead className="text-right">العنوان</TableHead>
                    <TableHead className="text-right">المنتج</TableHead>
                    <TableHead className="text-right">الإجمالي</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">تفاصيل</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">لا توجد أوردرات</TableCell></TableRow>
                  ) : orders.map((order, idx) => (
                    <TableRow key={order.id} className="border-border">
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {idx > 0 && <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => moveOrder(idx, -1)}>↑</Button>}
                          {idx < orders.length - 1 && <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => moveOrder(idx, 1)}>↓</Button>}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{order.customer_code || '-'}</TableCell>
                      <TableCell className="text-sm">{order.customer_name}</TableCell>
                      <TableCell className="text-sm truncate max-w-[120px]">{order.address || '-'}</TableCell>
                      <TableCell className="text-sm">{order.product_name}</TableCell>
                      <TableCell className="font-bold text-sm">{Number(order.price) + Number(order.delivery_price)} ج.م</TableCell>
                      <TableCell>
                        <Select value={order.status_id || ''} onValueChange={(v) => updateStatus(order.id, v)}>
                          <SelectTrigger className="w-32 sm:w-36 bg-secondary border-border text-xs"><SelectValue placeholder="الحالة" /></SelectTrigger>
                          <SelectContent>
                            {statuses.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => openDetails(order)}><Eye className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shipping amount dialog with preset options */}
      <Dialog open={!!shippingDialog} onOpenChange={v => { if (!v) setShippingDialog(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>
              {shippingDialog?.type === 'half_ship' ? 'استلم ودفع نص الشحن - اختر المبلغ' : 'رفض ودفع شحن - اختر مبلغ الشحن'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {SHIPPING_OPTIONS.map(amount => (
              <Button key={amount} variant="outline" className="text-lg py-6" onClick={() => confirmShippingPaid(amount)}>
                {amount} ج.م
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Partial delivery dialog */}
      <Dialog open={!!partialDialog} onOpenChange={v => { if (!v) setPartialDialog(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>تسليم جزئي - أدخل المبلغ المحصل</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">سعر الأوردر: {partialDialog?.order?.price || 0} ج.م</p>
            <Input type="number" value={partialAmount} onChange={e => setPartialAmount(e.target.value)} placeholder="المبلغ المحصل (بدون الشحن)" className="bg-secondary border-border" />
            {partialAmount && (
              <p className="text-sm">المرتجع الجزئي: <strong className="text-destructive">{Number(partialDialog?.order?.price || 0) - (parseFloat(partialAmount) || 0)} ج.م</strong></p>
            )}
            <Button onClick={confirmPartialDelivery} className="w-full">تأكيد</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Order Details Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(v) => { if (!v) setSelectedOrder(null); }}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>تفاصيل الأوردر - {selectedOrder?.tracking_id}</DialogTitle></DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">العميل:</span> <strong>{selectedOrder.customer_name}</strong></div>
                <div><span className="text-muted-foreground">الهاتف:</span> <strong dir="ltr">{selectedOrder.customer_phone}</strong></div>
                <div><span className="text-muted-foreground">الكود:</span> <strong>{selectedOrder.customer_code || '-'}</strong></div>
                <div><span className="text-muted-foreground">المنتج:</span> <strong>{selectedOrder.product_name}</strong></div>
                <div><span className="text-muted-foreground">الكمية:</span> <strong>{selectedOrder.quantity}</strong></div>
                <div><span className="text-muted-foreground">المكتب:</span> <strong>{selectedOrder.offices?.name || '-'}</strong></div>
                <div className="col-span-2"><span className="text-muted-foreground">العنوان:</span> <strong>{selectedOrder.address || '-'}</strong></div>
                <div><span className="text-muted-foreground">السعر:</span> <strong>{selectedOrder.price} ج.م</strong></div>
                <div><span className="text-muted-foreground">الشحن:</span> <strong>{selectedOrder.delivery_price} ج.م</strong></div>
                <div className="col-span-2"><span className="text-muted-foreground">الإجمالي:</span> <strong className="text-lg">{Number(selectedOrder.price) + Number(selectedOrder.delivery_price)} ج.م</strong></div>
                <div><span className="text-muted-foreground">اللون:</span> <strong>{selectedOrder.color || '-'}</strong></div>
                <div><span className="text-muted-foreground">المقاس:</span> <strong>{selectedOrder.size || '-'}</strong></div>
                {selectedOrder.notes && <div className="col-span-2"><span className="text-muted-foreground">ملاحظات:</span> <strong>{selectedOrder.notes}</strong></div>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" asChild>
                  <a href={`tel:${selectedOrder.customer_phone}`}><Phone className="h-4 w-4 ml-1" />اتصال</a>
                </Button>
                <Button size="sm" variant="outline" className="flex-1" asChild>
                  <a href={`sms:${selectedOrder.customer_phone}`}><MessageSquare className="h-4 w-4 ml-1" />رسالة</a>
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-emerald-500" asChild>
                  <a href={`https://wa.me/${selectedOrder.customer_phone?.replace(/^0/, '20')}`} target="_blank" rel="noopener noreferrer"><Send className="h-4 w-4 ml-1" />واتساب</a>
                </Button>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">الملاحظات</h3>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {notes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">لا توجد ملاحظات</p>
                  ) : notes.map(n => (
                    <div key={n.id} className="p-2 bg-secondary rounded text-sm">
                      <p>{n.note}</p>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString('ar-EG')}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="أضف ملاحظة..." className="bg-secondary border-border" />
                  <Button size="sm" onClick={addNote} disabled={savingNote || !noteText.trim()}>إضافة</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
