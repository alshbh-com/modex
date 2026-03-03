import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import {
  Package, PackageSearch, Archive, Search, Building2, MapPin, Box,
  Truck, Wallet, Building, DollarSign, Printer, ScrollText, Settings, Users,
  BarChart3, UserCheck, TrendingUp, Calendar, Locate, MessageSquare, FileSpreadsheet,
  CircleDot, Calculator, Contact, Clock, CheckCircle2, XCircle
} from 'lucide-react';

const sections = [
  { title: 'الأوردرات', url: '/orders', icon: Package, color: 'hsl(217,91%,60%)' },
  { title: 'جميع الأوردرات', url: '/unassigned-orders', icon: PackageSearch, color: 'hsl(38,92%,50%)' },
  { title: 'الأوردرات القديمة', url: '/closed-orders', icon: Archive, color: 'hsl(215,20%,60%)' },
  { title: 'بحث شامل', url: '/search', icon: Search, color: 'hsl(217,91%,60%)' },
  { title: 'المكاتب', url: '/offices', icon: Building2, color: 'hsl(142,76%,36%)' },
  { title: 'أسعار التوصيل', url: '/delivery-prices', icon: MapPin, color: 'hsl(38,92%,50%)' },
  { title: 'المنتجات', url: '/products', icon: Box, color: 'hsl(0,72%,51%)' },
  { title: 'العملاء', url: '/customers', icon: Contact, color: 'hsl(200,70%,50%)' },
  { title: 'المندوبين', url: '/couriers', icon: Truck, color: 'hsl(38,92%,50%)' },
  { title: 'المستخدمين', url: '/users', icon: Users, color: 'hsl(200,70%,50%)' },
  { title: 'إدارة الحالات', url: '/status-management', icon: CircleDot, color: 'hsl(270,60%,60%)' },
  { title: 'تحصيلات المندوبين', url: '/courier-collections', icon: Wallet, color: 'hsl(217,91%,60%)' },
  { title: 'حسابات المكاتب', url: '/office-accounts', icon: Building, color: 'hsl(142,76%,36%)' },
  { title: 'السلفات والخصومات', url: '/advances', icon: DollarSign, color: 'hsl(0,72%,51%)' },
  { title: 'التقرير اليومي', url: '/daily-report', icon: Calendar, color: 'hsl(142,76%,36%)' },
  { title: 'التقارير المالية', url: '/financial-reports', icon: BarChart3, color: 'hsl(217,91%,60%)' },
  { title: 'إحصائيات المناديب', url: '/courier-stats', icon: UserCheck, color: 'hsl(38,92%,50%)' },
  { title: 'إحصائيات المكاتب', url: '/office-stats', icon: TrendingUp, color: 'hsl(142,76%,36%)' },
  { title: 'تقرير الأرباح', url: '/profit-report', icon: Calculator, color: 'hsl(0,72%,51%)' },
  { title: 'تتبع الشحنات', url: '/tracking', icon: Locate, color: 'hsl(270,60%,60%)' },
  { title: 'الطباعة', url: '/print', icon: Printer, color: 'hsl(215,20%,60%)' },
  { title: 'ملاحظات الأوردرات', url: '/order-notes', icon: MessageSquare, color: 'hsl(200,70%,50%)' },
  { title: 'تصدير البيانات', url: '/data-export', icon: FileSpreadsheet, color: 'hsl(142,76%,36%)' },
  { title: 'سجل الحركات', url: '/logs', icon: ScrollText, color: 'hsl(215,20%,60%)' },
  { title: 'الإعدادات', url: '/settings', icon: Settings, color: 'hsl(215,20%,60%)' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, open: 0, delivered: 0, returned: 0, todayCount: 0, todayShipping: 0 });

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    const today = new Date().toISOString().split('T')[0];
    const [allRes, statusRes] = await Promise.all([
      supabase.from('orders').select('id, is_closed, status_id, price, delivery_price, shipping_paid, created_at'),
      supabase.from('order_statuses').select('id, name'),
    ]);
    const all = allRes.data || [];
    const sts = statusRes.data || [];
    const deliveredIds = sts.filter(s => s.name === 'تم التسليم' || s.name === 'تسليم جزئي').map(s => s.id);
    const returnedIds = sts.filter(s => ['مرتجع', 'رفض ودفع شحن', 'رفض ولم يدفع شحن', 'تهرب', 'ملغي', 'لم يرد'].includes(s.name)).map(s => s.id);
    const rejectPaidShipId = sts.find(s => s.name === 'رفض ودفع شحن')?.id;
    const halfShipId = sts.find(s => s.name === 'استلم ودفع نص الشحن')?.id;
    const todayOrders = all.filter(o => o.created_at.startsWith(today));
    
    // Revenue = shipping from deliveries + shipping_paid from reject+paid
    const todayShipping = todayOrders.reduce((s, o) => {
      if (deliveredIds.includes(o.status_id)) return s + Number(o.delivery_price);
      if (o.status_id === rejectPaidShipId || o.status_id === halfShipId) return s + Number(o.shipping_paid || 0);
      return s;
    }, 0);

    setStats({
      total: all.length,
      open: all.filter(o => !o.is_closed).length,
      delivered: all.filter(o => deliveredIds.includes(o.status_id)).length,
      returned: all.filter(o => returnedIds.includes(o.status_id)).length,
      todayCount: todayOrders.length,
      todayShipping,
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">لوحة التحكم</h1>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="bg-card border-border"><CardContent className="p-3 text-center">
          <Package className="h-5 w-5 mx-auto mb-1 text-primary" />
          <p className="text-[10px] text-muted-foreground">إجمالي</p>
          <p className="text-lg font-bold">{stats.total}</p>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-3 text-center">
          <Clock className="h-5 w-5 mx-auto mb-1 text-warning" />
          <p className="text-[10px] text-muted-foreground">مفتوح</p>
          <p className="text-lg font-bold text-warning">{stats.open}</p>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-3 text-center">
          <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-success" />
          <p className="text-[10px] text-muted-foreground">تسليم</p>
          <p className="text-lg font-bold text-success">{stats.delivered}</p>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-3 text-center">
          <XCircle className="h-5 w-5 mx-auto mb-1 text-destructive" />
          <p className="text-[10px] text-muted-foreground">مرتجع</p>
          <p className="text-lg font-bold text-destructive">{stats.returned}</p>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-3 text-center">
          <Calendar className="h-5 w-5 mx-auto mb-1 text-primary" />
          <p className="text-[10px] text-muted-foreground">اليوم</p>
          <p className="text-lg font-bold">{stats.todayCount}</p>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-3 text-center">
          <DollarSign className="h-5 w-5 mx-auto mb-1 text-success" />
          <p className="text-[10px] text-muted-foreground">إيراد اليوم</p>
          <p className="text-lg font-bold">{stats.todayShipping.toLocaleString()}</p>
        </CardContent></Card>
      </div>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {sections.map((s) => (
          <Card key={s.url} className="bg-card border-border cursor-pointer hover:bg-secondary/50 transition-colors active:scale-95" onClick={() => navigate(s.url)}>
            <CardContent className="flex flex-col items-center gap-2 p-3 sm:p-4">
              <div className="rounded-xl p-2.5" style={{ backgroundColor: s.color + '20' }}>
                <s.icon className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: s.color }} />
              </div>
              <span className="text-xs sm:text-sm font-medium text-center leading-tight">{s.title}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
