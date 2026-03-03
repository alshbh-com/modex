import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export default function CourierCollections() {
  const { user, isOwner } = useAuth();
  const [couriers, setCouriers] = useState<any[]>([]);
  const [selectedCourier, setSelectedCourier] = useState('');
  const [statuses, setStatuses] = useState<any[]>([]);
  const [commissionPerOrder, setCommissionPerOrder] = useState('');
  const [commissionStatuses, setCommissionStatuses] = useState<string[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [bonusDialogOpen, setBonusDialogOpen] = useState(false);
  const [bonusType, setBonusType] = useState<'special' | 'office_commission'>('special');
  const [bonusAmount, setBonusAmount] = useState('');
  const [bonusReason, setBonusReason] = useState('');
  const [isClosed, setIsClosed] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'courier');
      if (roles && roles.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', roles.map(r => r.user_id));
        setCouriers(profiles || []);
      }
      const { data: sts } = await supabase.from('order_statuses').select('*').order('sort_order');
      setStatuses(sts || []);
    };
    load();
  }, []);

  useEffect(() => { if (selectedCourier) loadCourierData(); }, [selectedCourier]);

  const loadCourierData = async () => {
    const { data: orderData } = await supabase
      .from('orders')
      .select('*, order_statuses(name, color)')
      .eq('courier_id', selectedCourier)
      .eq('is_closed', false)
      .order('created_at', { ascending: false });
    setOrders(orderData || []);

    const { data: bonusData } = await supabase
      .from('courier_bonuses')
      .select('*')
      .eq('courier_id', selectedCourier)
      .order('created_at', { ascending: false });
    setBonuses(bonusData || []);
    setIsClosed(false);
  };

  const deliveredStatus = statuses.find(s => s.name === 'تم التسليم');
  const rejectWithShipStatus = statuses.find(s => s.name === 'رفض ودفع شحن');

  // Auto-calculated: total collection = sum of (price + delivery_price) for delivered orders
  const deliveredOrders = orders.filter(o => o.status_id === deliveredStatus?.id);
  const totalCollection = deliveredOrders.reduce((sum, o) => sum + Number(o.price) + Number(o.delivery_price), 0);

  // Reject with shipping - courier keeps shipping cost
  const rejectShipOrders = orders.filter(o => o.status_id === rejectWithShipStatus?.id);
  const rejectShipTotal = rejectShipOrders.reduce((sum, o) => sum + Number(o.delivery_price), 0);

  // Commission
  const rate = parseFloat(commissionPerOrder) || 0;
  const eligibleOrders = orders.filter(o => commissionStatuses.includes(o.status_id));
  const commissionTotal = eligibleOrders.length * rate;

  // Bonuses total
  const totalBonuses = bonuses.reduce((sum, b) => sum + Number(b.amount), 0);

  // Office commission bonuses (عمولة مكتب)
  const officeCommissionBonuses = bonuses.filter(b => b.reason?.startsWith('__office_commission__'));
  const totalOfficeCommission = officeCommissionBonuses.reduce((sum, b) => sum + Number(b.amount), 0);

  // Regular bonuses (عمولة خاصة) - exclude office commission
  const regularBonuses = bonuses.filter(b => !b.reason?.startsWith('__office_commission__'));
  const totalRegularBonuses = regularBonuses.reduce((sum, b) => sum + Number(b.amount), 0);

  // Net: totalCollection + rejectShipTotal + totalOfficeCommission - commissionTotal - totalRegularBonuses
  const netDue = totalCollection + rejectShipTotal + totalOfficeCommission - commissionTotal - totalRegularBonuses;

  const toggleStatus = (statusId: string) => {
    setCommissionStatuses(prev => prev.includes(statusId) ? prev.filter(s => s !== statusId) : [...prev, statusId]);
  };

  const addBonus = async () => {
    if (!bonusAmount || !selectedCourier) return;
    const { error } = await supabase.from('courier_bonuses').insert({
      courier_id: selectedCourier,
      amount: parseFloat(bonusAmount),
      reason: bonusType === 'office_commission' ? `__office_commission__${bonusReason ? ':' + bonusReason : ''}` : (bonusReason || 'عمولة خاصة'),
      created_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(bonusType === 'office_commission' ? 'تم إضافة عمولة المكتب' : 'تم إضافة العمولة');
    setBonusDialogOpen(false);
    setBonusAmount(''); setBonusReason('');
    loadCourierData();
  };

  const deleteBonus = async (id: string) => {
    if (!confirm('حذف هذه العمولة؟')) return;
    await supabase.from('courier_bonuses').delete().eq('id', id);
    toast.success('تم الحذف');
    loadCourierData();
  };

  const closeAccount = async () => {
    if (!confirm('هل تريد تقفيل حساب المندوب؟ سيتم تقفيل جميع الأوردرات.')) return;
    const orderIds = orders.map(o => o.id);
    if (orderIds.length > 0) {
      await supabase.from('orders').update({ is_closed: true }).in('id', orderIds);
    }
    toast.success('تم تقفيل الحساب');
    setIsClosed(true);
    loadCourierData();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">تحصيلات المندوبين</h1>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">المندوب</Label>
          <Select value={selectedCourier} onValueChange={setSelectedCourier}>
            <SelectTrigger className="w-48 bg-secondary border-border"><SelectValue placeholder="اختر مندوب" /></SelectTrigger>
            <SelectContent>{couriers.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {selectedCourier && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-card border-border"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">إجمالي التحصيل</p><p className="text-lg font-bold text-emerald-500">{totalCollection} ج.م</p></CardContent></Card>
            <Card className="bg-card border-border"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">عمولة المكتب</p><p className="text-lg font-bold text-amber-500">{rejectShipTotal + totalOfficeCommission} ج.م</p></CardContent></Card>
            <Card className="bg-card border-border"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">العمولة</p><p className="text-lg font-bold text-destructive">{commissionTotal} ج.م</p></CardContent></Card>
            <Card className="bg-card border-border"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">صافي المستحق</p><p className="text-lg font-bold text-primary">{netDue} ج.م</p></CardContent></Card>
          </div>

          {/* Commission calculator */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">حاسبة العمولة</CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Dialog open={bonusDialogOpen} onOpenChange={v => { setBonusDialogOpen(v); if (!v) setBonusType('special'); }}>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => { setBonusType('special'); setBonusDialogOpen(true); }}><Plus className="h-4 w-4 ml-1" />عمولة خاصة</Button>
                    <Button size="sm" variant="outline" onClick={() => { setBonusType('office_commission'); setBonusDialogOpen(true); }}><Plus className="h-4 w-4 ml-1" />عمولة مكتب</Button>
                  </div>
                  <DialogContent className="bg-card border-border">
                    <DialogHeader><DialogTitle>{bonusType === 'office_commission' ? 'إضافة عمولة مكتب' : 'إضافة عمولة خاصة'}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div><Label>المبلغ</Label><Input type="number" value={bonusAmount} onChange={e => setBonusAmount(e.target.value)} className="bg-secondary border-border" /></div>
                      <div><Label>{bonusType === 'office_commission' ? 'ملاحظة / السبب' : 'السبب'}</Label><Input value={bonusReason} onChange={e => setBonusReason(e.target.value)} className="bg-secondary border-border" placeholder={bonusType === 'office_commission' ? 'سبب عمولة المكتب...' : 'مشوار خاص...'} /></div>
                      <Button onClick={addBonus} className="w-full">حفظ</Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button size="sm" variant="destructive" onClick={closeAccount}>تقفيل الحساب</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {statuses.map(s => (
                  <Badge key={s.id}
                    style={{ backgroundColor: commissionStatuses.includes(s.id) ? s.color : undefined }}
                    variant={commissionStatuses.includes(s.id) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleStatus(s.id)}>
                    {s.name}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">مبلغ العمولة لكل أوردر (ج.م)</Label>
                  <Input type="number" value={commissionPerOrder} onChange={e => setCommissionPerOrder(e.target.value)}
                    className="w-40 bg-secondary border-border" placeholder="30"
                    onFocus={e => { if (e.target.value === '0') setCommissionPerOrder(''); }} />
                </div>
                <p className="text-sm">= {commissionTotal} ج.م ({eligibleOrders.length} أوردر)</p>
              </div>
            </CardContent>
          </Card>

          {/* Bonuses */}
          {bonuses.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader><CardTitle className="text-base">العمولات</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow className="border-border">
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">السبب</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {bonuses.map(b => (
                      <TableRow key={b.id} className="border-border">
                        <TableCell className="text-sm">{b.reason?.startsWith('__office_commission__') ? 'عمولة مكتب' : 'عمولة خاصة'}</TableCell>
                        <TableCell className="font-bold">{b.amount} ج.م</TableCell>
                        <TableCell>{b.reason?.startsWith('__office_commission__') ? (b.reason.split(':')[1] || '-') : (b.reason || '-')}</TableCell>
                        <TableCell>{new Date(b.created_at).toLocaleDateString('ar-EG')}</TableCell>
                        <TableCell>
                          {isOwner && (
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteBonus(b.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Courier orders */}
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-base">أوردرات المندوب ({orders.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-right">Tracking</TableHead>
                      <TableHead className="text-right">الكود</TableHead>
                      <TableHead className="text-right">العميل</TableHead>
                      <TableHead className="text-right">السعر</TableHead>
                      <TableHead className="text-right">التوصيل</TableHead>
                      <TableHead className="text-right">الإجمالي</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-4">لا توجد أوردرات</TableCell></TableRow>
                    ) : orders.map(o => (
                      <TableRow key={o.id} className="border-border">
                        <TableCell className="font-mono text-xs">{o.tracking_id}</TableCell>
                        <TableCell className="font-mono text-xs">{o.customer_code || '-'}</TableCell>
                        <TableCell>{o.customer_name}</TableCell>
                        <TableCell>{o.price} ج.م</TableCell>
                        <TableCell>{o.delivery_price} ج.م</TableCell>
                        <TableCell className="font-bold">{Number(o.price) + Number(o.delivery_price)} ج.م</TableCell>
                        <TableCell>
                          <Badge style={{ backgroundColor: o.order_statuses?.color }} className="text-xs">
                            {o.order_statuses?.name || '-'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
