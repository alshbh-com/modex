import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DiaryOffices() {
  const navigate = useNavigate();

  const { data: offices = [], isLoading } = useQuery({
    queryKey: ['diary-offices'],
    queryFn: async () => {
      const { data, error } = await supabase.from('offices').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: diaryCounts = {} } = useQuery({
    queryKey: ['diary-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diaries')
        .select('office_id, is_closed');
      if (error) throw error;
      const counts: Record<string, { open: number; closed: number }> = {};
      data.forEach((d: any) => {
        if (!counts[d.office_id]) counts[d.office_id] = { open: 0, closed: 0 };
        if (d.is_closed) counts[d.office_id].closed++;
        else counts[d.office_id].open++;
      });
      return counts;
    },
  });

  if (isLoading) return <div className="p-8 text-center">جاري التحميل...</div>;

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">المكاتب - نظام اليوميات</h1>
        <p className="text-muted-foreground mt-1">اختر مكتب لعرض اليوميات</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {offices.map((office) => {
          const counts = (diaryCounts as any)[office.id] || { open: 0, closed: 0 };
          return (
            <Card
              key={office.id}
              className="cursor-pointer hover:shadow-lg transition-shadow border-border"
              onClick={() => navigate(`/diary-offices/${office.id}`)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-lg">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    {office.name}
                  </div>
                  <ChevronLeft className="h-5 w-5 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 text-sm">
                  <span className="text-green-600 dark:text-green-400">
                    يوميات مفتوحة: {counts.open}
                  </span>
                  <span className="text-muted-foreground">
                    يوميات مقفولة: {counts.closed}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
