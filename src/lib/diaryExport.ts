import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export function exportDiaryToPDF(diary: any, diaryOrders: any[], officeName: string) {
  const doc = new jsPDF({ orientation: 'landscape' });
  
  // Title
  doc.setFontSize(16);
  doc.text(`${officeName} - Diary #${diary.diary_number}`, 14, 20);
  doc.setFontSize(10);
  doc.text(`Date: ${format(new Date(diary.diary_date), 'dd/MM/yyyy')}`, 14, 28);

  const headers = ['#', 'Name', 'Code', 'Price', 'Executed', 'Postponed', 'Returned', 'Partial', 'Status'];
  const rows = diaryOrders.map((dOrder: any, idx: number) => {
    const order = dOrder.orders;
    const price = order?.price || 0;
    const status = dOrder.status_inside_diary;
    const partial = dOrder.partial_amount || 0;
    const isReturn = ['مرتجع', 'فرق شحن', 'تحويلة تسليم', 'رفض دون شحن', 'غرامة مرتجع'].includes(status);
    
    return [
      idx + 1,
      order?.customer_name || '',
      order?.barcode || order?.customer_code || '',
      price,
      status === 'تم التسليم' ? price : '',
      status === 'مؤجل' ? price : '',
      isReturn ? price : (status === 'تسليم جزئي' ? price - partial : ''),
      status === 'تسليم جزئي' ? partial : '',
      status,
    ];
  });

  (doc as any).autoTable({
    head: [headers],
    body: rows,
    startY: 35,
    styles: { fontSize: 8, halign: 'center' },
    headStyles: { fillColor: [41, 128, 185] },
  });

  doc.save(`diary-${diary.diary_number}-${officeName}.pdf`);
}

export function exportDiaryToExcel(diary: any, diaryOrders: any[], officeName: string) {
  const rows = diaryOrders.map((dOrder: any, idx: number) => {
    const order = dOrder.orders;
    const price = order?.price || 0;
    const status = dOrder.status_inside_diary;
    const partial = dOrder.partial_amount || 0;
    const isReturn = ['مرتجع', 'فرق شحن', 'تحويلة تسليم', 'رفض دون شحن', 'غرامة مرتجع'].includes(status);

    return {
      '#': idx + 1,
      'الاسم': order?.customer_name || '',
      'الكود': order?.barcode || order?.customer_code || '',
      'السعر': price,
      'منفذ': status === 'تم التسليم' ? price : '',
      'نزول': status === 'مؤجل' ? price : '',
      'مرتجع': isReturn ? price : (status === 'تسليم جزئي' ? price - partial : ''),
      'تسليم جزئي': status === 'تسليم جزئي' ? partial : '',
      'الحالة': status,
      'الباركود': order?.barcode || '',
      'العنوان': order?.address || '',
      'الشحن': order?.delivery_price || 0,
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `يومية ${diary.diary_number}`);
  XLSX.writeFile(wb, `diary-${diary.diary_number}-${officeName}.xlsx`);
}

export function shareDiaryWhatsApp(diary: any, diaryOrders: any[], officeName: string) {
  let text = `📋 ${officeName} - يومية رقم ${diary.diary_number}\n`;
  text += `📅 ${format(new Date(diary.diary_date), 'dd/MM/yyyy')}\n\n`;

  let totalExecuted = 0, totalPostponed = 0, totalReturned = 0, totalPartial = 0;

  diaryOrders.forEach((dOrder: any, idx: number) => {
    const order = dOrder.orders;
    const price = order?.price || 0;
    const status = dOrder.status_inside_diary;
    const partial = dOrder.partial_amount || 0;

    text += `${idx + 1}. ${order?.customer_name} | ${order?.barcode} | ${price} | ${status}\n`;

    if (status === 'تم التسليم') totalExecuted += price;
    else if (status === 'مؤجل') totalPostponed += price;
    else if (status === 'تسليم جزئي') {
      totalPartial += partial;
      totalReturned += price - partial;
    } else if (['مرتجع', 'فرق شحن', 'تحويلة تسليم', 'رفض دون شحن', 'غرامة مرتجع'].includes(status)) {
      totalReturned += price;
    }
  });

  text += `\n--- الإجمالي ---\n`;
  text += `✅ منفذ: ${totalExecuted}\n`;
  text += `⏳ نزول: ${totalPostponed}\n`;
  text += `🔄 مرتجع: ${totalReturned}\n`;
  text += `📦 تسليم جزئي: ${totalPartial}\n`;

  const encoded = encodeURIComponent(text);
  window.open(`https://wa.me/?text=${encoded}`, '_blank');
}
