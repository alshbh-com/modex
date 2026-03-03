import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pencil, Trash2, Settings2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { logActivity } from '@/lib/activityLogger';

export default function OfficeAccounts() {
  const { isOwner } = useAuth();
  const [offices, setOffices] = useState<any[]>([]);
  const [selectedOffice, setSelectedOffice] = useState('all');
  const [statuses, setStatuses] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [period, setPeriod] = useState('all');
  const [payments, setPayments] = useState<any[]>([]);
  const [officeOrders, setOfficeOrders] = useState<any[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  // Advance payment dialog
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceOffice, setAdvanceOffice] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceNotes, setAdvanceNotes] = useState('');
  const [advanceType, setAdvanceType] = useState('advance');

  // Edit dialog
  const [editItem, setEditItem] = useState<any>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNotes, setEditNotes] = useState('');

  useEffect(() => {
    supabase.from('offices').select('id, name').order('name').then(({ data }) => setOffices(data || []));
    supabase.from('order_statuses').select('*').order('sort_order').then(({ data }) => setStatuses(data || []));
  }, []);

  useEffect(() => { loadAccounts(); }, [selectedOffice, period, offices, statuses]);

  useEffect(() => {
    if (selectedOffice !== 'all') {
      loadOfficeOrders();
    } else {
      setOfficeOrders([]);
      setSelectedOrders([]);
    }
  }, [selectedOffice]);

  const loadOfficeOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('id, tracking_id, status_id, partial_amount')
      .eq('office_id', selectedOffice)
      .eq('is_closed', false)
      .order('created_at', { ascending: false });
    setOfficeOrders(data || []);
    setSelectedOrders([]);
  };

  const quickStatuses = ['تم التسليم', 'تسليم جزئي', 'مؤجل', 'رفض ولم يدفع شحن', 'رفض ودفع شحن', 'ملغي', 'لم يرد'];

  const changeOrderStatus = async (orderId: string, statusName: string, partialAmount?: number) => {
    const status = statuses.find(s => s.name === statusName);
    if (!status) { toast.error('حالة غير موجودة'); return; }
    const updateData: any = { status_id: status.id };
    if (statusName === 'تسليم جزئي' && partialAmount !== undefined) {
      updateData.partial_amount = partialAmount;
    }
    const { error } = await supabase.from('orders').update(updateData).eq('id', orderId);
    if (error) { toast.error(error.message); return; }
    logActivity('تغيير حالة أوردر من حسابات المكاتب', { order_id: orderId, status: statusName });
    toast.success(`تم تغيير الحالة إلى ${statusName}`);
    loadOfficeOrders();
    loadAccounts();
  };

  const closeSelectedOrders = async () => {
    if (selectedOrders.length === 0) { toast.error('اختر أوردرات للتقفيل'); return; }
    if (!confirm(`هل تريد تقفيل ${selectedOrders.length} أوردر؟ ستختفي من الحساب.`)) return;
    const { error } = await supabase.from('orders').update({ is_closed: true }).in('id', selectedOrders);
    if (error) { toast.error(error.message); return; }
    logActivity('تقفيل حساب مكتب', { count: selectedOrders.length, office_id: selectedOffice });
    toast.success(`تم تقفيل ${selectedOrders.length} أوردر`);
    setSelectedOrders([]);
    loadOfficeOrders();
    loadAccounts();
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]);
  };

  const toggleAllOrders = () => {
    if (selectedOrders.length === officeOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(officeOrders.map(o => o.id));
    }
  };

  const getDateFilter = () => {
    const now = new Date();
    if (period === 'daily') return now.toISOString().split('T')[0];
    if (period === 'monthly') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    if (period === 'yearly') return new Date(now.getFullYear(), 0, 1).toISOString();
    return null;
  };

  const loadPayments = async () => {
    const { data } = await supabase.from('office_payments').select('*').order('created_at', { ascending: false });
    setPayments(data || []);
  };

  const loadAccounts = async () => {
    if (offices.length === 0 || statuses.length === 0) return;
    await loadPayments();
    const officeList = selectedOffice === 'all' ? offices : offices.filter(o => o.id === selectedOffice);
    const dateFilter = getDateFilter();

    const deliveredStatus = statuses.find(s => s.name === 'تم التسليم');
    const partialStatus = statuses.find(s => s.name === 'تسليم جزئي');
    const postponedStatus = statuses.find(s => s.name === 'مؤجل');
    // Returns = رفض ولم يدفع شحن, رفض ودفع شحن, تهرب, ملغي, لم يرد, لايرد
    const returnStatusIds = statuses
      .filter(s => ['رفض ولم يدفع شحن', 'رفض ودفع شحن', 'تهرب', 'ملغي', 'لم يرد', 'لايرد'].includes(s.name))
      .map(s => s.id);
    // Shipping deduction = رفض ولم يدفع شحن (order paid shipping but rejected without paying)
    const shipDeductionIds = statuses
      .filter(s => ['رفض ولم يدفع شحن'].includes(s.name))
      .map(s => s.id);

    const { data: allPayments } = await supabase.from('office_payments').select('*');

    const result = await Promise.all(officeList.map(async (office) => {
      let query = supabase.from('orders').select('price, delivery_price, status_id, partial_amount').eq('office_id', office.id).eq('is_closed', false);
      if (dateFilter) query = query.gte('created_at', dateFilter);
      const { data: orders } = await query;
      if (!orders) return null;

      const officePayments = (allPayments || []).filter(p => p.office_id === office.id);
      const advancePaid = officePayments.filter(p => p.type === 'advance').reduce((sum, p) => sum + Number(p.amount), 0);
      const commission = officePayments.filter(p => p.type === 'commission').reduce((sum, p) => sum + Number(p.amount), 0);

      const deliveredTotal = orders.filter(o => o.status_id === deliveredStatus?.id).reduce((sum, o) => sum + Number(o.price), 0);
      const returnedTotal = orders.filter(o => returnStatusIds.includes(o.status_id)).reduce((sum, o) => sum + Number(o.price), 0);
      const postponedTotal = orders.filter(o => o.status_id === postponedStatus?.id).reduce((sum, o) => sum + Number(o.price), 0);
      
      const returnNoShipDeduction = orders
        .filter(o => shipDeductionIds.includes(o.status_id))
        .reduce((sum, o) => sum + Number(o.delivery_price), 0);

      const partialOrders = orders.filter(o => o.status_id === partialStatus?.id);
      const partialDeliveredTotal = partialOrders.reduce((sum, o) => sum + Number(o.partial_amount || 0), 0);

      const settlement = (deliveredTotal + partialDeliveredTotal) - (advancePaid + returnedTotal + returnNoShipDeduction + commission);
      const settlementWithPostponed = settlement + postponedTotal;

      return {
        id: office.id, name: office.name,
        orderCount: orders.length,
        deliveredTotal, returnedTotal, postponedTotal,
        returnNoShipDeduction, partialDeliveredTotal,
        settlement, settlementWithPostponed, advancePaid, commission,
      };
    }));

    setAccounts(result.filter(Boolean));
  };

  const saveAdvance = async () => {
    if (!advanceOffice || !advanceAmount) { toast.error('اختر مكتب وأدخل المبلغ'); return; }
    const { error } = await supabase.from('office_payments').insert({
      office_id: advanceOffice,
      amount: parseFloat(advanceAmount),
      type: advanceType,
      notes: advanceNotes || (advanceType === 'advance' ? 'دفعة مقدمة' : 'عمولة'),
    });
    if (error) { toast.error('حدث خطأ: ' + error.message); return; }
    toast.success('تم الحفظ بنجاح');
    setAdvanceOpen(false); setAdvanceAmount(''); setAdvanceNotes(''); setAdvanceOffice('');
    loadAccounts();
  };

  const updatePayment = async () => {
    if (!editItem) return;
    const { error } = await supabase.from('office_payments').update({
      amount: parseFloat(editAmount),
      notes: editNotes,
    }).eq('id', editItem.id);
    if (error) { toast.error(error.message); return; }
    toast.success('تم التحديث');
    setEditItem(null);
    loadAccounts();
  };

  const deletePayment = async (id: string) => {
    if (!confirm('حذف هذا السجل؟')) return;
    await supabase.from('office_payments').delete().eq('id', id);
    toast.success('تم الحذف');
    loadAccounts();
  };

  const officePaymentsList = payments.filter(p => 
    selectedOffice === 'all' || p.office_id === selectedOffice
  );

  const selectedAccount = selectedOffice !== 'all' ? accounts.find(a => a.id === selectedOffice) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">حسابات المكاتب</h1>
        <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 ml-1" />إضافة دفعة / عمولة</Button></DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>إضافة دفعة مقدمة / عمولة</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>المكتب</Label>
                <Select value={advanceOffice} onValueChange={setAdvanceOffice}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="اختر مكتب" /></SelectTrigger>
                  <SelectContent>{offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>النوع</Label>
                <Select value={advanceType} onValueChange={setAdvanceType}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="advance">دفعة مقدمة</SelectItem>
                    <SelectItem value="commission">عمولة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>المبلغ</Label><Input type="number" value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)} className="bg-secondary border-border" /></div>
              <div><Label>ملاحظات</Label><Input value={advanceNotes} onChange={e => setAdvanceNotes(e.target.value)} className="bg-secondary border-border" /></div>
              <Button onClick={saveAdvance} className="w-full">حفظ</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={selectedOffice} onValueChange={setSelectedOffice}>
          <SelectTrigger className="w-44 bg-secondary border-border"><SelectValue placeholder="اختر مكتب" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المكاتب</SelectItem>
            {offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Tabs value={period} onValueChange={setPeriod} className="w-auto">
          <TabsList className="bg-secondary">
            <TabsTrigger value="all">الكل</TabsTrigger>
            <TabsTrigger value="daily">يومي</TabsTrigger>
            <TabsTrigger value="monthly">شهري</TabsTrigger>
            <TabsTrigger value="yearly">سنوي</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {selectedAccount && (
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">المستحق</p>
              <p className="text-2xl font-bold text-primary">{selectedAccount.settlement} ج.م</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">المستحق بالمؤجل</p>
              <p className="text-2xl font-bold text-emerald-500">{selectedAccount.settlementWithPostponed} ج.م</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-right">المكتب</TableHead>
                  <TableHead className="text-right">عدد</TableHead>
                  <TableHead className="text-right">تسليم</TableHead>
                  <TableHead className="text-right">مرتجع</TableHead>
                  <TableHead className="text-right">مؤجل</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">تسليم جزئي</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">خصم شحن</TableHead>
                  <TableHead className="text-right">المدفوع مقدم</TableHead>
                  <TableHead className="text-right">العمولة</TableHead>
                  <TableHead className="text-right">المستحق</TableHead>
                  <TableHead className="text-right">بالمؤجل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">لا توجد بيانات</TableCell></TableRow>
                ) : accounts.map(a => (
                  <TableRow key={a.id} className="border-border">
                    <TableCell className="font-medium text-sm">{a.name}</TableCell>
                    <TableCell className="text-sm">{a.orderCount}</TableCell>
                    <TableCell className="text-emerald-500 font-bold text-sm">{a.deliveredTotal} ج.م</TableCell>
                    <TableCell className="text-destructive font-bold text-sm">{a.returnedTotal} ج.م</TableCell>
                    <TableCell className="text-amber-500 font-bold text-sm">{a.postponedTotal} ج.م</TableCell>
                    <TableCell className="text-emerald-400 font-bold text-sm hidden sm:table-cell">{a.partialDeliveredTotal} ج.م</TableCell>
                    <TableCell className="text-destructive text-sm hidden sm:table-cell">{a.returnNoShipDeduction} ج.م</TableCell>
                    <TableCell className="text-primary font-bold text-sm">{a.advancePaid} ج.م</TableCell>
                    <TableCell className="text-sm font-bold">{a.commission} ج.م</TableCell>
                    <TableCell className="font-bold text-sm">{a.settlement} ج.م</TableCell>
                    <TableCell className="font-bold text-primary text-sm">{a.settlementWithPostponed} ج.م</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Office orders with selection for closing */}
      {selectedOffice !== 'all' && officeOrders.length > 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">أوردرات المكتب ({officeOrders.length})</h3>
              {selectedOrders.length > 0 && (
                <Button size="sm" variant="destructive" onClick={closeSelectedOrders}>
                  <Lock className="h-4 w-4 ml-1" />تقفيل ({selectedOrders.length})
                </Button>
              )}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-right w-10">
                      <Checkbox
                        checked={selectedOrders.length === officeOrders.length && officeOrders.length > 0}
                        onCheckedChange={toggleAllOrders}
                      />
                    </TableHead>
                    <TableHead className="text-right">كود الأوردر</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">إجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {officeOrders.map((o) => {
                    const status = statuses.find(s => s.id === o.status_id);
                    return (
                      <TableRow key={o.id} className="border-border">
                        <TableCell>
                          <Checkbox
                            checked={selectedOrders.includes(o.id)}
                            onCheckedChange={() => toggleOrderSelection(o.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{o.tracking_id}</TableCell>
                        <TableCell>
                          {status && (
                            <Badge style={{ backgroundColor: status.color }} className="text-xs">{status.name}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <OrderStatusPopover
                            orderId={o.id}
                            quickStatuses={quickStatuses}
                            statuses={statuses}
                            onChangeStatus={changeOrderStatus}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payments list */}
      {officePaymentsList.length > 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">سجل الدفعات والعمولات</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-right">المكتب</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">ملاحظات</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {officePaymentsList.map(p => (
                    <TableRow key={p.id} className="border-border">
                      <TableCell className="text-sm">{offices.find(o => o.id === p.office_id)?.name || '-'}</TableCell>
                      <TableCell className="text-sm">{p.type === 'advance' ? 'دفعة مقدمة' : 'عمولة'}</TableCell>
                      <TableCell className="font-bold text-sm">{p.amount} ج.م</TableCell>
                      <TableCell className="text-sm">{p.notes || '-'}</TableCell>
                      <TableCell className="text-sm">{new Date(p.created_at).toLocaleDateString('ar-EG')}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => { setEditItem(p); setEditAmount(String(p.amount)); setEditNotes(p.notes || ''); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {isOwner && (
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deletePayment(p.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit payment dialog */}
      <Dialog open={!!editItem} onOpenChange={v => { if (!v) setEditItem(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>تعديل السجل</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>المبلغ</Label><Input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} className="bg-secondary border-border" /></div>
            <div><Label>ملاحظات</Label><Input value={editNotes} onChange={e => setEditNotes(e.target.value)} className="bg-secondary border-border" /></div>
            <Button onClick={updatePayment} className="w-full">حفظ</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="bg-card border-border p-4">
        <h3 className="font-semibold mb-2">معادلة صافي الحساب:</h3>
        <p className="text-sm text-muted-foreground">المستحق = (التسليمات + تسليم جزئي) - (المدفوع مقدم + المرتجع + خصم شحن + العمولة)</p>
        <p className="text-sm text-muted-foreground">المستحق بالمؤجل = المستحق + المؤجل</p>
      </Card>
    </div>
  );
}

// Sub-component for order status popover
function OrderStatusPopover({ orderId, quickStatuses, statuses, onChangeStatus }: {
  orderId: string;
  quickStatuses: string[];
  statuses: any[];
  onChangeStatus: (orderId: string, statusName: string, partialAmount?: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showPartial, setShowPartial] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');

  return (
    <Popover open={open} onOpenChange={v => { setOpen(v); if (!v) { setShowPartial(false); setPartialAmount(''); } }}>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost"><Settings2 className="h-4 w-4" /></Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2">
        {showPartial ? (
          <div className="space-y-2">
            <Label className="text-xs">المبلغ المسلّم</Label>
            <Input type="number" value={partialAmount} onChange={e => setPartialAmount(e.target.value)} className="bg-secondary border-border h-8 text-sm" placeholder="0" />
            <Button size="sm" className="w-full" onClick={() => {
              onChangeStatus(orderId, 'تسليم جزئي', parseFloat(partialAmount) || 0);
              setOpen(false); setShowPartial(false); setPartialAmount('');
            }}>تأكيد</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {quickStatuses.map(name => {
              const st = statuses.find(s => s.name === name);
              if (!st) return null;
              return (
                <Button key={name} size="sm" variant="ghost" className="justify-start text-xs h-8"
                  onClick={() => {
                    if (name === 'تسليم جزئي') { setShowPartial(true); return; }
                    onChangeStatus(orderId, name);
                    setOpen(false);
                  }}>
                  <span className="w-2 h-2 rounded-full ml-2" style={{ backgroundColor: st.color || '#6b7280' }} />
                  {name}
                </Button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
