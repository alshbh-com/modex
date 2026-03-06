import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLogger';
import { Plus, Lock, Unlock, Trash2, ArrowRight, Calendar, FileText } from 'lucide-react';
import { format } from 'date-fns';

export default function OfficeDiaries() {
  const { officeId } = useParams<{ officeId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: office } = useQuery({
    queryKey: ['office', officeId],
    queryFn: async () => {
      const { data, error } = await supabase.from('offices').select('*').eq('id', officeId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!officeId,
  });

  const { data: diaries = [], isLoading } = useQuery({
    queryKey: ['diaries', officeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diaries')
        .select('*')
        .eq('office_id', officeId!)
        .order('diary_number', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!officeId,
  });

  const createDiary = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('diaries')
        .insert({ office_id: officeId!, diary_date: new Date().toISOString().split('T')[0] })
        .select()
        .single();
      if (error) throw error;
      await logActivity('إنشاء يومية', { diary_id: data.id, office_id: officeId });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diaries', officeId] });
      toast.success('تم إنشاء يومية جديدة');
    },
    onError: () => toast.error('فشل إنشاء اليومية'),
  });

  const toggleClose = useMutation({
    mutationFn: async (diary: any) => {
      const newClosed = !diary.is_closed;
      const { error } = await supabase
        .from('diaries')
        .update({ is_closed: newClosed, closed_at: newClosed ? new Date().toISOString() : null })
        .eq('id', diary.id);
      if (error) throw error;
      await logActivity(newClosed ? 'قفل يومية' : 'إعادة فتح يومية', { diary_id: diary.id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diaries', officeId] });
      toast.success('تم تحديث حالة اليومية');
    },
  });

  const deleteDiary = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('diaries').delete().eq('id', id);
      if (error) throw error;
      await logActivity('حذف يومية', { diary_id: id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diaries', officeId] });
      toast.success('تم حذف اليومية');
    },
  });

  const openDiaries = diaries.filter((d: any) => !d.is_closed);
  const closedDiaries = diaries.filter((d: any) => d.is_closed);

  const renderDiaryCard = (diary: any) => (
    <Card key={diary.id} className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            يومية رقم {diary.diary_number}
          </div>
          <div className="flex items-center gap-1">
            {diary.lock_status_updates && <Badge variant="destructive" className="text-xs">مقفل التعديل</Badge>}
            {diary.prevent_new_orders && <Badge variant="secondary" className="text-xs">ممنوع الإضافة</Badge>}
            <Badge variant={diary.is_closed ? 'secondary' : 'default'} className="text-xs">
              {diary.is_closed ? 'مقفولة' : 'مفتوحة'}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {format(new Date(diary.diary_date), 'dd/MM/yyyy')}
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => navigate(`/diary-offices/${officeId}/diary/${diary.id}`)}>
              فتح
            </Button>
            <Button size="sm" variant="ghost" onClick={() => toggleClose.mutate(diary)}>
              {diary.is_closed ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
              if (confirm('هل أنت متأكد من حذف هذه اليومية؟')) deleteDiary.mutate(diary.id);
            }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/diary-offices')}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">يوميات {office?.name || '...'}</h1>
            <p className="text-muted-foreground text-sm">إدارة اليوميات اليومية</p>
          </div>
        </div>
        <Button onClick={() => createDiary.mutate()} disabled={createDiary.isPending}>
          <Plus className="h-4 w-4 ml-1" />
          يومية جديدة
        </Button>
      </div>

      <Tabs defaultValue="open" dir="rtl">
        <TabsList>
          <TabsTrigger value="open">اليوميات المفتوحة ({openDiaries.length})</TabsTrigger>
          <TabsTrigger value="closed">اليوميات المقفولة ({closedDiaries.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="open" className="space-y-3 mt-4">
          {openDiaries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد يوميات مفتوحة</p>
          ) : openDiaries.map(renderDiaryCard)}
        </TabsContent>
        <TabsContent value="closed" className="space-y-3 mt-4">
          {closedDiaries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد يوميات مقفولة</p>
          ) : closedDiaries.map(renderDiaryCard)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
