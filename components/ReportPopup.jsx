"use client";

import { useState, useEffect, Fragment, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiX,
  FiEdit,
  FiTrash2,
  FiSave,
  FiSlash,
  FiBox,
  FiDollarSign,
  FiPercent,
  FiCreditCard,
  FiSearch,
  FiPlus,
  FiFileText,
  FiLoader
} from "react-icons/fi";
import { Listbox, Transition } from "@headlessui/react";
import toast from "react-hot-toast";
import generateOrderPDF_RYD from "@/app/utils/generateOrderPDF_RYD";
const IMG_FALLBACK = "http://172.30.30.237:9086/12007777.jpg";

export default function ReportPopup({ order, onClose, onCanceled, onUpdated }) {
  // نحتفظ بنسخة محلية من الأوردر لكي نقدر نحدّثها فورًا بعد الحفظ بدون ريفرش
  const [currentOrder, setCurrentOrder] = useState(order || null);

  const [editMode, setEditMode] = useState(false);
  const [draftLines, setDraftLines] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [canceling, setCanceling] = useState(false);
  const [isCanceled, setIsCanceled] = useState(false);
  const [saving, setSaving] = useState(false);

  // إضافة مادة (بحث + مخزن + كمية + خصم)
  const [addQuery, setAddQuery] = useState("");
  const [addSuggestions, setAddSuggestions] = useState([]);
  const [addSelectedItem, setAddSelectedItem] = useState(null);
  const [addWhs, setAddWhs] = useState("");
  const [addQty, setAddQty] = useState("");
  const [addDisc, setAddDisc] = useState("");
  const [discFromSAP, setDiscFromSAP] = useState(false);
  const fmt = (n) =>
  (Number(n) || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
    // 🔹 توليد PDF من الطلب الحالي
    const handleOpenPDF = () => {
      if (!currentOrder) return;
      const snapshot = {
        doc: currentOrder,
        customer: {
          CardCode: currentOrder.CardCode,
          CardName: currentOrder.CardName,
          Phone1: currentOrder.Phone1,
        },
        lines: currentOrder.DocumentLines || [],
      };
      const html = buildRYDPrintHTML(snapshot);
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    };

  // نحول DocumentLines المسترجعة من SAP إلى draftLines
  // ونخفي أي سطر LineStatus === "C"
  const mapDocToDraft = (doc) => {
    const docLines = (doc?.DocumentLines || []).filter(
      (r) => (r.LineStatus || "O") !== "C"
    );
  
    return docLines.map((r) => {
      const qty = Number(r.Quantity) || 0;
      const price = Number(r.UnitPrice) || 0;
      const disc = Number(r.DiscountPercent) || 0;
      const lineTotal = +(qty * price * (1 - disc / 100)).toFixed(3);
      
  
      // 🔹 نعرف إذا الخصم كان من SAP
   // ✅ نتحقق إذا FreeText يحتوي على DG:XX (الخصم الأصلي من SAP)
const dgMatch = /^DG:(\d+(?:\.\d+)?)$/i.exec(r.FreeText || "");
const dgValue = dgMatch ? Number(dgMatch[1]) : 0;

// 🔹 نعرف إذا الخصم كان من SAP
const fromSAP =
  dgValue > 0 ||
  r.U_SAPDiscount === true ||
  r.FromSAP === true ||
  r.SAPSource === "Y" ||
  (r.originalSAPDiscount > 0 && disc <= r.originalSAPDiscount);

// 🔹 نحتفظ بالخصم الأصلي للرجوع له لاحقًا
const originalDisc = fromSAP
  ? dgValue ||
    Number(r.U_originalSAPDiscount) ||
    r.originalSAPDiscount ||
    disc
  : 0;
  
      return {
        LineNum: typeof r.LineNum === "number" ? r.LineNum : null,
        ItemCode: r.ItemCode,
        ItemDescription: r.ItemDescription || r.ItemName || "",
        WarehouseCode: r.WarehouseCode,
        Quantity: qty,
        UnitPrice: price,
        DiscountPercent: disc,
        isSAPDiscount: fromSAP,
        originalSAPDiscount: originalDisc,
        lockedDiscount: fromSAP,
        LineTotal: lineTotal,
        Currency: r.Currency || doc?.DocCurrency || "IQD",
      };
    });
  };

  // تحديث currentOrder عند تغيّر prop order
  useEffect(() => {
    if (order) {
      setCurrentOrder(order);
    }
  }, [order]);

  // إعداد الحالة عند تغيّر currentOrder
  useEffect(() => {
    if (currentOrder?.DocumentLines) {
      setDraftLines(mapDocToDraft(currentOrder));
      setIsCanceled(
        currentOrder?.Status === "Canceled" ||
          currentOrder?.CANCELED === "Y" ||
          currentOrder?.DocumentStatus === "C"
      );
      setEditMode(false);
    }
  }, [currentOrder]);

  // جلب كل المواد (للبحث/الصور)
  useEffect(() => {
    fetch("/api/items")
      .then((r) => r.json())
      .then((data) => setAllItems(Array.isArray(data) ? data : []))
      .catch(() => toast.error("❌ Failed to load items"));
  }, []);

  // اقتراحات البحث
  useEffect(() => {
    const s = addQuery.trim().toLowerCase();
    if (!s) return setAddSuggestions([]);
  
    const results = allItems.filter(
      (i) =>
        i.ItemCode?.toLowerCase().includes(s) ||
        i.ItemName?.toLowerCase().includes(s) ||
        i.U_ST_Model?.toLowerCase().includes(s) ||
        i.U_ST_PartNo?.toLowerCase().includes(s) ||
        i.SWW?.toLowerCase().includes(s)
    );
  
    setAddSuggestions(results.slice(0, 12));
  }, [addQuery, allItems]);

  const findImage = (itemCode) => {
    const hit =
      allItems.find((i) => i.ItemCode === itemCode)?.ImageURL ||
      allItems.find((i) => i.ItemCode === itemCode)?.image;
    return hit || `http://172.30.30.237:9086/${itemCode}.jpg`;
  };

  // تحديث صف محرّر مع دقة أعلى للإجمالي
  const updateDraftRow = (idx, field, value) => {
    setDraftLines((prev) => {
      const next = [...prev];
      const row = { ...next[idx] };
      const newVal =
        field === "WarehouseCode" ? value : Number(value ?? row[field] ?? 0);
      row[field] = newVal;
      const qty = Number(row.Quantity) || 0;
      const price = Number(row.UnitPrice) || 0;
      const disc = Number(row.DiscountPercent) || 0;
      row.LineTotal = +(qty * price * (1 - disc / 100)).toFixed(3);
      next[idx] = row;
      return next;
    });
  };

  const removeDraftRow = (idx) =>
  setDraftLines((prev) => prev.filter((_, i) => i !== idx));

  const startEdit = () => setEditMode(true);

  const cancelEdit = () => {
    // ارجع إلى حالة SAP الفعلية
    if (currentOrder?.DocumentLines) {
      setDraftLines(mapDocToDraft(currentOrder));
    }
    setEditMode(false);
  };
// ✅ دالة جديدة لتحميل الـ PDF بعد جلب بيانات الهيدر
const handleGeneratePDF = async () => {
  try {
    // 📦 جلب بيانات الهيدر الكاملة من HANA
    const res = await fetch(`/api/order-header?docEntry=${currentOrder.DocEntry}`);
    const header = await res.json();

    if (!res.ok) throw new Error("فشل تحميل بيانات الهيدر");

    // 🧩 دمج بيانات الهيدر مع الأوردر الحالي
    const mergedOrder = { ...currentOrder, ...header };

    // 🧾 توليد PDF
    await generateOrderPDF_RYD(mergedOrder);
  } catch (err) {
    console.error("❌ Failed to load header info:", err);
    toast.error("فشل تحميل معلومات الهيدر من SAP HANA");
  }
};
  // اختيار مادة من البحث
  const handleSelectItem = async (item) => {
    try {
      setAddSelectedItem({
        code: item.ItemCode,
        name: item.ItemName,
        price: Number(item.Price) || 0,
        currency: "IQD",
        image: item.image || item.ImageURL || IMG_FALLBACK,
        warehouses: [],
      });
      setAddQuery(`${item.ItemCode} — ${item.ItemName}`);
      setDiscFromSAP(0);      setAddDisc("");
  
      // 🟢 نحدد العملة الحالية من الأوردر أو السطر الحالي
      const currentCurrency =
        currentOrder?.DocCurrency ||
        draftLines?.[0]?.Currency ||
        "IQD";
  
      // 🟢 جلب السعر والمخازن من الـ API حسب العملة
      const res = await fetch(
        `/api/item-price?itemCode=${item.ItemCode}&currency=${currentCurrency}`
      );
      const data = await res.json();
  
      if (!res.ok || !data?.data?.length) {
        toast.error("⚠️ لم يتم العثور على سعر للمادة");
        return;
      }
  
      // 🔹 تجهيز بيانات المخازن (تبقى كما هي)
      const warehouses = Array.isArray(data.data)
        ? data.data.map((w) => ({
            code: w.WhsCode || w.whsname?.split("|")[2]?.trim() || "",
            name: w.WhsName || w.whsname?.split("|")[1]?.trim() || "",
            available: Number(w.Available) || 0,
            price: Number(w.Price) || 0,
          }))
        : [];
  
      // 🔹 نختار السعر من أول مخزن فيه سعر > 0
      let finalPrice = Number(item.Price) || 0;
      if (!finalPrice) {
        const firstWithPrice = warehouses.find((w) => w.price > 0);
        if (firstWithPrice) finalPrice = firstWithPrice.price;
      }
  
      // ✅ تحديث العنصر المختار بكل القيم الجديدة
      setAddSelectedItem((prev) => ({
        ...prev,
        warehouses,
        price: finalPrice || 0,
        currency: currentCurrency,
      }));
  
      // 🔹 جلب خصم المادة من SAP (إن وجد)
      try {
        const dRes = await fetch(`/api/discount?itemCode=${item.ItemCode}`);
        const dData = await dRes.json();
        if (dRes.ok && Number(dData.discount) > 0) {
          setAddDisc(String(dData.discount)); // نخزن الخصم كقيمة في الانبت
          setDiscFromSAP(Number(dData.discount)); // نخزن رقم الخصم (مو مجرد true)
          toast.success(`خصم المادة: ${dData.discount}%`);
        } else {
          setAddDisc("");
          setDiscFromSAP(0);        }
      } catch {
        console.warn("⚠️ فشل جلب خصم SAP");
      }
  
      toast.success(`✅ تم تحميل السعر بعملة ${currentCurrency}`);
    } catch (err) {
      console.error("❌ Failed to load item data:", err);
      toast.error("حدث خطأ أثناء تحميل بيانات المادة أو المخازن");
    }
  };
  // إضافة سطر جديد للسلة (للطلب الحالي)
  const addToDraftLines = () => {
    if (!addSelectedItem) return toast.error("اختر المادة أولاً");
    if (!addWhs) return toast.error("اختر المخزن");
    if (!addQty) return toast.error("أدخل الكمية");

    const qty = Number(addQty);
    const disc = Number(addDisc) || 0;
    const price = Number(addSelectedItem.price || 0);
    if (price <= 0) return toast.error("⚠️ لا يمكن إضافة مادة بدون سعر");

    const whObj = addSelectedItem.warehouses.find((w) => w.code === addWhs);
    if (!whObj) return toast.error("المخزن المحدد غير صالح");

    if (qty > Number(whObj.available || 0)) {
      return toast.error(
        `⚠️ الكمية المطلوبة (${qty}) تتجاوز المتاحة (${whObj.available}) في المخزن ${whObj.name}`
      );
    }

    const lineTotal = +((qty * price) * (1 - disc / 100)).toFixed(3);
    
// ✅ نحدد العملة حسب الأوردر الحالي (نفس فكرة صفحة المبيعات)
const existingCurrency =
  currentOrder?.DocCurrency ||
  (draftLines.length > 0 ? draftLines[0].Currency : addSelectedItem.currency || "IQD");

  const newRow = {
    LineNum: null,
    ItemCode: addSelectedItem.code,
    ItemDescription: addSelectedItem.name,
    WarehouseCode: addWhs,
    Quantity: qty,
    UnitPrice: price,
    DiscountPercent: disc,
    isSAPDiscount: discFromSAP > 0,
    originalSAPDiscount: discFromSAP > 0 ? discFromSAP : 0,
    LineTotal: lineTotal,
    Currency: existingCurrency,
    lockedDiscount: discFromSAP > 0, // 👈 نضيف علامة القفل للخصم القادم من SAP
  };
  let message = "";

  setDraftLines((prev) => {
    const existingIndex = prev.findIndex(
      (r) =>
        r.ItemCode === newRow.ItemCode &&
        r.WarehouseCode === newRow.WarehouseCode
    );
  
    let updated = [...prev];
  
    if (existingIndex !== -1) {
      const existing = { ...updated[existingIndex] };
      const newQty = existing.Quantity + newRow.Quantity;
      const newTotal = +(
        newQty * existing.UnitPrice * (1 - existing.DiscountPercent / 100)
      ).toFixed(3);
  
      updated[existingIndex] = {
        ...existing,
        Quantity: newQty,
        LineTotal: newTotal,
      };
  
      message = "🔁 تم تحديث الكمية في نفس المخزن";
    } else {
      updated = [newRow, ...prev];
      message = "✅ تمت إضافة المادة";
    }
  
    return updated;
  });
  
  // ✅ نعرض التوست بعد اكتمال تحديث الحالة
  toast.success(message);
    // تنظيف حقول الإضافة
    setAddSelectedItem(null);
    setAddQuery("");
    setAddWhs("");
    setAddQty("");
    setAddDisc("");
setDiscFromSAP(0);  };

  // المجاميع
  const totalsByCurrency = useMemo(() => {
    return draftLines.reduce((acc, line) => {
      const cur = line.Currency || currentOrder?.DocCurrency || "IQD";
      if (!acc[cur]) {
        acc[cur] = { qty: 0, beforeDisc: 0, discount: 0, total: 0 };
      }
      const qty = Number(line.Quantity) || 0;
      const price = Number(line.UnitPrice) || 0;
      const disc = Number(line.DiscountPercent) || 0;

      acc[cur].qty += qty;
      acc[cur].beforeDisc += qty * price;
      acc[cur].discount += (qty * price * disc) / 100;
      acc[cur].total += Number(line.LineTotal) || 0;

      return acc;
    }, {});
  }, [draftLines, currentOrder?.DocCurrency]);

  const isOrderClosed =
    isCanceled ||
    currentOrder?.Status === "Closed" ||
    currentOrder?.Status === "Canceled" ||
    currentOrder?.CANCELED === "Y" ||
    currentOrder?.DocumentStatus === "C";
// 💾 حفظ التعديلات (يشمل إنشاء أوردر جديد + إلغاء القديم تلقائيًا)
const saveChanges = async () => {
  if (!currentOrder?.DocEntry) return;
  setSaving(true);
  try {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user?.sapUser || !user?.sapPass) {
      toast.error("بيانات دخول SAP غير موجودة");
      setSaving(false);
      return;
    }

    // نرسل فقط الأسطر المتبقية بعد الحذف
    const payload = {
      docEntry: currentOrder.DocEntry,
      sapUser: user.sapUser,
      sapPass: user.sapPass,
      updatedLines: draftLines.map((r) => ({
        LineNum: typeof r.LineNum === "number" ? r.LineNum : null,
        ItemCode: r.ItemCode,
        Quantity: Number(r.Quantity) || 0,
        UnitPrice: Number(r.UnitPrice) || 0,
        DiscountPercent: Number(r.DiscountPercent) || 0,
        WarehouseCode: r.WarehouseCode,
        isSAPDiscount: !!r.isSAPDiscount,
        originalSAPDiscount: r.isSAPDiscount ? r.originalSAPDiscount : 0,
        FreeText: r.isSAPDiscount
        ? `DG:${r.originalSAPDiscount ?? r.DiscountPercent ?? 0}`
        : "",
      })),
    };
// // نحافظ على حالة القفل للخصم
// setDraftLines((prev) =>
//   prev.map((r) => ({
//     ...r,
//     lockedDiscount: r.isSAPDiscount || r.lockedDiscount, // 👈 نحتفظ بالقفل بعد الحفظ
//   }))
// );
    const res = await fetch("/api/update-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "SAP update failed");

    // ✅ إلغاء الأوردر القديم مباشرة بعد نجاح الإنشاء الجديد
    try {
      await fetch("/api/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docEntry: currentOrder.DocEntry,
          sapUser: user.sapUser,
          sapPass: user.sapPass,
        }),
      });
    } catch (err) {
      console.warn("⚠️ فشل إلغاء الأوردر القديم:", err.message);
    }

    // ✅ نحدث الصفحة ونغلق البوب أب
    if (onUpdated) onUpdated();
    onClose();
  } catch (err) {
    console.error(err);
    toast.error(`❌ فشل الحفظ: ${err.message}`);
  } finally {
    setSaving(false);
  }
};

  // إلغاء طلب
  const handleCancelOrder = async () => {
    const confirmCancel = confirm("Are you sure you want to cancel this order?");
    if (!confirmCancel) return;

    setCanceling(true);
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      const res = await fetch("/api/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docEntry: currentOrder.DocEntry,
          sapUser: user.sapUser,
          sapPass: user.sapPass,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to cancel order");

      toast.success("✅ Order canceled successfully");
      setIsCanceled(true);

      if (onCanceled) onCanceled(currentOrder.DocEntry);

      setTimeout(() => onClose(), 700);
    } catch (err) {
      console.error(err);
      toast.error("❌ Failed to cancel order");
    } finally {
      setCanceling(false);
    }
  };

  // مفتاح فريد لكل صف (يعالج تحذير React)
  const getRowKey = (r, i) =>
    `${r.ItemCode}-${r.LineNum ?? "new"}-${r.WarehouseCode}-${i}`;

  return (
    <AnimatePresence>
      {currentOrder && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.92 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.92 }}
            transition={{ duration: 0.25 }}
            className="bg-white rounded-2xl shadow-2xl p-9 w-full max-w-6xl max-h-[90vh] overflow-y-auto relative"
          >
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 text-gray-500 hover:text-red-600"
            >
              <FiX size={22} />
            </button>

            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-800">
                Sales Order #{currentOrder.DocNum}
              </h2>
              

              {!editMode ? (
                <div className="flex gap-2">
                  <button
                    onClick={startEdit}
                    disabled={isOrderClosed}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl ${
                      isOrderClosed
                        ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                        : "bg-gray-100 hover:bg-gray-200"
                    }`}
                  >
                    <FiEdit /> Edit
                    
                  </button>
                 
<button
  onClick={handleGeneratePDF}
  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-700 hover:bg-gray-800 text-white transition-colors">
  <FiFileText className="text-lg" />
   PDF
</button>   <button
                    onClick={handleCancelOrder}
                    disabled={canceling || isOrderClosed}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white transition ${
                      canceling || isOrderClosed
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    <FiSlash />
                    {isOrderClosed
                      ? "Canceled/Closed"
                      : canceling
                      ? "Canceling..."
                      : "Cancel Order"}
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={saveChanges}
                    disabled={saving}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white ${
                      saving ? "bg-green-400" : "bg-green-600 hover:bg-green-700"
                    }`}
                  >
                    {saving ? <FiLoader className="animate-spin" /> : <FiSave />}
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-200 rounded-xl hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  
                </div>
              )}
            </div>

            {/* إضافة مادة */}
            {editMode && (
              <div className="mb-5 border border-dashed border-gray-300 rounded-xl p-4 bg-gray-50">
                <h3 className="font-semibold mb-3 text-gray-800 flex items-center gap-2">
                  <FiPlus /> Add Item
                </h3>

                {/* 🔎 البحث */}
                <div className="relative mb-3">
                  <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-xl px-3 py-2 shadow-sm">
                    <FiSearch />
                    <input
                      value={addQuery}
                      onChange={(e) => {
                        setAddQuery(e.target.value);
                        setAddSelectedItem(null);
                        setAddWhs("");
                        setAddQty("");
                        setAddDisc("");
                        setDiscFromSAP(0);                      }}
                      placeholder="Search by item name / code..."
                      className="w-full bg-transparent outline-none text-gray-800"
                    />
                    {addQuery && (
                      <button
                        onClick={() => {
                          setAddQuery("");
                          setAddSuggestions([]);
                          setAddSelectedItem(null);
                          setAddWhs("");
                          setAddQty("");
                          setAddDisc("");
                          setDiscFromSAP(0);                        }}
                        className="text-gray-500 hover:text-gray-700"
                        title="Clear"
                      >
                        <FiX />
                      </button>
                    )}
                  </div>
                  <AnimatePresence>
  {addSuggestions.length > 0 && !addSelectedItem && (
    <motion.ul
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="absolute z-10 mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-gray-100"
    >
      {addSuggestions.map((it) => (
        <li key={it.ItemCode}>
          <button
            onClick={() => handleSelectItem(it)}
            className="flex items-center gap-3 px-3 py-2 w-full text-left hover:bg-blue-50 transition-colors duration-150"
          >
            {/* 🔹 صورة المادة */}
            <img
              src={it.image || it.ImageURL}
              onError={(e) => (e.target.src = IMG_FALLBACK)}
              className="w-10 h-10 rounded-md border border-gray-300 object-cover shadow-sm"
              alt={it.ItemName}
            />

            {/* 🔹 التفاصيل */}
            <div className="flex flex-col overflow-hidden text-sm flex-1">
              <div className="font-semibold text-gray-800 truncate">
                {it.ItemName}
              </div>
              <div className="text-gray-500 text-xs truncate">
                {it.ItemCode}
              </div>

              {/* 🔸 Model / Part / SWW */}
              <div className="flex flex-wrap gap-x-2 gap-y-1 mt-1 text-[11px]">
                {it.U_ST_Model && (
                  <span className="flex items-center gap-1 bg-blue-50 border border-blue-100 text-blue-700 rounded-md px-2 py-[2px]">
                    <FiBox className="text-blue-500 text-[12px]" />
                    <b>Model:</b> {it.U_ST_Model}
                  </span>
                )}
                {it.U_ST_PartNo && (
                  <span className="flex items-center gap-1 bg-green-50 border border-green-100 text-green-700 rounded-md px-2 py-[2px]">
                    <FiFileText className="text-green-500 text-[12px]" />
                    <b>Part No:</b> {it.U_ST_PartNo}
                  </span>
                )}
                {it.SWW && (
                  <span className="flex items-center gap-1 bg-yellow-50 border border-yellow-100 text-yellow-700 rounded-md px-2 py-[2px]">
                    <FiSearch className="text-yellow-500 text-[12px]" />
                    <b>SWW:</b> {it.SWW}
                  </span>
                )}
              </div>
            </div>
          </button>
        </li>
      ))}
    </motion.ul>
  )}
</AnimatePresence>
                </div>

                {/* مخزن + كمية + خصم + إضافة */}
                {addSelectedItem && (
                  <div className="grid sm:grid-cols-5 gap-3">
                    {/* مخازن */}
                    <Listbox value={addWhs} onChange={setAddWhs}>
                      <div className="relative">
                        <Listbox.Button className="w-full border border-gray-400 rounded-xl px-4 py-2 bg-white text-sm text-right shadow-sm">
                          {addWhs
                            ? addSelectedItem.warehouses.find(
                                (w) => w.code === addWhs
                              )?.name
                            : "Select Warehouse"}
                        </Listbox.Button>
                        <Transition
                          as={Fragment}
                          leave="transition ease-in duration-100"
                          leaveFrom="opacity-100"
                          leaveTo="opacity-0"
                        >
                          <Listbox.Options className="absolute left-0 mt-2 w-[580px] bg-white border border-gray-400 rounded-xl shadow-2xl max-h-[220px] overflow-y-auto text-sm z-50">
                            {/* Header */}
                            <div className="grid grid-cols-4 text-center font-semibold">
                              <div className="border py-1 bg-gray-100">
                                Warehouse
                              </div>
                              <div className="border py-1 bg-gray-100">
                                Code
                              </div>
                              <div className="border py-1 bg-gray-100">
                                Avail.
                              </div>
                              <div className="border py-1 bg-gray-100">
                                Price
                              </div>
                            </div>
                            {addSelectedItem.warehouses.map((w) => (
                              <Listbox.Option
                                key={w.code}
                                value={w.code}
                                className={({ active }) =>
                                  `grid grid-cols-4 text-center ${
                                    active ? "bg-gray-100" : "bg-white"
                                  }`
                                }
                              >
                                <div className="border py-1 px-2 truncate">
                                  {w.name}
                                </div>
                                <div className="border py-1 px-2">{w.code}</div>
                                <div className="border py-1 px-2 text-green-700 font-semibold">
                                  {w.available}
                                </div>
                                <div className="border py-1 px-2">
                                  {fmt(w.price)} {addSelectedItem?.currency || "IQD"}
                                </div>
                              </Listbox.Option>
                            ))}
                          </Listbox.Options>
                        </Transition>
                      </div>
                    </Listbox>

                    <input
                      type="number"
                      min={1}
                      value={addQty}
                      onChange={(e) => setAddQty(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-2 py-2 text-right"
                      placeholder="Qty"
                    />

                    <div className="relative">
                    <input
  type="text"
  inputMode="decimal"
  value={addDisc === "0" || addDisc === 0 ? "" : addDisc}
  onChange={(e) => {
    const val = e.target.value.trim();

    // إذا الحقل فارغ نخليه فارغ (بدون 0)
    if (val === "") {
      setAddDisc("");
      return;
    }

    const num = Number(val);
    if (isNaN(num)) return;

    // 🔒 إذا الخصم من SAP لا يسمح بزيادته عن القيمة الأصلية
    if (Number(discFromSAP) > 0 && num > Number(discFromSAP)) {
      toast.error(`⚠️ لا يمكن تجاوز خصم SAP (${discFromSAP}%)`);
      return;
    }

    setAddDisc(val);
  }}
  className={`w-full border rounded-xl px-2 py-2 text-right ${
    discFromSAP
      ? "bg-gray-100 text-gray-500 border-gray-400 cursor-default select-none"
      : "bg-white border-gray-300 focus:border-[#2f3a47]"
  }`}
  placeholder="Discount %"
/>
                      {Number(addDisc) > 0 && (
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold">
                          %
                        </span>
                      )}
                    </div>

                    <div className="col-span-2 flex items-center gap-2">
                      <div className="px-3 rounded-xl border bg-gray-50 text-sm text-gray-700">
                        Price: {fmt(addSelectedItem.price)} {addSelectedItem.currency}
                      </div>
                      <button
                        onClick={addToDraftLines}
                        className="flex-1 flex items-center justify-center gap-2 bg-[#2f3a47] text-white rounded-xl px-4 py-2 hover:bg-[#1e2832] transition"
                      >
                        <FiPlus /> Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* الجدول */}
            <div className="overflow-x-auto rounded-xl border border-gray-300 shadow-inner max-h-[60vh]">
              <table className="min-w-full text-sm">
                <thead className="bg-[#2f3a47] text-white text-left uppercase">
                  <tr>
                    <th className="p-3">Image</th>
                    <th className="p-3">Code</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Warehouse</th>
                    <th className="p-3 text-right">Qty</th>
                    <th className="p-3 text-right">Price</th>
                    <th className="p-3 text-right">Disc%</th>
                    <th className="p-3 text-right">Total</th>
                    {editMode && <th className="p-3 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {draftLines.map((r, i) => (
                    <motion.tr
                      key={getRowKey(r, i)}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border-b border-gray-200 hover:bg-gray-50 transition"
                    >
                      <td className="p-3">
                        <img
                          src={findImage(r.ItemCode)}
                          onError={(e) => (e.target.src = IMG_FALLBACK)}
                          className="w-12 h-12 rounded-md border border-gray-300 object-cover"
                          alt={r.ItemDescription}
                        />
                      </td>
                      <td className="p-3 font-medium text-gray-800">
                        {r.ItemCode}
                      </td>
                      <td className="p-3">{r.ItemDescription}</td>
                      <td className="p-3">{r.WarehouseCode}</td>

                      {/* Qty */}
                      <td className="p-3 text-right">
                        {editMode ? (
                          <input
                            type="number"
                            min={0}
                            value={r.Quantity}
                            onChange={(e) =>
                              updateDraftRow(i, "Quantity", e.target.value)
                            }
                            className="w-20 border border-gray-300 rounded-md px-2 py-1 text-right"
                          />
                        ) : (
                          fmt(r.Quantity)
                        )}
                      </td>

                      {/* Price */}
                      <td className="p-3 text-right">
  {editMode ? (
    <input
      type="number"
      step="0.01"
      value={r.UnitPrice}
      readOnly // 🔒 يمنع التعديل
      disabled // 🔒 يمنع الكتابة نهائيًا
      className="w-24 border rounded-md px-2 py-1 text-right bg-yellow-50 text-yellow-800 font-semibold border-yellow-300 cursor-not-allowed"
      title="السعر غير قابل للتعديل"
    />
  ) : (
    <>
      {fmt(r.UnitPrice)} {r.Currency || currentOrder?.DocCurrency || "IQD"}
    </>
  )}
</td>
{/* Discount */}{/* Discount */}
<td className="p-3 text-right">
  {editMode ? ( 
    <div className="relative">
 <input
  type="number"
  inputMode="decimal"
  value={r.DiscountPercent === 0 ? "" : r.DiscountPercent}
  onChange={(e) => {
    const val = e.target.value.trim();
    if (val === "") {
      updateDraftRow(i, "DiscountPercent", 0);
      return;
    }

    const num = Number(val);
    if (isNaN(num)) return;

    // ✅ من SAP: لا يمكن الزيادة عن الأصل، لكن يمكن الرجوع له
    if (r.isSAPDiscount) {
      const max = Number(r.originalSAPDiscount) || 0;
      if (num > max) {
        toast.error(`⚠️ لا يمكن تجاوز خصم SAP (${max}%)`);
        updateDraftRow(i, "DiscountPercent", max);
        return;
      }
    }

    updateDraftRow(i, "DiscountPercent", num);
  }}
  className={`w-full border rounded-xl px-2 py-2 text-right transition
    ${
      r.isSAPDiscount
        ? "bg-yellow-50 text-yellow-800 font-semibold border-yellow-300"
        : "bg-white border-gray-300 focus:border-[#2f3a47]"
    }`}
  placeholder="Discount %"
/>

      {/* 🔹 رمز % */}
      {Number(r.DiscountPercent) > 0 && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold">
          %
        </span>
      )}
    </div>
  ) : (
    `${r.DiscountPercent || 0}%`
  )}
</td>
                      {/* Total */}
                      <td className="p-3 text-right font-semibold">
                        {fmt(r.LineTotal)}
                      </td>

                      {/* Remove */}
                      {editMode && (
                        <td className="p-3 text-center">
                          <button
                            onClick={() => removeDraftRow(i)}
                            className="text-gray-600 hover:text-red-600"
                            title="Remove line"
                          >
                            <FiTrash2 />
                          </button>
                        </td>
                      )}
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* الملخّص حسب العملة */}
            {draftLines.length > 0 && (
             <motion.div
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             className="mt-8 space-y-6 text-gray-800 text-sm"
           >
             {Object.entries(totalsByCurrency).map(([currency, v]) => (
               <div
                 key={currency}
                 className="bg-white/80 rounded-2xl shadow-md border border-gray-200 p-5"
               >
                 {/* 🔹 عنوان العملة */}
                 <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 border-b border-gray-200 pb-2">
                   <FiDollarSign className="text-[#2f3a47]" />
                   <span>{currency} Summary</span>
                 </h3>
           
                 {/* 🔸 الكروت داخل Grid */}
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                   {/* Before Discount */}
                   <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl border border-gray-300 shadow-sm">
                     <FiDollarSign className="text-[#2f3a47] text-lg" />
                     <div>
                       <div className="text-xs text-gray-500">Before Discount</div>
                       <div className="text-base font-semibold">
                         {fmt(v.beforeDisc)} {currency}
                       </div>
                     </div>
                   </div>
           
                   {/* Discount */}
                   <div className="flex items-center gap-3 bg-red-50 p-4 rounded-xl border border-red-200 shadow-sm">
                     <FiPercent className="text-red-600 text-lg" />
                     <div>
                       <div className="text-xs text-red-600">Discount</div>
                       <div className="text-base font-semibold text-red-700">
                         {fmt(v.discount)} {currency}
                       </div>
                     </div>
                   </div>
           
                   {/* Total */}
                   <div className="flex items-center gap-3 bg-[#2f3a47] p-4 rounded-xl border border-gray-700 shadow-sm text-white">
                     <FiCreditCard className="text-white text-lg" />
                     <div>
                       <div className="text-xs text-gray-200">Total</div>
                       <div className="text-base font-semibold">
                         {fmt(v.total)} {currency}
                       </div>
                     </div>
                   </div>
                 </div>
               </div>
             ))}
           </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}