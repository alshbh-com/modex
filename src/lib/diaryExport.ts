import * as XLSX from 'xlsx';
import { format } from 'date-fns';

const RETURN_STATUSES = ['مرتجع', 'فرق شحن', 'عمولة التسليم', 'رفض دون شحن', 'غرامة مرتجع'];

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
    transferDelivery: status === 'عمولة التسليم' ? price : 0,
    refuseNoShipping: status === 'رفض دون شحن' ? price : 0,
    returnPenalty: status === 'غرامة مرتجع' ? price : 0,
    status,
  };
}

export function exportDiaryToPDF(diary: any, diaryOrders: any[], officeName: string) {
  const w = window.open('', '_blank');
  if (!w) return;

  const totals = diaryOrders.reduce((acc: any, d: any) => {
    const r = calcRow(d);
    return {
      price: acc.price + r.price, executed: acc.executed + r.executed, postponed: acc.postponed + r.postponed,
      returned: acc.returned + r.returned, partial: acc.partial + r.partial, shippingDiff: acc.shippingDiff + r.shippingDiff,
      transferDelivery: acc.transferDelivery + r.transferDelivery, refuseNoShipping: acc.refuseNoShipping + r.refuseNoShipping,
      returnPenalty: acc.returnPenalty + r.returnPenalty,
    };
  }, { price: 0, executed: 0, postponed: 0, returned: 0, partial: 0, shippingDiff: 0, transferDelivery: 0, refuseNoShipping: 0, returnPenalty: 0 });

  const rows = diaryOrders.map((dOrder: any, idx: number) => {
    const order = dOrder.orders;
    const row = calcRow(dOrder);
    return `<tr>
      <td>${idx + 1}</td>
      <td>${order?.customer_name || ''}</td>
      <td>${dOrder.n_column || ''}</td>
      <td>${order?.barcode || order?.customer_code || ''}</td>
      <td>${row.price}</td>
      <td>${row.executed || ''}</td>
      <td>${row.postponed || ''}</td>
      <td>${row.returned || ''}</td>
      <td>${row.partial || ''}</td>
      <td>${row.shippingDiff || ''}</td>
      <td>${row.transferDelivery || ''}</td>
      <td>${row.refuseNoShipping || ''}</td>
      <td>${row.returnPenalty || ''}</td>
      <td>${row.status}</td>
      <td>${RETURN_STATUSES.includes(row.status) || row.status === 'تسليم جزئي' ? row.status : ''}</td>
    </tr>`;
  }).join('');

  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
<title>${officeName} - يومية ${diary.diary_number}</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 11px; margin: 0; padding: 10px; }
  .header { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 5px; }
  .sub { text-align: center; color: #666; margin-bottom: 12px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #333; padding: 4px 6px; text-align: right; font-size: 10px; }
  th { background: #f0f0f0; font-weight: bold; }
  .total-row { background: #e8f4e8; font-weight: bold; }
  .summary { margin-top: 12px; text-align: center; border: 2px solid #000; padding: 8px; font-size: 13px; font-weight: bold; }
</style></head><body>
  <div class="header">FIRST - ${officeName}</div>
  <div class="sub">يومية رقم ${diary.diary_number} | ${format(new Date(diary.diary_date), 'dd/MM/yyyy')} | ${diary.is_closed ? 'مقفولة' : 'مفتوحة'} | ${diaryOrders.length} أوردر</div>
  <table>
    <thead><tr>
      <th>#</th><th>الاسم</th><th>ن</th><th>الكود</th><th>السعر</th>
      <th>منفذ</th><th>نزول</th><th>مرتجع</th><th>تسليم جزئي</th>
      <th>فرق شحن</th><th>عمولة التسليم</th><th>رفض دون شحن</th><th>غرامة مرتجع</th>
      <th>الحالة</th><th>حالة المرتجع</th>
    </tr></thead>
    <tbody>${rows}
      <tr class="total-row">
        <td colspan="4">الإجمالي</td>
        <td>${totals.price}</td><td>${totals.executed}</td><td>${totals.postponed}</td>
        <td>${totals.returned}</td><td>${totals.partial}</td><td>${totals.shippingDiff}</td>
        <td>${totals.transferDelivery}</td><td>${totals.refuseNoShipping}</td><td>${totals.returnPenalty}</td>
        <td colspan="2"></td>
      </tr>
    </tbody>
  </table>
  <div class="summary">
    منفذ: ${totals.executed} | نزول: ${totals.postponed} | مرتجع: ${totals.returned} | تسليم جزئي: ${totals.partial}
  </div>
</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 500);
}

export function exportDiaryToExcel(diary: any, diaryOrders: any[], officeName: string) {
  const rows = diaryOrders.map((dOrder: any, idx: number) => {
    const order = dOrder.orders;
    const row = calcRow(dOrder);
    return {
      '#': idx + 1,
      'الاسم': order?.customer_name || '',
      'ن': dOrder.n_column || '',
      'الكود': order?.barcode || order?.customer_code || '',
      'السعر': row.price,
      'منفذ': row.executed || '',
      'نزول': row.postponed || '',
      'مرتجع': row.returned || '',
      'تسليم جزئي': row.partial || '',
      'فرق شحن': row.shippingDiff || '',
      'عمولة التسليم': row.transferDelivery || '',
      'رفض دون شحن': row.refuseNoShipping || '',
      'غرامة مرتجع': row.returnPenalty || '',
      'الحالة': row.status,
      'حالة المرتجع': RETURN_STATUSES.includes(row.status) || row.status === 'تسليم جزئي' ? row.status : '',
    };
  });

  // Add totals row
  const totals = diaryOrders.reduce((acc: any, d: any) => {
    const r = calcRow(d);
    return {
      price: acc.price + r.price, executed: acc.executed + r.executed, postponed: acc.postponed + r.postponed,
      returned: acc.returned + r.returned, partial: acc.partial + r.partial, shippingDiff: acc.shippingDiff + r.shippingDiff,
      transferDelivery: acc.transferDelivery + r.transferDelivery, refuseNoShipping: acc.refuseNoShipping + r.refuseNoShipping,
      returnPenalty: acc.returnPenalty + r.returnPenalty,
    };
  }, { price: 0, executed: 0, postponed: 0, returned: 0, partial: 0, shippingDiff: 0, transferDelivery: 0, refuseNoShipping: 0, returnPenalty: 0 });

  rows.push({
    '#': '' as any,
    'الاسم': 'الإجمالي',
    'ن': '',
    'الكود': '',
    'السعر': totals.price,
    'منفذ': totals.executed,
    'نزول': totals.postponed,
    'مرتجع': totals.returned,
    'تسليم جزئي': totals.partial,
    'فرق شحن': totals.shippingDiff,
    'عمولة التسليم': totals.transferDelivery,
    'رفض دون شحن': totals.refuseNoShipping,
    'غرامة مرتجع': totals.returnPenalty,
    'الحالة': '',
    'حالة المرتجع': '',
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `يومية ${diary.diary_number}`);
  XLSX.writeFile(wb, `${officeName}-يومية-${diary.diary_number}.xlsx`);
}

export function shareDiaryWhatsApp(diary: any, diaryOrders: any[], officeName: string) {
  let text = `📋 *${officeName}* - يومية رقم ${diary.diary_number}\n`;
  text += `📅 ${format(new Date(diary.diary_date), 'dd/MM/yyyy')}\n`;
  text += `📊 حالة: ${diary.is_closed ? 'مقفولة' : 'مفتوحة'} | تجميد: ${diary.lock_status_updates ? 'نعم' : 'لا'}\n`;
  text += `━━━━━━━━━━━━━━━━━━\n\n`;

  const totals = { executed: 0, postponed: 0, returned: 0, partial: 0, price: 0 };

  diaryOrders.forEach((dOrder: any, idx: number) => {
    const order = dOrder.orders;
    const row = calcRow(dOrder);
    text += `${idx + 1}. ${order?.customer_name} | #${order?.barcode || '-'} | ${row.price} | ${row.status}\n`;
    totals.executed += row.executed;
    totals.postponed += row.postponed;
    totals.returned += row.returned;
    totals.partial += row.partial;
    totals.price += row.price;
  });

  text += `\n━━━━━━━━━━━━━━━━━━\n`;
  text += `📊 *الإجمالي* (${diaryOrders.length} أوردر)\n`;
  text += `💰 إجمالي السعر: ${totals.price}\n`;
  text += `✅ منفذ: ${totals.executed}\n`;
  text += `⏳ نزول: ${totals.postponed}\n`;
  text += `🔄 مرتجع: ${totals.returned}\n`;
  text += `📦 تسليم جزئي: ${totals.partial}\n`;

  // Open WhatsApp Web (company - no phone number = share to any chat)
  window.open(`https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
}

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
