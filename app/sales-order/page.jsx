"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiSearch,
  FiPlus,
  FiTrash2,
  FiCheckCircle,
  FiLoader,
  FiX,
  FiDownload,
  FiBox,
  FiDollarSign,
  FiPercent,
  FiCreditCard,
} from "react-icons/fi";33
import { MdOutlineDiscount } from "react-icons/md";
import toast, { Toaster } from "react-hot-toast";
import * as XLSX from "xlsx";

/* ========== بيانات المواد ========== */
const ITEMS = [
  {
    code: "ITM-1001",
    name: "Black Bag",
    desc: "High-quality cement for all construction needs.",
    price: 7.5,
    currency: "IQD",
    image:
      "https://images.unsplash.com/photo-1614179689702-355944cd0918?q=80&w=870&auto=format&fit=crop",
    warehouses: ["Warehouse-Karbala", "Warehouse-Najaf", "Main Store"],
  },
  {
    code: "ITM-2002",
    name: "Redmi Phone",
    desc: "Waterproof and dust-proof with 48 MP AI camera.",
    price: 120,
    currency: "$",
    image:
      "https://images.unsplash.com/photo-1725304774412-c0c20ef03689?q=80&w=1548&auto=format&fit=crop",
    warehouses: ["Mobile-Depot", "Warehouse-Basra", "Main Store"],
  },
  {
    code: "ITM-3003",
    name: "Type-C Charger",
    desc: "Durable high-speed charger compatible with most phones.",
    price: 20,
    currency: "$",
    image:
      "https://plus.unsplash.com/premium_photo-1669261149433-febd56c05327?q=80&w=830&auto=format&fit=crop",
    warehouses: ["Accessories-A", "Accessories-B"],
  },
  {
    code: "ITM-4004",
    name: "AirPods Pro",
    desc: "With active noise cancellation for immersive sound.",
    price: 220,
    currency: "$",
    image:
      "https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?q=80&w=1548&auto=format&fit=crop",
    warehouses: ["Audio-Warehouse", "Main Store"],
  },
  {
    code: "ITM-5005",
    name: "iPhone 16 Pro Max",
    desc: "Triple-camera system with exceptional performance.",
    price: 1350,
    currency: "$",
    image:
      "https://images.unsplash.com/photo-1726587912121-ea21fcc57ff8?q=80&w=1160&auto=format&fit=crop",
    warehouses: ["Apple-Warehouse", "VIP-Store"],
  },
];

const placeholder =
  "https://via.placeholder.com/120x120.png?text=No+Image";

const fmt = (n) =>
  n?.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const BTN_SOLID =
  "bg-[#2f3a47] hover:bg-[#1e2832] text-white transition shadow-sm";

/* خصم تلقائي */
const autoDiscount = (qty) => {
  if (!qty || qty < 10) return 0;
  if (qty >= 50) return 10;
  if (qty >= 20) return 5;
  return 2;
};

