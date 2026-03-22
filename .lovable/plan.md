

## المشاكل والحلول

### 1. سعر الشحن الموحد بينزل صفر
**السبب**: في `ExcelImport.tsx` سطر 166، لو عمود الشحن موجود في الملف بس فاضي، القيمة بتترجم لـ `0` وبالتالي `0` falsy فالمفروض يشتغل. لكن المشكلة الحقيقية إن لو المستخدم ما ربطش عمود شحن، القيمة `order.delivery_price` تكون `undefined` والـ globalShipping المفروض يشتغل. هتحقق من الكود كامل، لكن الحل هو التأكد إن globalShipping يتطبق صراحة لو delivery_price مش موجود أو صفر.

**الحل**: تغيير المنطق في `applyMapping` ليستخدم globalShipping بشكل واضح:
```typescript
delivery_price: (order.delivery_price && order.delivery_price > 0) 
  ? order.delivery_price 
  : (globalShipping ? parseFloat(globalShipping) : 0),
```

### 2. الأسعار فوق 1000 بتظهر 1 أو 2
**السبب**: ملفات Excel أحيانا بتخزن الأرقام بفواصل (مثلاً `1,000`). `parseFloat("1,000")` بيرجع `1` لأنه بيقف عند الفاصلة.

**الحل**: في `applyMapping` سطر 151، قبل `parseFloat` نشيل الفواصل:
```typescript
else if (key === 'price' || key === 'delivery_price') {
  const cleaned = String(val).replace(/,/g, '');
  order[key] = parseFloat(cleaned) || 0;
}
```

### 3. اسم المندوب يفضل موجود بعد التقفيل
**السبب**: في `closeSelected` سطر 104، التحديث بيعمل `is_closed: true` بس من غير ما يمسح `courier_id` - ده كويس. لكن صفحة الأوردرات المقفلة `ClosedOrders.tsx` مش بتعرض عمود المندوب أصلاً.

**الحل**: 
- إضافة عمود "المندوب" في جدول الأوردرات المقفلة `ClosedOrders.tsx`
- تحميل بيانات المناديب (profiles) وعرض اسم المندوب

### 4. الأوردر المقفل يختفي من عند المندوب
**الوضع الحالي**: صفحة `CourierOrders.tsx` المفروض بتفلتر على `is_closed = false`. هتتأكد من ده.

---

## الملفات المطلوب تعديلها

| الملف | التعديل |
|---|---|
| `src/pages/ExcelImport.tsx` | إصلاح parseFloat بإزالة الفواصل + إصلاح منطق globalShipping |
| `src/pages/ClosedOrders.tsx` | إضافة عمود المندوب مع تحميل أسماء المناديب |
| `src/pages/CourierOrders.tsx` | التأكد من فلترة `is_closed = false` |

