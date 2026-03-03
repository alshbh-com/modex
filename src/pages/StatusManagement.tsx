import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit, ArrowUp, ArrowDown, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLogger';

export default function StatusManagement() {
  const [statuses, setStatuses] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [orderCounts, setOrderCounts] = useState<Record<string, number>>({});

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [statusRes, ordersRes] = await Promise.all([
      supabase.from('order_statuses').select('*').order('sort_order'),
      supabase.from('orders').select('status_id'),
    ]);
    setStatuses(statusRes.data || []);
    const counts: Record<string, number> = {};
    (ordersRes.data || []).forEach(o => { if (o.status_id) counts[o.status_id] = (counts[o.status_id] || 0) + 1; });
    setOrderCounts(counts);
  };

  const save = async () => {
    if (!name.trim()) { toast.error('أدخل اسم الحالة'); return; }
    if (editId) {
      const editing = statuses.find(s => s.id === editId);
      if (editing?.is_fixed) { toast.error('لا يمكن تعديل حالة ثابتة'); return; }
      await supabase.from('order_statuses').update({ name, color }).eq('id', editId);
      logActivity('تعديل حالة', { status_name: name });
      toast.success('تم التحديث');
    } else {
      const maxOrder = statuses.length > 0 ? Math.max(...statuses.map(s => s.sort_order)) + 1 : 0;
      await supabase.from('order_statuses').insert({ name, color, sort_order: maxOrder, is_fixed: false });
      logActivity('إضافة حالة جديدة', { status_name: name });
      toast.success('تمت الإضافة');
    }
    setDialogOpen(false); setEditId(null); setName(''); setColor('#3b82f6');
    loadData();
  };

  const remove = async (id: string) => {
    const s = statuses.find(st => st.id === id);
    if (s?.is_fixed) { toast.error('هذه حالة ثابتة لا يمكن حذفها'); return; }
    if (orderCounts[id] > 0) { toast.error('لا يمكن حذف حالة مستخدمة في أوردرات'); return; }
    if (!confirm('حذف هذه الحالة؟')) return;
    await supabase.from('order_statuses').delete().eq('id', id);
    logActivity('حذف حالة', { status_name: s?.name });
    toast.success('تم الحذف');
    loadData();
  };

  const edit = (s: any) => {
    if (s.is_fixed) { toast.error('لا يمكن تعديل حالة ثابتة'); return; }
    setEditId(s.id); setName(s.name); setColor(s.color || '#3b82f6'); setDialogOpen(true);
  };

  const moveUp = async (index: number) => {
    if (index === 0) return;
    const current = statuses[index];
    const prev = statuses[index - 1];
    await Promise.all([
      supabase.from('order_statuses').update({ sort_order: prev.sort_order }).eq('id', current.id),
      supabase.from('order_statuses').update({ sort_order: current.sort_order }).eq('id', prev.id),
    ]);
    loadData();
  };

  const moveDown = async (index: number) => {
    if (index === statuses.length - 1) return;
    const current = statuses[index];
    const next = statuses[index + 1];
    await Promise.all([
      supabase.from('order_statuses').update({ sort_order: next.sort_order }).eq('id', current.id),
      supabase.from('order_statuses').update({ sort_order: current.sort_order }).eq('id', next.id),
    ]);
    loadData();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">إدارة الحالات</h1>
        <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) { setEditId(null); setName(''); setColor('#3b82f6'); } }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 ml-1" />إضافة حالة</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>{editId ? 'تعديل حالة' : 'إضافة حالة جديدة'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>اسم الحالة</Label><Input value={name} onChange={e => setName(e.target.value)} className="bg-secondary border-border" /></div>
              <div>
                <Label>اللون</Label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
                  <Input value={color} onChange={e => setColor(e.target.value)} className="bg-secondary border-border flex-1" dir="ltr" />
                  <div className="w-20"><Badge style={{ backgroundColor: color + '30', color }}>{name || 'معاينة'}</Badge></div>
                </div>
              </div>
              <Button onClick={save} className="w-full">{editId ? 'تحديث' : 'إضافة'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="w-16 text-center">ترتيب</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-center">اللون</TableHead>
                  <TableHead className="text-center">عدد الأوردرات</TableHead>
                  <TableHead className="text-center">نوع</TableHead>
                  <TableHead className="text-center">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statuses.map((s, i) => (
                  <TableRow key={s.id} className="border-border">
                    <TableCell>
                      <div className="flex gap-1 justify-center">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveUp(i)} disabled={i === 0}><ArrowUp className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveDown(i)} disabled={i === statuses.length - 1}><ArrowDown className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge style={{ backgroundColor: (s.color || '#6b7280') + '30', color: s.color || '#6b7280' }}>{s.name}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="w-6 h-6 rounded-full mx-auto" style={{ backgroundColor: s.color || '#6b7280' }} />
                    </TableCell>
                    <TableCell className="text-center font-bold">{orderCounts[s.id] || 0}</TableCell>
                    <TableCell className="text-center">
                      {s.is_fixed ? (
                        <Badge variant="outline" className="text-xs gap-1"><Lock className="h-3 w-3" />ثابتة</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">مخصصة</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-center">
                        {!s.is_fixed && (
                          <>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => edit(s)}><Edit className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </>
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
    </div>
  );
}