export default function SalesOrderPage() {
  const [query, setQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedWhs, setSelectedWhs] = useState("");
  const [qty, setQty] = useState("");
  const [disc, setDisc] = useState("");
  const [cart, setCart] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  /* البحث */
  const suggestions = useMemo(() => {
    const s = query.trim().toLowerCase();
    if (!s) return [];
    return ITEMS.filter(
      (i) =>
        i.code.toLowerCase().includes(s) ||
        i.name.toLowerCase().includes(s) ||
        i.desc.toLowerCase().includes(s)
    ).slice(0, 8);
  }, [query]);

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setSelectedWhs("");
    setQuery(`${item.code} — ${item.name}`);
  };

  /* إضافة مادة */
  const addToCart = () => {
    if (!selectedItem) return toast.error("اختر المادة أولاً");
    if (!selectedWhs) return toast.error("اختر المخزن");
    if (!qty) return toast.error("أدخل الكمية");

    const price = Number(selectedItem.price);
    const validQty = Number(qty);
    const userDisc = Number(disc) || 0;
    const autoDisc = userDisc === 0 ? autoDiscount(validQty) : 0;
    const usedDisc = userDisc || autoDisc;

    const total = +(validQty * price - usedDisc).toFixed(2);

    const row = {
      code: selectedItem.code,
      name: selectedItem.name,
      desc: selectedItem.desc,
      whs: selectedWhs,
      qty: validQty,
      price,
      disc: usedDisc,
      total,
      currency: selectedItem.currency,
      image: selectedItem.image,
    };
    setCart((p) => [row, ...p]);
    setSelectedItem(null);
    setQuery("");
    setSelectedWhs("");
    setQty("");
    setDisc("");
    toast.success("تمت إضافة المادة بنجاح");
  };

  const removeRow = (i) => setCart((p) => p.filter((_, idx) => idx !== i));
  const clearAll = () => setCart([]);

  const totalBeforeDiscount = useMemo(
    () => cart.reduce((s, r) => s + r.price * r.qty, 0).toFixed(2),
    [cart]
  );

  const totalDiscount = useMemo(
    () => cart.reduce((s, r) => s + (Number(r.disc) || 0), 0).toFixed(2),
    [cart]
  );

  const grandTotal = useMemo(
    () => cart.reduce((s, r) => s + r.total, 0).toFixed(2),
    [cart]
  );

  const totalQty = useMemo(
    () => cart.reduce((s, r) => s + (Number(r.qty) || 0), 0),
    [cart]
  );

  const handleSubmit = () => {
    if (!cart.length) return toast.error("أضف مواد للسلة أولاً");
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setShowPopup(true);
      toast.success("تم إنشاء أمر البيع");
    }, 1000);
  };

  const exportToExcel = () => {
    if (!cart.length) return toast.error("لا توجد بيانات للتصدير");
    const data = cart.map((r) => ({
      Code: r.code,
      Name: r.name,
      Description: r.desc,
      Warehouse: r.whs,
      Qty: r.qty,
      Price: r.price,
      Discount: r.disc,
      Total: r.total,
      Currency: r.currency,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales Order");
    XLSX.writeFile(wb, "sales_order.xlsx");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 text-gray-900 flex flex-col items-center py-6">
      <Toaster position="top-center" />
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-6xl px-4 sm:px-6 space-y-6"
      >
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-[#2f3a47]">Sales Order</h1>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border bg-gray-100 hover:bg-gray-200"
          >
            <FiDownload /> تصدير Excel
          </button>
        </div>

     {/* 🔍 البحث */}
<motion.div
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  className="bg-white border border-gray-200 rounded-2xl p-6 shadow-lg"
>
  <div className="flex flex-col gap-4">
    {/* 🔎 مربع البحث */}
    <div className="relative">
      <div className="flex items-center gap-3 bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 shadow-sm focus-within:border-[#2f3a47] transition-all">
        <FiSearch className="text-[#2f3a47] text-lg" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedItem(null);
          }}
          placeholder="ابحث عن مادة بالاسم أو الكود…"
          className="w-full outline-none bg-transparent text-gray-800 placeholder-gray-400"
        />
        {query && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            onClick={() => {
              setQuery("");
              setSelectedItem(null);
            }}
            className="p-1.5 rounded-md hover:bg-gray-200 transition"
          >
            <FiX className="text-gray-600" />
          </motion.button>
        )}
      </div>

      {/* 📋 قائمة الاقتراحات */}
      <AnimatePresence>
        {suggestions.length > 0 && !selectedItem && (
          <motion.ul
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.25 }}
            className="absolute z-10 mt-2 w-full bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xl"
          >
            {suggestions.map((it) => (
              <motion.li key={it.code} whileHover={{ scale: 1.01 }}>
                <button
                  onClick={() => handleSelectItem(it)}
                  className="flex items-center gap-3 w-full text-left px-4 py-2 hover:bg-gray-100 transition"
                >
                  <img
                    src={it.image || placeholder}
                    onError={(e) => (e.target.src = placeholder)}
                    alt={it.name}
                    className="w-10 h-10 rounded-lg object-cover border border-gray-300 shadow-sm"
                  />
                  <div>
                    <div className="font-semibold text-gray-800">
                      {it.code}
                    </div>
                    <div className="text-sm text-gray-500">{it.name}</div>
                  </div>
                </button>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>

    {/* 📦 تفاصيل المادة المحددة */}
    {selectedItem && (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-4"
      >
        <div className="grid sm:grid-cols-5 gap-3">
          <select
            value={selectedWhs}
            onChange={(e) => setSelectedWhs(e.target.value)}
            className="border border-gray-300 rounded-xl px-3 py-2 bg-white focus:border-[#2f3a47] outline-none"
          >
            <option value="">اختر المخزن</option>
            {selectedItem.warehouses.map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>

          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="border border-gray-300 rounded-xl px-3 py-2 bg-white focus:border-[#2f3a47] outline-none"
            placeholder="الكمية"
          />

          <input
            type="number"
            min={0}
            value={disc}
            onChange={(e) => setDisc(e.target.value)}
            className="border border-gray-300 rounded-xl px-3 py-2 bg-white focus:border-[#2f3a47] outline-none"
            placeholder="الخصم"
          />

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={addToCart}
            className={`flex items-center justify-center gap-2 sm:col-span-2 rounded-xl px-4 py-2 font-medium ${BTN_SOLID}`}
          >
            <FiPlus />
            إضافة
          </motion.button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 bg-gray-50 border border-gray-300 rounded-xl p-4 shadow-inner"
        >
          <img
            src={selectedItem.image || placeholder}
            onError={(e) => (e.target.src = placeholder)}
            alt={selectedItem.name}
            className="w-24 h-24 object-cover rounded-lg border border-gray-300"
          />
          <div>
            <div className="font-semibold text-lg text-[#2f3a47]">
              {selectedItem.name}
            </div>
            <div className="text-gray-600 text-sm">{selectedItem.desc}</div>
            <div className="text-gray-800 font-medium mt-1">
              السعر: {fmt(selectedItem.price)} {selectedItem.currency}
            </div>
          </div>
        </motion.div>
      </motion.div>
    )}
  </div>
</motion.div>
      {/* 🧾 الجدول */}
<motion.div
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  className="bg-white border border-gray-300 rounded-2xl p-6 shadow-lg"
>
  <div className="flex justify-between items-center mb-4">
    <h2 className="font-semibold text-lg text-[#2f3a47]">المواد المضافة</h2>
    <button
      onClick={clearAll}
      disabled={!cart.length}
      className="flex items-center gap-2 text-gray-700 hover:text-black disabled:opacity-40"
    >
      <FiTrash2 />
      تفريغ الكل
    </button>
  </div>

  <div className="overflow-x-auto rounded-xl border border-gray-300">
    <table className="min-w-full text-sm">
      <thead className="bg-[#2f3a47] text-white text-left">
        <tr>
          <th className="p-3">الصورة</th>
          <th className="p-3">الكود</th>
          <th className="p-3">الوصف</th>
          <th className="p-3">المخزن</th>
          <th className="p-3">الكمية</th>
          <th className="p-3">السعر</th>
          <th className="p-3">الخصم</th>
          <th className="p-3">الإجمالي</th>
          <th className="p-3 text-center">إجراء</th>
        </tr>
      </thead>

      <tbody>
        {cart.length ? (
          cart.map((r, i) => (
            <motion.tr
              key={r.code + i}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="border-b border-gray-200 hover:bg-gray-100 transition-colors duration-200"
            >
              <td className="p-3">
                <img
                  src={r.image || placeholder}
                  onError={(e) => (e.target.src = placeholder)}
                  alt={r.name}
                  className="w-12 h-12 rounded-md object-cover border border-gray-300 shadow-sm"
                />
              </td>
              <td className="p-3 font-medium text-gray-800">{r.code}</td>
              <td className="p-3 text-gray-600">{r.desc}</td>
              <td className="p-3 text-gray-700">{r.whs}</td>
              <td className="p-3 text-gray-800 font-medium">{fmt(r.qty)}</td>
              <td className="p-3 text-gray-800">
                {fmt(r.price)} {r.currency}
              </td>
              <td className="p-3 text-gray-800">{fmt(r.disc)}</td>
              <td className="p-3 font-semibold text-[#2f3a47]">
                {fmt(r.total)} {r.currency}
              </td>
              <td className="p-3 text-center">
                <motion.button
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => removeRow(i)}
                  className="text-gray-600 hover:text-red-600 transition"
                  title="حذف"
                >
                  <FiX size={18} />
                </motion.button>
              </td>
            </motion.tr>
          ))
        ) : (
          <tr>
            <td
              colSpan={9}
              className="text-center text-gray-500 py-8 font-medium"
            >
              لا توجد مواد مضافة بعد
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>


         {/* 🔹 ملخص الإجماليات داخل البوب أب */}
{cart.length > 0 && (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="mt-6 grid sm:grid-cols-4 gap-3 text-gray-800 text-sm"
  >
    <div className="flex items-center gap-2 bg-gray-100 p-3 rounded-xl border border-gray-300">
      <FiBox className="text-[#2f3a47] text-lg" />
      <span>
        <b>إجمالي الكميات:</b> {fmt(totalQty)}
      </span>
    </div>

    <div className="flex items-center gap-2 bg-gray-100 p-3 rounded-xl border border-gray-300">
      <FiDollarSign className="text-[#2f3a47] text-lg" />
      <span>
        <b>قبل الخصم:</b> {fmt(totalBeforeDiscount)} $
      </span>
    </div>

    <div className="flex items-center gap-2 bg-gray-100 p-3 rounded-xl border border-gray-300 text-red-600">
      <MdOutlineDiscount className="text-red-600 text-lg" />
      <span>
        <b>الخصومات:</b> {fmt(totalDiscount)} $
      </span>
    </div>

    <div className="flex items-center gap-2 bg-[#2f3a47] text-white p-3 rounded-xl shadow-inner">
      <FiCreditCard className="text-white text-lg" />
      <span className="font-semibold">
        المجموع النهائي: {fmt(Number(grandTotal))} $
      </span>
    </div>
  </motion.div>
)}
          <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-3">
            <motion.button
              whileHover={{ scale: cart.length ? 1.02 : 1 }}
              whileTap={{ scale: cart.length ? 0.98 : 1 }}
              disabled={!cart.length || submitting}
              onClick={handleSubmit}
              className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold 
                ${
                  !cart.length || submitting
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : BTN_SOLID
                }`}
            >
              {submitting ? (
                <>
                  <FiLoader className="animate-spin" />
                  جارٍ الإنشاء…
                </>
              ) : (
                <>
                  <FiCheckCircle />
                  إنشاء أمر بيع
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>

      {/* ✅ Popup */}
      <AnimatePresence>
  {showPopup && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-3xl text-center relative"
      >
        {/* ✅ Success Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 120 }}
          className="mx-auto mb-4 flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 shadow-inner"
        >
          <FiCheckCircle className="text-4xl" />
        </motion.div>

        {/* 🔹 Title */}
        <h2 className="text-2xl font-semibold text-green-700 mb-1">
          تم إنشاء أمر البيع بنجاح
        </h2>
        <p className="text-gray-600 mb-6 text-sm">
          التفاصيل أدناه توضح المواد المضافة في الطلب
        </p>

        {/* 🧾 Table / Items */}
        <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-200">
          {cart.map((r, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4 p-3 hover:bg-gray-50 transition"
            >
              <img
                src={r.image || placeholder}
                onError={(e) => (e.target.src = placeholder)}
                className="w-14 h-14 rounded-lg object-cover border border-gray-300 shadow-sm"
                alt={r.name}
              />
              <div className="text-left flex-1">
                <div className="font-semibold text-[#2f3a47]">
                  {r.name}
                </div>
                <div className="text-xs text-gray-600 truncate">
                  {r.desc}
                </div>
                <div className="text-sm text-gray-800 mt-1">
                  {fmt(r.qty)} × {fmt(r.price)} {r.currency} − خصم{" "}
                  {fmt(r.disc)} ={" "}
                  <b className="text-[#2f3a47]">
                    {fmt(r.total)} {r.currency}
                  </b>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* 💰 Summary Section */}
        {cart.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 grid sm:grid-cols-4 gap-3 text-gray-800 text-sm"
          >
            <div className="flex items-center gap-2 bg-gray-100 p-3 rounded-xl border border-gray-300">
              <FiBox className="text-[#2f3a47] text-lg" />
              <span>
                <b>إجمالي الكميات:</b> {fmt(totalQty)}
              </span>
            </div>

            <div className="flex items-center gap-2 bg-gray-100 p-3 rounded-xl border border-gray-300">
              <FiDollarSign className="text-[#2f3a47] text-lg" />
              <span>
                <b>قبل الخصم:</b> {fmt(totalBeforeDiscount)} $
              </span>
            </div>

            <div className="flex items-center gap-2 bg-gray-100 p-3 rounded-xl border border-gray-300 text-red-600">
              <FiPercent className="text-red-600 text-lg" />
              <span>
                <b>الخصومات:</b> {fmt(totalDiscount)} $
              </span>
            </div>

            <div className="flex items-center gap-2 bg-[#2f3a47] text-white p-3 rounded-xl shadow-inner">
              <FiCreditCard className="text-white text-lg" />
              <span className="font-semibold">
                المجموع النهائي: {fmt(Number(grandTotal))} $
              </span>
            </div>
          </motion.div>
        )}

        {/* 🔘 Close Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowPopup(false)}
          className={`mt-8 px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 mx-auto ${BTN_SOLID}`}
        >
          <FiX className="text-lg" />
          إغلاق
        </motion.button>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
    </div>
  );
}