import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/**
 * ✅ إنشاء PDF لأمر البيع - شركة الرياض
 * (تصميم رصاصي أنيق، بخط منسق، يظهر بشكل احترافي للطباعة)
 */
export default async function generateOrderPDF_RYD(order) {
  if (!order) {
    alert("❌ لا توجد بيانات للطلب");
    return;
  }

  // 🔹 تنسيق الأرقام
  const fmt = (n) =>
    (Number(n) || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // 🔹 حساب المجاميع
  let المجموع_الفرعي = 0;
  (order.DocumentLines || []).forEach((r) => {
    const qty = Number(r.Quantity) || 0;
    const price = Number(r.UnitPrice) || 0;
    const disc = Number(r.DiscountPercent) || 0;
    المجموع_الفرعي += qty * price * (1 - disc / 100);
  });

  const قيمة_الخصم = ((order.DiscountPercent || 0) / 100) * المجموع_الفرعي;
  const الاجمالي_الكلي = المجموع_الفرعي - قيمة_الخصم;

  // 🔹 التاريخ الحالي
  const now = new Date();
  const formattedNow = now.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // 🔹 منطقة الطباعة
  const container = document.createElement("div");
  container.id = "order-print-area";
  container.style.width = "210mm";
  container.style.minHeight = "297mm";
  container.style.padding = "12mm 15mm 55mm";
  container.style.background = "#fff";
  container.style.fontFamily = "'Cairo', 'Tahoma', sans-serif";
  container.style.direction = "rtl";
  container.style.textAlign = "center";
  container.style.position = "relative";

  container.innerHTML = `
    <!-- 🩶 الهيدر -->
    <div style="text-align:center; margin-bottom:8px;">
      <img src="/HeaderAlRiyad.png" 
           style="width:100%; max-height:110px; object-fit:contain; border-radius:8px;" />
    </div>

    <!-- 🩶 عنوان الوثيقة -->
    <div style="
      text-align:center; 
      font-size:20px; 
      font-weight:700; 
      color:#333; 
      border-top:2px solid #666; 
      border-bottom:2px solid #666; 
      padding:8px 0; 
      margin:12px 0;
      letter-spacing:0.5px;
      text-transform:uppercase;
    ">
      <span style="display:inline-block;">Sales Order</span>
    </div>

    <!-- 🔹 معلومات الزبون -->
    <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:14px; color:#222;">
      <tr>
        <td style="padding:5px;">رقم العميل:</td>
        <td style="padding:5px;">${order.CardCode || "—"}</td>
        <td style="padding:5px;">رقم الطلب:</td>
        <td style="padding:5px;">${order.DocNum || "—"}</td>
      </tr>
      <tr>
        <td style="padding:5px;">اسم العميل:</td>
        <td style="padding:5px;">${order.CardName || "—"}</td>
        <td style="padding:5px;">تاريخ الطلب:</td>
        <td style="padding:5px;">
  ${
    order.DocDate
      ? (() => {
          const d = new Date(order.DocDate.split("T")[0]);
          const months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
          ];
          const day = String(d.getDate()).padStart(2, "0");
          const month = months[d.getMonth()];
          const year = d.getFullYear();
          return `${year}_${month}_${day}`;
        })()
      : (() => {
          const d = new Date();
          const months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
          ];
          const day = String(d.getDate()).padStart(2, "0");
          const month = months[d.getMonth()];
          const year = d.getFullYear();
          return `${year}_${month}_${day}`;
        })()
  }
</td>
      </tr>
      <tr>
        <td style="padding:5px;">رقم الهاتف:</td>
        <td style="padding:5px;">${order.Phone1 || "—"}</td>
        <td style="padding:5px;">المندوب:</td>
        <td style="padding:5px;">${order.SalesPersonName || "—"}</td>
      </tr>
      <tr>
        <td style="padding:5px;">طريقة الدفع:</td>
        <td style="padding:5px;">${order.PaymentMethod || "نقداً"}</td>
        <td style="padding:5px;">المنطقة:</td>
        <td style="padding:5px;">${order.TerritoryName || order.Territory || "—"}</td>
      </tr>
    </table>

    <!-- 🔹 جدول المواد -->
    <table style="width:100%; border-collapse:collapse; font-size:11px;">
      <thead style="background:#333; color:#fff;">
        <tr>
          <th style="padding:6px; border:1px solid #444;">#</th>
          <th style="padding:6px; border:1px solid #444;">رمز المادة</th>
          <th style="padding:6px; border:1px solid #444;">اسم المادة</th>
          <th style="padding:6px; border:1px solid #444;">المخزن</th>
          <th style="padding:6px; border:1px solid #444;">الكمية</th>
          <th style="padding:6px; border:1px solid #444;">السعر المفرد</th>
          <th style="padding:6px; border:1px solid #444;">الخصم %</th>
          <th style="padding:6px; border:1px solid #444;">الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${
          order.DocumentLines?.map(
            (r, i) => `
          <tr style="border:1px solid #ddd; color:#111;">
            <td style="padding:6px; text-align:center;">${i + 1}</td>
            <td style="padding:6px; text-align:center;">${r.ItemCode || ""}</td>
            <td style="padding:6px; text-align:center;">${r.ItemDescription || r.ItemName || ""}</td>
            <td style="padding:6px; text-align:center;">${r.WarehouseCode || "—"}</td>
            <td style="padding:6px; text-align:center;">${fmt(r.Quantity)}</td>
            <td style="padding:6px; text-align:center;">${fmt(r.UnitPrice)}</td>
            <td style="padding:6px; text-align:center;">${r.DiscountPercent || 0}%</td>
            <td style="padding:6px; text-align:center;">
              ${fmt((r.Quantity || 0) * (r.UnitPrice || 0) * (1 - (r.DiscountPercent || 0) / 100))} 
              ${order.DocCurrency || "IQD"}
            </td>
          </tr>`
          ).join("") ||
          `<tr><td colspan="8" style="padding:10px; text-align:center; color:#888;">لا توجد مواد</td></tr>`
        }
      </tbody>
    </table>

    <!-- 📝 الملاحظات -->
    ${
      order.Comments
        ? `
        <div style="margin-top:14px; text-align:right; font-size:12px; color:#222;">
          <b>ملاحظات:</b> ${order.Comments}
        </div>
        `
        : ""
    }

    <!-- 🔹 المجاميع -->
    <div style="margin-top:22px; display:flex; justify-content:flex-end;">
      <table style="font-size:12px; border-collapse:collapse; border:1px solid #666; text-align:center; min-width:200px; color:#111;">
        <tr>
          <td style="border:1px solid #666; padding:6px;">المجموع الفرعي</td>
          <td style="border:1px solid #666; padding:6px;">${fmt(المجموع_الفرعي)} ${order.DocCurrency || "IQD"}</td>
        </tr>
        <tr>
          <td style="border:1px solid #666; padding:6px;">الخصم</td>
          <td style="border:1px solid #666; padding:6px;">${fmt(قيمة_الخصم)} ${order.DocCurrency || "IQD"}</td>
        </tr>
        <tr>
          <td style="border:1px solid #666; padding:6px; background:#f3f3f3; font-weight:bold;">الإجمالي الكلي</td>
          <td style="border:1px solid #666; padding:6px; background:#f3f3f3; font-weight:bold;">${fmt(الاجمالي_الكلي)} ${order.DocCurrency || "IQD"}</td>
        </tr>
      </table>
    </div>

    <!-- 🩶 الفوتر -->
    <div style="
      position:absolute;
      bottom:0;
      left:0;
      width:100%;
      text-align:center;
      background:white;
      padding-top:6px;
    ">
      <img src="/FooterAlRiyad.png"
           style="width:105%; max-height:230px; object-fit:contain;
           transform:translateX(-2%);
           filter:contrast(1.05) brightness(1.02);
           border-radius:8px;" />

      <div style="
        font-size:10px; 
        color:#333; 
        margin-top:4px; 
        display:flex; 
        justify-content:space-between; 
        padding:0 12mm;
      ">
        <span>Created by: <b>${order.CreatedBy || "—"}</b></span>
        <span>Printed: ${formattedNow}</span>
      </div>
    </div>
  `;

  // 🔹 توليد PDF
  document.body.appendChild(container);
  const canvas = await html2canvas(container, { scale: 2, useCORS: true });
  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF("p", "mm", "a4");
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
  pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
  pdf.save(`Sales_Order_${order.DocNum || "Riyad"}.pdf`);

  document.body.removeChild(container);
}