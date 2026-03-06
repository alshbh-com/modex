import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

const RETURN_STATUSES = ['مرتجع', 'فرق شحن', 'تحويلة تسليم', 'رفض دون شحن', 'غرامة مرتجع'];

function calcRow(dOrder: any) {
  const price = dOrder.orders?.price || 0;
  const status = dOrder.status_inside_diary;
  const partial = dOrder.partial_amount || 0;
  return {
    price,
    executed: status === 'تم التسليم' ? price : 0,
    postponed: status === 'مؤجل' ? price : 0,
    returned: status === 'تسليم جزئي' ? (price - partial) : (RETURN_STATUSES.includes(status) ? price : 0),
    partial: status === 'تسليم جزئي' ? partial : 0,
    shippingDiff: status === 'فرق شحن' ? price : 0,
    transferDelivery: status === 'تحويلة تسليم' ? price : 0,
    refuseNoShipping: status === 'رفض دون شحن' ? price : 0,
    returnPenalty: status === 'غرامة مرتجع' ? price : 0,
    status,
  };
}

export function exportDiaryToPDF(diary: any, diaryOrders: any[], officeName: string) {
  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(14);
  doc.text(`${officeName} - Diary #${diary.diary_number}`, 14, 15);
  doc.setFontSize(9);
  doc.text(`Date: ${format(new Date(diary.diary_date), 'dd/MM/yyyy')} | Status: ${diary.is_closed ? 'Closed' : 'Open'} | Locked: ${diary.lock_status_updates ? 'Yes' : 'No'}`, 14, 22);

  const headers = ['#', 'Name', 'N', 'Code', 'Price', 'Executed', 'Postponed', 'Returned', 'Partial', 'Shp Diff', 'Transfer', 'No Ship', 'Penalty', 'Status', 'Return St'];

  const rows = diaryOrders.map((dOrder: any, idx: number) => {
    const order = dOrder.orders;
    const row = calcRow(dOrder);
    return [
      idx + 1, order?.customer_name || '', dOrder.n_column || '', order?.barcode || order?.customer_code || '',
      row.price, row.executed || '', row.postponed || '', row.returned || '', row.partial || '',
      row.shippingDiff || '', row.transferDelivery || '', row.refuseNoShipping || '', row.returnPenalty || '',
      row.status, RETURN_STATUSES.includes(row.status) || row.status === 'تسليم جزئي' ? row.status : '',
    ];
  });

  // Totals row
  const totals = diaryOrders.reduce((acc: any, d: any) => {
    const r = calcRow(d);
    return {
      price: acc.price + r.price, executed: acc.executed + r.executed, postponed: acc.postponed + r.postponed,
      returned: acc.returned + r.returned, partial: acc.partial + r.partial, shippingDiff: acc.shippingDiff + r.shippingDiff,
      transferDelivery: acc.transferDelivery + r.transferDelivery, refuseNoShipping: acc.refuseNoShipping + r.refuseNoShipping,
      returnPenalty: acc.returnPenalty + r.returnPenalty,
    };
  }, { price: 0, executed: 0, postponed: 0, returned: 0, partial: 0, shippingDiff: 0, transferDelivery: 0, refuseNoShipping: 0, returnPenalty: 0 });

  rows.push(['', 'TOTAL', '', '', totals.price, totals.executed, totals.postponed, totals.returned, totals.partial, totals.shippingDiff, totals.transferDelivery, totals.refuseNoShipping, totals.returnPenalty, '', '']);

  (doc as any).autoTable({
    head: [headers],
    body: rows,
    startY: 28,
    styles: { fontSize: 6, halign: 'center', cellPadding: 1 },
    headStyles: { fillColor: [41, 128, 185], fontSize: 6 },
  });

  doc.save(`diary-${diary.diary_number}-${officeName}.pdf`);
}

export function exportDiaryToExcel(diary: any, diaryOrders: any[], officeName: string) {
  const rows = diaryOrders.map((dOrder: any, idx: number) => {
    const order = dOrder.orders;
    const row = calcRow(dOrder);
    return {
      '#': idx + 1, 'الاسم': order?.customer_name || '', 'ن': dOrder.n_column || '',
      'الكود': order?.barcode || order?.customer_code || '', 'السعر': row.price,
      'منفذ': row.executed || '', 'نزول': row.postponed || '', 'مرتجع': row.returned || '',
      'تسليم جزئي': row.partial || '', 'فرق شحن': row.shippingDiff || '',
      'تحويلة تسليم': row.transferDelivery || '', 'رفض دون شحن': row.refuseNoShipping || '',
      'غرامة مرتجع': row.returnPenalty || '', 'الحالة': row.status,
      'حالة المرتجع': RETURN_STATUSES.includes(row.status) || row.status === 'تسليم جزئي' ? row.status : '',
      'الباركود': order?.barcode || '', 'العنوان': order?.address || '', 'الشحن': order?.delivery_price || 0,
      'عدد القطع': order?.quantity || 1,
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `يومية ${diary.diary_number}`);
  XLSX.writeFile(wb, `diary-${diary.diary_number}-${officeName}.xlsx`);
}

export function shareDiaryWhatsApp(diary: any, diaryOrders: any[], officeName: string) {
  let text = `📋 *${officeName}* - يومية رقم ${diary.diary_number}\n`;
  text += `📅 ${format(new Date(diary.diary_date), 'dd/MM/yyyy')}\n`;
  text += `📊 حالة: ${diary.is_closed ? 'مقفولة' : 'مفتوحة'} | تجميد: ${diary.lock_status_updates ? 'نعم' : 'لا'}\n`;
  text += `━━━━━━━━━━━━━━━━━━\n\n`;

  const totals = { executed: 0, postponed: 0, returned: 0, partial: 0 };

  diaryOrders.forEach((dOrder: any, idx: number) => {
    const order = dOrder.orders;
    const row = calcRow(dOrder);
    text += `${idx + 1}. ${order?.customer_name} | #${order?.barcode} | ${row.price} | ${row.status}\n`;
    totals.executed += row.executed;
    totals.postponed += row.postponed;
    totals.returned += row.returned;
    totals.partial += row.partial;
  });

  text += `\n━━━━━━━━━━━━━━━━━━\n`;
  text += `📊 *الإجمالي* (${diaryOrders.length} أوردر)\n`;
  text += `✅ منفذ: ${totals.executed}\n`;
  text += `⏳ نزول: ${totals.postponed}\n`;
  text += `🔄 مرتجع: ${totals.returned}\n`;
  text += `📦 تسليم جزئي: ${totals.partial}\n`;

  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

// Reusable export as JSON (for future external integrations)
export function exportDiaryAsJSON(diary: any, diaryOrders: any[], officeName: string) {
  const payload = {
    office_name: officeName,
    diary_number: diary.diary_number,
    diary_date: diary.diary_date,
    is_closed: diary.is_closed,
    lock_status_updates: diary.lock_status_updates,
    orders: diaryOrders.map((dOrder: any) => {
      const order = dOrder.orders;
      const row = calcRow(dOrder);
      return {
        barcode: order?.barcode,
        customer_name: order?.customer_name,
        address: order?.address,
        price: order?.price,
        delivery_price: order?.delivery_price,
        quantity: order?.quantity,
        status_inside_diary: dOrder.status_inside_diary,
        partial_amount: dOrder.partial_amount,
        n_column: dOrder.n_column,
        calculations: row,
      };
    }),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `diary-${diary.diary_number}-${officeName}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
