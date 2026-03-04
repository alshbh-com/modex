import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

interface SettlementRow {
  id: string;
  code: string;
  name: string;
  count: string;
  pieces: string;
  amount: string;
  shipping: string;
  arrived: string;
}

const newRow = (): SettlementRow => ({
  id: crypto.randomUUID(),
  code: '',
  name: '',
  count: '',
  pieces: '',
  amount: '',
  shipping: '',
  arrived: '',
});

export default function OfficeSettlement() {
  const [rows, setRows] = useState<SettlementRow[]>([newRow()]);
  const [pickupRate, setPickupRate] = useState('');
  const [offices, setOffices] = useState<any[]>([]);
  const [selectedOffice, setSelectedOffice] = useState<string>('all');
  const [officeOrders, setOfficeOrders] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('offices').select('id, name').order('name').then(({ data }) => setOffices(data || []));
  }, []);

  useEffect(() => {
    if (selectedOffice && selectedOffice !== 'all') {
      supabase.from('orders').select('*, order_statuses(name, color)')
        .eq('office_id', selectedOffice)
        .eq('is_closed', false)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          setOfficeOrders(data || []);
          // Auto-fill rows from orders
          if (data && data.length > 0) {
            setRows(data.map(o => ({
              id: o.id,
              code: o.customer_code || '',
              name: o.customer_name || '',
              count: '1',
              pieces: String(o.quantity || 1),
              amount: String(Number(o.price) || 0),
              shipping: String(Number(o.delivery_price) || 0),
              arrived: '0',
            })));
          } else {
            setRows([newRow()]);
          }
        });
    } else {
      setOfficeOrders([]);
      setRows([newRow()]);
    }
  }, [selectedOffice]);

  const addRow = () => setRows(prev => [...prev, newRow()]);

  const removeRow = (id: string) => {
    if (rows.length <= 1) return;
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const updateRow = (id: string, field: keyof SettlementRow, value: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const totalCount = rows.filter(r => r.count.trim() !== '').length;
  const totalPieces = rows.reduce((sum, r) => sum + (parseFloat(r.pieces) || 0), 0);
  const totalAmount = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const totalShipping = rows.reduce((sum, r) => sum + (parseFloat(r.shipping) || 0), 0);
  const totalArrived = rows.reduce((sum, r) => sum + (parseFloat(r.arrived) || 0), 0);

  const pickupRateNum = parseFloat(pickupRate) || 0;
  const pickupTotal = totalCount * pickupRateNum;
  const due = totalAmount - (pickupTotal + totalShipping + totalArrived);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">تقفيلة المكاتب</h1>
        <div className="flex gap-2 items-center">
          <Select value={selectedOffice} onValueChange={setSelectedOffice}>
            <SelectTrigger className="w-[200px] bg-secondary border-border">
              <SelectValue placeholder="اختر مكتب..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المكاتب</SelectItem>
              {offices.map(o => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={addRow}>
            <Plus className="h-4 w-4 ml-1" />إضافة صف
          </Button>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-right w-10">#</TableHead>
                  <TableHead className="text-right">الكود</TableHead>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">العدد</TableHead>
                  <TableHead className="text-right">عدد القطع</TableHead>
                  <TableHead className="text-right">المبلغ</TableHead>
                  <TableHead className="text-right">الشحن</TableHead>
                  <TableHead className="text-right">الواصل</TableHead>
                  <TableHead className="text-right w-10">حذف</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={row.id} className="border-border">
                    <TableCell className="text-sm text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      <Input value={row.code} onChange={e => updateRow(row.id, 'code', e.target.value)} className="bg-secondary border-border h-8 w-28" placeholder="-" />
                    </TableCell>
                    <TableCell>
                      <Input value={row.name} onChange={e => updateRow(row.id, 'name', e.target.value)} className="bg-secondary border-border h-8 w-36" placeholder="-" />
                    </TableCell>
                    <TableCell>
                      <Input value={row.count} onChange={e => updateRow(row.id, 'count', e.target.value)} className="bg-secondary border-border h-8 w-24" placeholder="-" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={row.pieces} onChange={e => updateRow(row.id, 'pieces', e.target.value)} className="bg-secondary border-border h-8 w-24" placeholder="0" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={row.amount} onChange={e => updateRow(row.id, 'amount', e.target.value)} className="bg-secondary border-border h-8 w-28" placeholder="0" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={row.shipping} onChange={e => updateRow(row.id, 'shipping', e.target.value)} className="bg-secondary border-border h-8 w-28" placeholder="0" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={row.arrived} onChange={e => updateRow(row.id, 'arrived', e.target.value)} className="bg-secondary border-border h-8 w-28" placeholder="0" />
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => removeRow(row.id)} disabled={rows.length <= 1}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="border-border bg-muted/50">
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell className="font-bold text-sm">{totalCount}</TableCell>
                  <TableCell className="font-bold text-sm">{totalPieces}</TableCell>
                  <TableCell className="font-bold text-sm">{totalAmount}</TableCell>
                  <TableCell className="font-bold text-sm">{totalShipping}</TableCell>
                  <TableCell className="font-bold text-sm">{totalArrived}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">رقم البيك اب</p>
              <Input type="number" value={pickupRate} onChange={e => setPickupRate(e.target.value)} className="bg-secondary border-border" placeholder="0" />
            </div>
            <div className="text-sm font-medium">البيك اب = {totalCount} × {pickupRateNum} = <span className="font-bold">{pickupTotal}</span></div>
            <div className="text-sm font-medium">المستحق = {totalAmount} - ({pickupTotal} + {totalShipping} + {totalArrived}) = <span className="font-bold">{due}</span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
