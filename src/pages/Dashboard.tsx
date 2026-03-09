import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { usePermissions, urlToSectionKey } from '@/hooks/usePermissions';
import {
  Package, PackageSearch, Archive, Search, Building2, MapPin, Box,
  Truck, Wallet, Building, DollarSign, Printer, ScrollText, Settings, Users,
  BarChart3, UserCheck, TrendingUp, Calendar, Locate, MessageSquare, FileSpreadsheet,
  CircleDot, Calculator, Contact, Clock, CheckCircle2, XCircle, FileBarChart, Trash2,
  Navigation2, Send, User, Phone, Check, CheckCheck, AlertTriangle
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
  { title: 'تقرير المكاتب الجديد', url: '/office-report', icon: FileBarChart, color: 'hsl(217,91%,60%)' },
  { title: 'سلة المحذوفات', url: '/trash', icon: Trash2, color: 'hsl(0,72%,51%)' },
  { title: 'سيستم الحسابات', url: '/accounting-system', icon: Calculator, color: 'hsl(270,60%,60%)' },
];

interface CourierSummary {
  id: string; name: string; phone: string;
  totalOrders: number; delivered: number; returned: number; pending: number;
  successRate: number; isOnline: boolean; lastUpdate?: string;
}

interface ChatContact {
  id: string; name: string; role: string; unread: number;
  lastMessage?: string; lastTime?: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canView } = usePermissions();
  const [stats, setStats] = useState({ total: 0, open: 0, delivered: 0, returned: 0, todayCount: 0, todayShipping: 0 });

  // Courier tracking state
  const [courierSummaries, setCourierSummaries] = useState<CourierSummary[]>([]);

  // Chat state
  const [chatContacts, setChatContacts] = useState<ChatContact[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const visibleSections = useMemo(
    () => sections.filter((section) => canView(urlToSectionKey(section.url))),
    [canView]
  );

  useEffect(() => {
    loadStats();
    loadCourierTracking();
    loadChatContacts();
  }, []);

  // Auto-refresh courier tracking
  useEffect(() => {
    const interval = setInterval(loadCourierTracking, 30000);
    return () => clearInterval(interval);
  }, []);

  // Chat realtime
  useEffect(() => {
    if (!selectedChat) return;
    loadChatMessages(selectedChat);
    markRead(selectedChat);

    const channel = supabase.channel('dash-chat-' + selectedChat)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `receiver_id=eq.${user?.id}`,
      }, (payload) => {
        const msg = payload.new as any;
        if (msg.sender_id === selectedChat) {
          setChatMessages(prev => [...prev, msg]);
          markRead(selectedChat);
        }
        loadChatContacts();
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedChat]);

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages]);

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
    const todayShipping = todayOrders.reduce((s, o) => {
      if (deliveredIds.includes(o.status_id)) return s + Number(o.delivery_price);
      if (o.status_id === rejectPaidShipId || o.status_id === halfShipId) return s + Number(o.shipping_paid || 0);
      return s;
    }, 0);
    setStats({ total: all.length, open: all.filter(o => !o.is_closed).length, delivered: all.filter(o => deliveredIds.includes(o.status_id)).length, returned: all.filter(o => returnedIds.includes(o.status_id)).length, todayCount: todayOrders.length, todayShipping });
  };

  const loadCourierTracking = async () => {
    const [rolesRes, ordersRes, statusRes, locRes] = await Promise.all([
      supabase.from('user_roles').select('user_id').eq('role', 'courier'),
      supabase.from('orders').select('id, courier_id, status_id').not('courier_id', 'is', null).eq('is_closed', false),
      supabase.from('order_statuses').select('id, name'),
      supabase.from('courier_locations' as any).select('*'),
    ]);
    const courierIds = (rolesRes.data || []).map(r => r.user_id);
    if (courierIds.length === 0) return;

    const { data: profiles } = await supabase.from('profiles').select('id, full_name, phone').in('id', courierIds);
    const orders = ordersRes.data || [];
    const sts = statusRes.data || [];
    const locations = locRes.data || [];
    const deliveredIds = sts.filter(s => s.name === 'تم التسليم' || s.name === 'تسليم جزئي').map(s => s.id);
    const returnedIds = sts.filter(s => ['رفض ولم يدفع شحن', 'رفض ودفع شحن', 'تهرب', 'ملغي', 'لم يرد'].includes(s.name)).map(s => s.id);

    const summaries: CourierSummary[] = (profiles || []).map(p => {
      const co = orders.filter(o => o.courier_id === p.id);
      const del = co.filter(o => deliveredIds.includes(o.status_id)).length;
      const ret = co.filter(o => returnedIds.includes(o.status_id)).length;
      const loc = locations.find((l: any) => l.courier_id === p.id) as any;
      const isOnline = loc ? (Date.now() - new Date(loc.updated_at).getTime()) < 600000 : false;
      return {
        id: p.id, name: p.full_name || 'بدون اسم', phone: p.phone || '-',
        totalOrders: co.length, delivered: del, returned: ret, pending: co.length - del - ret,
        successRate: co.length > 0 ? Math.round((del / co.length) * 100) : 0,
        isOnline, lastUpdate: loc?.updated_at as string | undefined,
      };
    }).sort((a, b) => b.pending - a.pending);
    setCourierSummaries(summaries);
  };

  const loadChatContacts = async () => {
    const { data: roles } = await supabase.from('user_roles').select('user_id, role');
    if (!roles) return;
    const userIds = [...new Set(roles.map(r => r.user_id))].filter(id => id !== user?.id);
    if (userIds.length === 0) return;
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, phone').in('id', userIds);
    if (!profiles) return;

    const { data: unread } = await supabase.from('messages' as any).select('sender_id').eq('receiver_id', user?.id || '').eq('is_read', false);
    const unreadMap: Record<string, number> = {};
    (unread || []).forEach((m: any) => { unreadMap[m.sender_id] = (unreadMap[m.sender_id] || 0) + 1; });

    const { data: lastMsgs } = await supabase.from('messages' as any).select('*').or(`sender_id.eq.${user?.id},receiver_id.eq.${user?.id}`).order('created_at', { ascending: false }).limit(300);
    const lastMap: Record<string, { msg: string; time: string }> = {};
    (lastMsgs || []).forEach((m: any) => {
      const oid = m.sender_id === user?.id ? m.receiver_id : m.sender_id;
      if (!lastMap[oid]) lastMap[oid] = { msg: m.message, time: m.created_at };
    });

    const contacts: ChatContact[] = profiles.map(p => {
      const role = roles.find(r => r.user_id === p.id)?.role || '';
      return {
        id: p.id, name: p.full_name || 'بدون اسم',
        role: role === 'courier' ? 'مندوب' : role === 'owner' ? 'مالك' : role === 'admin' ? 'أدمن' : 'مكتب',
        unread: unreadMap[p.id] || 0,
        lastMessage: lastMap[p.id]?.msg, lastTime: lastMap[p.id]?.time,
      };
    }).sort((a, b) => b.unread - a.unread || (b.lastTime || '').localeCompare(a.lastTime || ''));
    setChatContacts(contacts);
  };

  const loadChatMessages = async (contactId: string) => {
    const { data } = await supabase.from('messages' as any).select('*')
      .or(`and(sender_id.eq.${user?.id},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${user?.id})`)
      .order('created_at', { ascending: true }).limit(100);
    setChatMessages(data || []);
  };

  const markRead = async (contactId: string) => {
    await supabase.from('messages' as any).update({ is_read: true }).eq('sender_id', contactId).eq('receiver_id', user?.id || '').eq('is_read', false);
  };

  const sendMsg = async () => {
    if (!newMsg.trim() || !selectedChat || sending) return;
    setSending(true);
    const { data } = await supabase.from('messages' as any).insert({ sender_id: user?.id, receiver_id: selectedChat, message: newMsg.trim() }).select().single();
    if (data) { setChatMessages(prev => [...prev, data]); setNewMsg(''); loadChatContacts(); }
    setSending(false);
  };

  const totalUnread = chatContacts.reduce((s, c) => s + c.unread, 0);
  const onlineCouriers = courierSummaries.filter(c => c.isOnline).length;
  const selectedContactInfo = chatContacts.find(c => c.id === selectedChat);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">لوحة التحكم</h1>

      {/* Stats cards */}
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

      {/* Courier Tracking + Chat side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Courier Tracking Widget */}
        <Card className="bg-card border-border">
          <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Navigation2 className="h-4 w-4 text-primary" />
              تتبع المناديب
              <Badge variant="outline" className="text-xs">{onlineCouriers} متصل</Badge>
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/courier-tracking')}>
              عرض الكل
            </Button>
          </CardHeader>
          <CardContent className="p-2">
            <ScrollArea className="h-[320px]">
              <div className="space-y-2 px-1">
                {courierSummaries.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-8">لا يوجد مناديب</p>
                )}
                {courierSummaries.map(c => (
                  <div key={c.id} className={`p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors ${c.isOnline ? 'bg-primary/5' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${c.isOnline ? 'bg-success' : 'bg-muted-foreground'}`} />
                        <span className="font-medium text-sm">{c.name}</span>
                      </div>
                      <Badge variant={c.successRate >= 70 ? 'default' : c.successRate >= 40 ? 'secondary' : 'destructive'} className="text-xs">
                        {c.successRate}%
                      </Badge>
                    </div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">التقدم ({c.delivered + c.returned}/{c.totalOrders})</span>
                      <span>{c.totalOrders > 0 ? Math.round(((c.delivered + c.returned) / c.totalOrders) * 100) : 0}%</span>
                    </div>
                    <Progress value={c.totalOrders > 0 ? ((c.delivered + c.returned) / c.totalOrders) * 100 : 0} className="h-1.5 mb-2" />
                    <div className="grid grid-cols-3 gap-1 text-center text-xs">
                      <span className="text-warning font-bold">{c.pending} معلق</span>
                      <span className="text-success font-bold">{c.delivered} تسليم</span>
                      <span className="text-destructive font-bold">{c.returned} مرتجع</span>
                    </div>
                    {!c.isOnline && c.totalOrders > 0 && (
                      <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                        <AlertTriangle className="h-3 w-3" /> غير متصل
                        {c.lastUpdate && ` - ${Math.round((Date.now() - new Date(c.lastUpdate).getTime()) / 60000)} دقيقة`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat Widget */}
        <Card className="bg-card border-border">
          <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              المحادثات
              {totalUnread > 0 && <Badge variant="destructive" className="text-xs">{totalUnread}</Badge>}
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/chat')}>
              فتح الشات
            </Button>
          </CardHeader>
          <CardContent className="p-2">
            {!selectedChat ? (
              <ScrollArea className="h-[320px]">
                <div className="space-y-1 px-1">
                  {chatContacts.length === 0 && (
                    <p className="text-center text-muted-foreground text-sm py-8">لا يوجد محادثات</p>
                  )}
                  {chatContacts.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedChat(c.id)}
                      className="w-full p-2.5 flex items-center gap-2.5 text-right hover:bg-accent/50 transition-colors rounded-lg"
                    >
                      <div className="rounded-full p-1.5 bg-primary/10 shrink-0">
                        <User className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm truncate">{c.name}</span>
                          {c.unread > 0 && <Badge variant="destructive" className="text-xs">{c.unread}</Badge>}
                        </div>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">{c.role}</Badge>
                          {c.lastTime && <span className="text-xs text-muted-foreground">{new Date(c.lastTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>}
                        </div>
                        {c.lastMessage && <p className="text-xs text-muted-foreground truncate mt-0.5">{c.lastMessage}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col h-[320px]">
                {/* Chat header */}
                <div className="flex items-center gap-2 p-2 border-b border-border shrink-0">
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelectedChat(null)}>← رجوع</Button>
                  <span className="font-medium text-sm">{selectedContactInfo?.name}</span>
                  <Badge variant="outline" className="text-xs">{selectedContactInfo?.role}</Badge>
                </div>
                {/* Messages */}
                <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-2 space-y-1.5">
                  {chatMessages.length === 0 && <p className="text-center text-muted-foreground text-xs py-4">ابدأ المحادثة</p>}
                  {chatMessages.map((m: any) => {
                    const isMine = m.sender_id === user?.id;
                    return (
                      <div key={m.id} className={`flex ${isMine ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[80%] rounded-lg px-2.5 py-1.5 text-xs ${isMine ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                          <p>{m.message}</p>
                          <div className={`flex items-center gap-1 mt-0.5 opacity-60 text-[10px] ${isMine ? 'justify-start' : 'justify-end'}`}>
                            <span>{new Date(m.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                            {isMine && (m.is_read ? <CheckCheck className="h-2.5 w-2.5" /> : <Check className="h-2.5 w-2.5" />)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Input */}
                <div className="p-2 border-t border-border shrink-0 flex gap-2">
                  <Input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="اكتب رسالة..." className="bg-secondary text-xs h-8"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } }} />
                  <Button onClick={sendMsg} disabled={sending || !newMsg.trim()} size="icon" className="h-8 w-8 shrink-0">
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section shortcuts */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {visibleSections.map((s) => (
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
