import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLogger';
import { format } from 'date-fns';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
  currentDiaryId: string;
  officeId: string;
}

export default function CopyOrderDialog({ open, onOpenChange, orderId, currentDiaryId, officeId }: Props) {
  const qc = useQueryClient();

  const { data: diaries = [] } = useQuery({
    queryKey: ['diaries-for-copy', officeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diaries')
        .select('*')
        .eq('office_id', officeId)
        .eq('is_closed', false)
        .neq('id', currentDiaryId)
        .order('diary_number', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open && !!officeId,
  });

  const copyOrder = useMutation({
    mutationFn: async (diaryId: string) => {
      const { error } = await supabase
        .from('diary_orders')
        .insert({ order_id: orderId!, diary_id: diaryId });
      if (error) throw error;
      await logActivity('نسخ أوردر إلى يومية أخرى', { order_id: orderId, from_diary: currentDiaryId, to_diary: diaryId });
    },
    onSuccess: () => {
      toast.success('تم نسخ الأوردر بنجاح');
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ['diary-orders'] });
    },
    onError: () => toast.error('الأوردر موجود بالفعل في هذه اليومية'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>نسخ إلى يومية أخرى</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-60 overflow-auto">
          {diaries.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">لا توجد يوميات مفتوحة أخرى</p>
          ) : (
            diaries.map((d: any) => (
              <Button
                key={d.id}
                variant="outline"
                className="w-full justify-between"
                onClick={() => copyOrder.mutate(d.id)}
                disabled={copyOrder.isPending}
              >
                <span>يومية رقم {d.diary_number}</span>
                <span className="text-muted-foreground text-sm">{format(new Date(d.diary_date), 'dd/MM/yyyy')}</span>
              </Button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
