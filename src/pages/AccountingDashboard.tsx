import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLogger';
import { TrendingUp, TrendingDown, DollarSign, ArrowUpDown, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

const EXPENSE_CATEGORIES = ['إيجار', 'مرتبات', 'إنترنت', 'وقود', 'صيانة', 'أخرى'];

export default function AccountingDashboard() {
  const qc = useQueryClient();
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ expense_name: '', amount: '', category: 'أخرى', notes: '', expense_date: new Date().toISOString().split('T')[0] });

  // Fetch delivered orders for revenue
  const { data: deliveredOrders = [] } = useQuery({
    queryKey: ['accounting-delivered'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diary_orders')
        .select('*, orders(*)')
        .eq('status_inside_diary', 'تم التسليم');
      if (error) throw error;
      return data;
    },
  });

  // Fetch all diary orders for stats
  const { data: allDiaryOrders = [] } = useQuery({
    queryKey: ['accounting-all-diary-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diary_orders')
        .select('*, orders(*)');
      if (error) throw error;
      return data;
    },
  });

  // Fetch expenses
  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addExpense = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('expenses').insert({
        expense_name: expenseForm.expense_name,
        amount: parseFloat(expenseForm.amount),
        category: expenseForm.category,
        notes: expenseForm.notes,
        expense_date: expenseForm.expense_date,
      });
      if (error) throw error;
      await logActivity('إضافة مصروف', { name: expenseForm.expense_name, amount: expenseForm.amount });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('تم إضافة المصروف');
      setAddExpenseOpen(false);
      setExpenseForm({ expense_name: '', amount: '', category: 'أخرى', notes: '', expense_date: new Date().toISOString().split('T')[0] });
    },
    onError: () => toast.error('فشل إضافة المصروف'),
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      await logActivity('حذف مصروف', { expense_id: id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('تم الحذف');
    },
  });

  // Calculations
  const totalDelivered = deliveredOrders.reduce((sum: number, d: any) => sum + (d.orders?.price || 0), 0);
  const totalShipping = deliveredOrders.reduce((sum: number, d: any) => sum + (d.orders?.delivery_price || 0), 0);
  const totalReturns = allDiaryOrders
    .filter((d: any) => ['مرتجع', 'فرق شحن', 'تحويلة تسليم', 'رفض دون شحن', 'غرامة مرتجع'].includes(d.status_inside_diary))
    .reduce((sum: number, d: any) => sum + (d.orders?.price || 0), 0);
  const totalExpenses = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
  const netProfit = totalShipping - totalExpenses;

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold text-foreground">الحسابات</h1>

      <Tabs defaultValue="profits" dir="rtl">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profits">أرباح الشركة</TabsTrigger>
          <TabsTrigger value="pnl">الأرباح والخسائر</TabsTrigger>
          <TabsTrigger value="expenses">المصاريف</TabsTrigger>
          <TabsTrigger value="cashflow">الداخل والخارج</TabsTrigger>
        </TabsList>

        {/* Company Profits */}
        <TabsContent value="profits" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" /> إجمالي التسليمات
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">{totalDelivered.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-500" /> إجمالي المرتجعات
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">{totalReturns.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-blue-500" /> إيرادات الشحن
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-600">{totalShipping.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-primary" /> صافي الربح
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {netProfit.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Profit & Loss */}
        <TabsContent value="pnl" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <span className="font-medium">إجمالي الدخل (إيرادات الشحن)</span>
                  <span className="text-xl font-bold text-green-600">{totalShipping.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                  <span className="font-medium">إجمالي المصاريف</span>
                  <span className="text-xl font-bold text-red-600">{totalExpenses.toLocaleString()}</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="font-bold text-lg">صافي الربح</span>
                    <span className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {netProfit.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenses */}
        <TabsContent value="expenses" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">المصاريف</h3>
            <Button size="sm" onClick={() => setAddExpenseOpen(true)}>
              <Plus className="h-4 w-4 ml-1" /> إضافة مصروف
            </Button>
          </div>
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">التصنيف</TableHead>
                  <TableHead className="text-right">المبلغ</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">ملاحظات</TableHead>
                  <TableHead className="text-right w-16">حذف</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد مصاريف</TableCell>
                  </TableRow>
                ) : expenses.map((exp: any) => (
                  <TableRow key={exp.id}>
                    <TableCell>{exp.expense_name}</TableCell>
                    <TableCell>{exp.category}</TableCell>
                    <TableCell className="font-medium">{exp.amount}</TableCell>
                    <TableCell>{format(new Date(exp.expense_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{exp.notes}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => {
                        if (confirm('حذف هذا المصروف؟')) deleteExpense.mutate(exp.id);
                      }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Cash Flow */}
        <TabsContent value="cashflow" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-green-200 dark:border-green-800">
              <CardHeader>
                <CardTitle className="text-green-600 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" /> الداخل
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>تسليمات العملاء</span>
                  <span className="font-bold">{totalDelivered.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>إيرادات الشحن</span>
                  <span className="font-bold">{totalShipping.toLocaleString()}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold text-green-600">
                  <span>إجمالي الداخل</span>
                  <span>{(totalDelivered + totalShipping).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-200 dark:border-red-800">
              <CardHeader>
                <CardTitle className="text-red-600 flex items-center gap-2">
                  <TrendingDown className="h-5 w-5" /> الخارج
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>مرتجعات</span>
                  <span className="font-bold">{totalReturns.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>مصاريف</span>
                  <span className="font-bold">{totalExpenses.toLocaleString()}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold text-red-600">
                  <span>إجمالي الخارج</span>
                  <span>{(totalReturns + totalExpenses).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Expense Dialog */}
      <Dialog open={addExpenseOpen} onOpenChange={setAddExpenseOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة مصروف</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">اسم المصروف</label>
              <Input value={expenseForm.expense_name} onChange={(e) => setExpenseForm(p => ({ ...p, expense_name: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">التصنيف</label>
              <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">المبلغ</label>
              <Input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm(p => ({ ...p, amount: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">التاريخ</label>
              <Input type="date" value={expenseForm.expense_date} onChange={(e) => setExpenseForm(p => ({ ...p, expense_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">ملاحظات</label>
              <Textarea value={expenseForm.notes} onChange={(e) => setExpenseForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddExpenseOpen(false)}>إلغاء</Button>
            <Button onClick={() => addExpense.mutate()} disabled={!expenseForm.expense_name || !expenseForm.amount}>
              إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
