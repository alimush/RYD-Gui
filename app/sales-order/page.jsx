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
  FiBox
  ,
  FiPercent,
  FiCreditCard,FiUser, FiPhone ,FiChevronDown , FiCpu, FiTag , FiHash , FiSettings ,FiFileText 
} from "react-icons/fi";33
import { MdOutlineDiscount } from "react-icons/md";
import toast, { Toaster } from "react-hot-toast";
import * as XLSX from "xlsx";
import { Listbox, Transition } from "@headlessui/react";
import { FiHome, FiPackage, FiCheck } from "react-icons/fi";
import { Fragment } from "react";
import { FaMoneyBills } from "react-icons/fa6";

/* ========== بيانات المواد ========== */

const placeholder =
 "https://static.vecteezy.com/system/resources/previews/022/059/000/non_2x/no-image-available-icon-vector.jpg";

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
  const [allItems, setAllItems] = useState([]);
const [suggestions, setSuggestions] = useState([]);
const [customerQuery, setCustomerQuery] = useState("");
const [customerSuggestions, setCustomerSuggestions] = useState([]);
const [selectedCustomer, setSelectedCustomer] = useState(null);
const [createdOrder, setCreatedOrder] = useState(null);
const [discFromSAP, setDiscFromSAP] = useState(0);
const [currency, setCurrency] = useState("IQD");
const [isProject, setIsProject] = useState(false);
useEffect(() => {
  const user = JSON.parse(localStorage.getItem("user"));
  const mode = localStorage.getItem("mode");

  if (mode === "select-sale-order") {
    // 🧱 Project user
    setIsProject(true);
    // toast.success("🧱 قسم المشاريع - اختر العملة من القائمة");
  } else {
    // 🏢 مستخدم عادي
    setIsProject(false);
    if (user?.currency) setCurrency(user.currency);
  }
}, []);


// ✅ تحقق من وجود زبون جديد تم إنشاؤه من صفحة create-customer
useEffect(() => {
  const newCustomer = localStorage.getItem("newCreatedCustomer");
  if (newCustomer) {
    try {
      const parsed = JSON.parse(newCustomer);
      setSelectedCustomer({
        CardCode: parsed.CardCode,
        CardName: parsed.CardName,
        Phone1: parsed.Phone1 || "",
      });
      setCustomerQuery(`${parsed.CardCode} — ${parsed.CardName}`);
      toast.success(`✅ تم تحديد الزبون الجديد: ${parsed.CardName}`);
    } catch (err) {
      console.error("❌ Error parsing new customer:", err);
    } finally {
      // نحذف القيمة بعد تحميلها حتى لا تنعاد
      localStorage.removeItem("newCreatedCustomer");
    }
  }
}, []);
useEffect(() => {
  const user = localStorage.getItem("user");
  if (!user) {
    window.location.href = "/login";
  }
}, []);

useEffect(() => {
  const s = customerQuery.trim().toLowerCase();
  if (!s) return setCustomerSuggestions([]);

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`/api/customers?q=${s}`);
      const data = await res.json();
      setCustomerSuggestions(data.slice(0, 10));
    } catch (err) {
      console.error("❌ Failed to fetch customers:", err);
    }
  };

  fetchCustomers();
}, [customerQuery]);

const handleSelectCustomer = async (cust) => {
  setSelectedCustomer(cust);
  setCustomerQuery(`${cust.CardCode} — ${cust.CardName}`);

  
};
useEffect(() => {
  async function fetchItems() {
    try {
      const res = await fetch("/api/items");
      const data = await res.json();
      setAllItems(data);
    } catch (err) {
      console.error("❌ Failed to fetch items:", err);
    }
  }
  fetchItems();
}, []);
useEffect(() => {
  const s = query.trim().toLowerCase();

  if (!currency) {
    if (s.length > 0) {
      toast.error("⚠️ يرجى اختيار العملة أولاً قبل البحث عن المواد");
    }
    setSuggestions([]);
    return;
  }

  // ⭐ شرط الـ 3 حروف
  if (s.length > 0 && s.length < 3) {
    setSuggestions([]);
    return;
  }

  if (!s) {
    setSuggestions([]);
    return;
  }

  const t = setTimeout(() => {
    const results = allItems.filter(
      (i) =>
        i.ItemCode?.toLowerCase().includes(s) ||
        i.ItemName?.toLowerCase().includes(s) ||
        i.U_ST_Model?.toLowerCase().includes(s) ||
        i.U_ST_PartNo?.toLowerCase().includes(s) ||
        i.SWW?.toLowerCase().includes(s)
    );

    setSuggestions(results.slice(0, 10));
  }, 300); // Debounce

  return () => clearTimeout(t);
}, [query, allItems, currency]);
  /* البحث */
  const handleSelectItem = async (item) => {
    try {
      // 🚫 إذا ما محددة العملة نمنع الاختيار
      if (!currency) {
        toast.error("⚠️ يرجى اختيار العملة أولاً قبل اختيار المادة");
        return;
      }
  
      // 🚫 إذا السلة تحتوي مواد، نمنع تغيير العملة
      if (cart.length > 0) {
        const cartCurrency = cart[0]?.currency;
      }
  
      console.log("📦 Selected item:", item);
  
      // 🟢 جلب السعر من SAP حسب العملة
      const res = await fetch(
        `/api/item-price?itemCode=${item.ItemCode}&currency=${currency}`
      );
      const data = await res.json();
  
      if (!res.ok || !data?.data?.length) {
        toast.error("⚠️ لم يتم العثور على سعر للمادة");
        return;
      }
  
      // 🔹 بعد تحميل السعر من SAP، نجلب الخصم من مجموعة الخصومات
      try {
        const dRes = await fetch(`/api/discount?itemCode=${item.ItemCode}`);
        const dData = await dRes.json();
  
        if (dRes.ok && Number(dData.discount) > 0) {
          setDisc(String(dData.discount)); // عرض الخصم في المربع
          setDiscFromSAP(Number(dData.discount)); // نخزن قيمة الخصم الجاي من SAP
          toast.success(`خصم المادة من المجموعة: ${dData.discount}%`);
        } else {
          setDisc("");
          setDiscFromSAP(0); // ماكو خصم من SAP
        }
      } catch {
        console.warn("⚠️ فشل جلب خصم SAP");
      }
  
      // ✅ تعريف firstRow مرة واحدة فقط
      const firstRow = data.data[0];
  
      setSelectedItem({
        code: item.ItemCode,
        name: item.ItemName,
        desc: item.U_ST_Model || item.U_ST_PartNo || "",
        U_ST_Model: item.U_ST_Model,
        U_ST_PartNo: item.U_ST_PartNo,
        ItemCode: item.ItemCode,
        SWW: item.SWW || "", // ✅ أضف هذا السطر هنا
        price: Number(firstRow.Price) || 0,
        currency: data.currency,
        image: item.image || placeholder,
        warehouses: data.data.map((w) => ({
          code: w.whsname.split("|")[2]?.trim() || "",
          name: w.whsname.split("|")[1]?.trim() || "",
          available: Number(w.Available) || 0,
          price: Number(w.Price) || 0,
        })),
      });
  
      toast.success(`✅ تم تحميل السعر بعملة ${data.currency}`);
    } catch (err) {
      console.error("❌ Failed to load item data:", err);
      toast.error("حدث خطأ أثناء تحميل بيانات المادة");
    }
  };
  /* إضافة مادة */
  const addToCart = () => {
    if (!selectedItem) return toast.error("اختر المادة أولاً");
    if (!selectedWhs) return toast.error("اختر المخزن");
    if (!qty) return toast.error("أدخل الكمية");
  
    const validQty = Number(qty);
    const userDisc = Number(disc) || 0;
    const autoDisc = userDisc === 0 ? autoDiscount(validQty) : 0;
    const usedDisc = userDisc || autoDisc;
  
    const selectedWarehouse = selectedItem.warehouses.find(
      (w) => w.code === selectedWhs
    );
  
    if (!selectedWarehouse) {
      toast.error("المخزن المحدد غير صالح");
      return;
    }
  
    const availableQty = Number(selectedWarehouse.available || 0);
    if (validQty > availableQty) {
      toast.error(
        `⚠️ الكمية المطلوبة (${validQty}) تتجاوز المتاحة (${availableQty}) في المخزن ${selectedWarehouse.name}`
      );
      return;
    }
  
    const price = Number(selectedItem.price || 0);
    if (price <= 0) {
      toast.error("⚠️ لا يمكن إضافة مادة بدون سعر محدد");
      return;
    }
  
    // ✅ نحسب إذا المادة موجودة أو جديدة
    const existingIndex = cart.findIndex(
      (r) => r.code === selectedItem.code && r.whs === selectedWhs
    );
  
    let updatedCart = [...cart];
    let message = "";
  
    if (existingIndex !== -1) {
      // 🔁 تحديث كمية مادة موجودة
      const existing = updatedCart[existingIndex];
      const newQty = existing.qty + validQty;
      const total = +((newQty * price) * (1 - usedDisc / 100)).toFixed(2);
  
      updatedCart[existingIndex] = {
        ...existing,
        qty: newQty,
        disc: usedDisc,
        total,
      };
  
      message = "🔁 تم تحديث الكمية للمادة نفسها داخل نفس المخزن";
    } else {
      // 🟢 مادة جديدة
      const total = +((validQty * price) * (1 - usedDisc / 100)).toFixed(2);
      updatedCart = [
        {
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
          isSAPDiscount: discFromSAP > 0,
sapDiscountValue: discFromSAP || 0, // 🟢 نخزن الخصم الأصلي الجاي من SAP
        },
        ...cart,
      ];
      // message = "✅ تمت إضافة المادة بنجاح";
    }
  
    // ✅ نحدث الحالة
    setCart(updatedCart);
  
    // ✅ نظهر التوست مرة وحدة فقط
    // toast.success(message);
  
    // 🧹 تنظيف الحقول
    setSelectedItem(null);
    setQuery("");
    setSelectedWhs("");
    setQty("");
    setDisc("");
  };
  // 🧩 تحديث حقل داخل صف معين في السلة
const updateCartItem = (index, field, value) => {
  setCart((prev) =>
    prev.map((r, i) => {
      if (i !== index) return r;
      const updated = { ...r, [field]: value };

      // ✅ إعادة حساب الإجمالي عند تعديل qty أو disc
      const qty = Number(updated.qty) || 0;
      const price = Number(updated.price) || 0;
      const disc = Number(updated.disc) || 0;
      updated.total = +(qty * price * (1 - disc / 100)).toFixed(2);

      return updated;
    })
  );
};
  const removeRow = (i) => setCart((p) => p.filter((_, idx) => idx !== i));
  const clearAll = () => setCart([]);

  const totalBeforeDiscount = useMemo(
    () => cart.reduce((s, r) => s + r.price * r.qty, 0).toFixed(2),
    [cart]
  );

  const totalDiscount = useMemo(
    () =>
      cart
        .reduce(
          (s, r) => s + (r.price * r.qty * (Number(r.disc) || 0) / 100),
          0
        )
        .toFixed(2),
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

  const handleSubmit = async () => {
    if (!cart.length) return toast.error("أضف مواد للسلة أولاً");
  
    setSubmitting(true);
    try {
      // 🟢 جلب بيانات المستخدم من localStorage (اللي دخل من MSSQL)
      const user = JSON.parse(localStorage.getItem("user"));
      if (!user?.sapUser || !user?.sapPass) {
        toast.error("بيانات دخول SAP غير موجودة، يرجى تسجيل الدخول مجددًا");
        setSubmitting(false);
        return;
      }
  
      // 🧾 تحقق من الزبون قبل إنشاء الطلب
      if (!selectedCustomer) {
        toast.error("يرجى اختيار الزبون أولاً قبل إنشاء الطلب");
        setSubmitting(false);
        return;
      }
  
      // 🧩 بناء بيانات الطلب مع بيانات المستخدم الديناميكية
      const sapOrder = {
        sapUser: user.sapUser,
        sapPass: user.sapPass,
        RepID: user.RepID,
        CardCode: selectedCustomer.CardCode,
        DocDueDate: new Date().toISOString().split("T")[0],
        DocCurrency: currency, // ✅ إضافة العملة المختارة إلى الأوردر
        DocumentLines: cart.map((r) => ({
          ItemCode: r.code,
          Quantity: Number(r.qty),
          UnitPrice: Number(r.price),
          WarehouseCode: r.whs,
          DiscountPercent: Number(r.disc),
          FreeText:
          r.isSAPDiscount
            ? `DG:${r.sapDiscountValue || r.disc || 0}` // 🟢 يرسل الخصم الحقيقي من SAP
            : "",
        })),
        U_CreatedBy: user.username || user.fullname || user.sapUser,
      };
  
      // 📤 إرسال الطلب إلى السيرفر
      const res = await fetch("/api/sales-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sapOrder),
      });
  
      let data = null;
      try {
        data = await res.json();
      } catch (jsonErr) {
        console.error("⚠️ الرد من السيرفر غير صالح:", jsonErr);
      }
  
      if (res.ok && data?.success) {
        // toast.success(
        //   `تم إنشاء أمر البيع رقم ${data.docNum || "—"} من قبل ${user.sapUser} ✅`
        // );
  
        // 🟢 إظهار البوب أب
        setCreatedOrder({
          docNum: data.docNum,
          docEntry: data.docEntry,
        });
  
        setCart([]);
        setSelectedCustomer(null);
        setCustomerQuery("");
        setShowPopup(true);
      } else {
        const errMsg =
          data?.error?.message ||
          data?.error ||
          "حدث خطأ غير متوقع أثناء إنشاء أمر البيع";
        toast.error(`⚠️ ${errMsg}`);
      }
    } catch (err) {
      console.error("❌ خطأ في الاتصال بـ API:", err);
      toast.error("حدث خطأ أثناء الاتصال بـ SAP");
    } finally {
      setSubmitting(false);
    }
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
// ✅ حساب المجاميع حسب العملة
const totalsByCurrency = useMemo(() => {
  const result = {};
  cart.forEach((r) => {
    const curr = r.currency || "IQD";
    if (!result[curr]) {
      result[curr] = { before: 0, discount: 0, total: 0, qty: 0 };
    }
    const lineBefore = r.price * r.qty;
    const lineDiscount = lineBefore * (r.disc / 100);
    const lineTotal = lineBefore - lineDiscount;

    result[curr].before += lineBefore;
    result[curr].discount += lineDiscount;
    result[curr].total += lineTotal;
    result[curr].qty += r.qty;
  });
  return result;
}, [cart]);
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 text-gray-900 flex flex-col items-center py-6">
      <Toaster position="top-center" />
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full text-center max-w-6xl px-4 sm:px-6 space-y-6"
      >
      <div className="flex items-center mt-10 justify-center w-full mb-4">
  <h1 className="text-3xl font-bold mb-6 text-[#2f3a47] text-center">
    Sales Order
  </h1>
</div>

     {/* 🔍 البحث */}
     
<motion.div
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  className="bg-white border border-gray-200 rounded-2xl p-6 shadow-lg"
>{/* 👤 اختيار الزبون */}
<div className="flex justify-between items-start mb-6 w-full">
  {/* 🔍 مربع البحث الصغير - يسار */}
  <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-md w-[350px]">
    <h2 className="font-semibold text-lg text-[#2f3a47] mb-3 text-center">
      اختيار الزبون
    </h2>

    <div className="relative">
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 shadow-sm focus-within:border-[#2f3a47] transition-all">
        <FiSearch className="text-[#2f3a47] text-lg" />
        <input
          type="text"
          value={customerQuery}
          onChange={(e) => {
            setCustomerQuery(e.target.value);
            setSelectedCustomer(null);
          }}
          placeholder="بحث..."
          className="w-full outline-none bg-transparent text-gray-800 placeholder-gray-400 text-sm"
        />
        {customerQuery && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            onClick={() => {
              setCustomerQuery("");
              setSelectedCustomer(null);
            }}
            className="p-1 rounded-md hover:bg-gray-200 transition"
          >
            <FiX className="text-gray-600" />
          </motion.button>
        )}
      </div>

      {/* 🔽 قائمة الاقتراحات */}
      <AnimatePresence>
  {(!selectedCustomer && customerQuery) && (
    <motion.ul
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.25 }}
      className="absolute z-10 mt-2 w-full bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto"
    >
      {/* ✅ عرض نتائج البحث */}
      {customerSuggestions.length > 0 ? (
        customerSuggestions.map((cust) => (
          <motion.li key={cust.CardCode} whileHover={{ scale: 1.01 }}>
            <button
              onClick={() => handleSelectCustomer(cust)}
              className="flex flex-col text-left w-full px-3 py-2 hover:bg-gray-100 transition"
            >
              <div className="font-semibold text-gray-800 text-sm">
                {cust.CardCode} — {cust.CardName}
              </div>
              <div className="text-xs text-gray-500">
                📞 {cust.Phone1 || "—"}
              </div>
            </button>
          </motion.li>
        ))
      ) : (
        // 🆕 لا توجد نتائج → أضف خيار إنشاء زبون جديد
        <motion.li
          whileHover={{ scale: 1.02 }}
          className="flex items-center justify-between px-4 py-3 text-[#2f3a47] font-medium hover:bg-gray-100 cursor-pointer"
          onClick={() => (window.location.href = "/create-customer")}
        >
          <span>➕ إنشاء زبون جديد "{customerQuery}"</span>
          <FiPlus />
        </motion.li>
      )}
    </motion.ul>
  )}
</AnimatePresence>
    </div>
  </div>
  {/* 🏬 جدول المخازن - تصميم Excel صغير ومنظم */}
  {selectedItem?.warehouses?.length > 0 && (
  <motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
  className={`${selectedCustomer ? "flex justify-center w-full" : ""}`}
>
  <div
    className={`bg-gradient-to-br from-white to-gray-50 border border-gray-300 rounded-2xl p-5 shadow-md flex flex-col gap-3 text-sm text-[#2f3a47]
    ${selectedCustomer ? "w-[540px]" : "w-[480px]"}`}
  >
    {/* 🔹 العنوان */}
    <div className="flex items-center justify-between border-b border-gray-300 pb-2 w-full">
      <h3 className="font-semibold text-[#2f3a47] flex items-center gap-2 text-[15px]">
        🏬 المخازن المتاحة
      </h3>
      <span className="text-sm text-gray-700 truncate max-w-[340px] text-right font-medium">
        {selectedItem.name}
      </span>
    </div>

    {/* 📋 الجدول */}
    <div className="rounded-xl border border-gray-400 overflow-hidden w-full">
      <div className="max-h-[220px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
        <table className="w-full text-[13px] text-gray-800 border-collapse text-center">
          <thead>
            <tr className="bg-[#2f3a47] text-white border-b border-gray-400">
              <th className="p-2 border border-gray-400 font-semibold w-[45%]">
                اسم المخزن
              </th>
              <th className="p-2 border border-gray-400 font-semibold w-[25%]">
                الكود
              </th>
              <th className="p-2 border border-gray-400 font-semibold w-[30%]">
                الكمية
              </th>
            </tr>
          </thead>
          <tbody>
            {selectedItem.warehouses.map((w) => (
              <tr
                key={w.code}
                onClick={() => setSelectedWhs(w.code)}
                className={`cursor-pointer transition-all duration-150 border-b border-gray-300 ${
                  selectedWhs === w.code
                    ? "bg-green-100 border-l-4 border-green-500"
                    : "hover:bg-gray-100"
                }`}
              >
                <td className="p-2 border border-gray-300 font-medium">
                  {w.name}
                </td>
                <td className="p-2 border border-gray-300 text-gray-700">
                  {w.code}
                </td>
                <td className="p-2 border border-gray-300 text-green-700 font-semibold">
                  {w.available.toLocaleString("en-US")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {/* ✅ المخزن المحدد */}
    {selectedWhs && (
      <div className="flex items-center justify-center gap-2 text-green-700 font-semibold mt-1 text-[13px]">
        <FiCheckCircle className="text-green-600 text-lg" />
        <span>
          تم اختيار:{" "}
          <span className="underline decoration-green-500">
            {
              selectedItem.warehouses.find((w) => w.code === selectedWhs)
                ?.name
            }
          </span>
        </span>
      </div>
    )}
  </div>
</motion.div>
)}

  {/* ✅ معلومات الزبون - يمين */}
  {selectedCustomer && (
 <motion.div
 initial={{ opacity: 0, x: 15 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ duration: 0.3 }}
 className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-2xl p-4 shadow-lg w-[280px] flex flex-col gap-3 text-sm text-[#2f3a47]"
>
 {/* 🔹 عنوان بسيط */}
 <div className="flex items-center justify-between border-b border-gray-200 pb-1">
   <h3 className="font-semibold text-[#2f3a47] flex items-center gap-2 text-[15px]">
     <FiUser className="text-[#2f3a47]" />
     تفاصيل الزبون
   </h3>
   <span className="text-xs text-gray-500">🟢 محدد</span>
 </div>

 {/* 🧍 الاسم */}
 <div className="flex items-center gap-2">
   <div className="bg-[#2f3a47]/10 p-2 rounded-lg">
     <FiUser className="text-[#2f3a47]" />
   </div>
   <div>
     <div className="text-xs text-gray-500">اسم الزبون</div>
     <div className="font-semibold text-sm truncate max-w-[180px]">
       {selectedCustomer.CardName}
     </div>
   </div>
 </div>

 {/* 🔢 الكود */}
 <div className="flex items-center gap-2">
   <div className="bg-blue-100 p-2 rounded-lg">
     <FiHash className="text-blue-600" />
   </div>
   <div>
     <div className="text-xs text-gray-500">كود الزبون</div>
     <div className="font-medium text-sm">{selectedCustomer.CardCode}</div>
   </div>
 </div>

 {/* ☎️ الهاتف */}
 <div className="flex items-center gap-2">
   <div className="bg-green-100 p-2 rounded-lg">
     <FiPhone className="text-green-600" />
   </div>
   <div>
     <div className="text-xs text-gray-500">رقم الهاتف</div>
     <div className="font-medium text-sm truncate max-w-[160px]">
       {selectedCustomer.Phone1 || "—"}
     </div>
   </div>
 </div>
</motion.div>
)}

</div>
  
  <div className="flex flex-col gap-4">
    
    {/* 🔎 مربع البحث */}
    
    <div className="relative">
      
    
      <div className="flex items-center gap-3 bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 shadow-sm focus-within:border-[#2f3a47] transition-all">
      {isProject && (
  <div className="flex items-center gap-2">
    <label className="text-sm text-gray-700 font-medium">العملة:</label>
    <select
      value={currency}
      onChange={(e) => setCurrency(e.target.value)}
      disabled={selectedItem || cart.length > 0}
      className={`border rounded-xl px-3 py-2 text-sm outline-none transition
        ${
          selectedItem || cart.length > 0
            ? "bg-gray-200 cursor-not-allowed text-gray-500 border-gray-300"
            : "bg-white focus:border-[#2f3a47] text-gray-800 border-gray-400"
        }`}
    >
      <option value="IQD">دينار عراقي (IQD)</option>
      <option value="USD">دولار أمريكي (USD)</option>
    </select>
  </div>
)}
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
            className="absolute z-10 mt-2 w-full bg-white border border-gray-200 rounded-xl 
            shadow-2xl overflow-y-auto max-h-60 
            scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100 scroll-smooth"          >
{suggestions.map((it) => (
  <motion.li key={it.ItemCode} whileHover={{ scale: 1.01 }}>
  <button
    disabled={!currency}
    onClick={() => {
      if (!currency) {
        toast.error("⚠️ يرجى اختيار العملة أولاً قبل اختيار المادة");
        return;
      }
      handleSelectItem(it);
    }}
    className={`flex items-center gap-3 w-full text-left px-4 py-2 transition 
      ${!currency ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-100"}`}
  >
    {/* 🖼️ صورة المادة */}
    <img
      src={it.image || placeholder}
      onError={(e) => (e.target.src =placeholder)}
      alt={it.ItemName}
      className="w-10 h-10 rounded-lg object-cover border border-gray-300 shadow-sm"
    />

    {/* 🧾 التفاصيل */}
    <div className="flex flex-col overflow-hidden">
      <div className="font-semibold text-gray-800 text-sm truncate">
        {it.ItemCode} — {it.ItemName}
      </div>

      {/* 🎨 Model / Part No / SWW بألوان مميزة */}
      <div className="flex flex-wrap gap-1 mt-1 text-[11px]">
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
            <FiSettings className="text-yellow-500 text-[12px]" />
            <b>SWW:</b> {it.SWW}
          </span>
        )}
      </div>
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
      

        <Listbox value={selectedWhs} onChange={setSelectedWhs}>
  <div className="relative">
    {/* 🔹 الزر الأساسي */}
    <Listbox.Button className="w-full border border-gray-400 rounded-xl px-4 py-2 bg-white text-gray-800 text-sm text-right shadow-sm focus:ring-2 focus:ring-[#2f3a47]/50">
      {selectedWhs
        ? selectedItem.warehouses.find((w) => w.code === selectedWhs)?.name
        : "اختر المخزن"}
    </Listbox.Button>

    {/* 🔽 القائمة */}
    <Transition
      as={Fragment}
      leave="transition ease-in duration-100"
      leaveFrom="opacity-100 translate-y-0"
      leaveTo="opacity-0 -translate-y-2"
    >
<Listbox.Options
  className="absolute left-0 mt-2 w-[580px] bg-white border border-gray-400 rounded-xl shadow-2xl z-50 text-sm
             overflow-y-auto max-h-[220px] scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100"
>        {/* 🧭 رأس الجدول */}
        <div className="grid grid-cols-3 text-gray-800 font-semibold text-center">
          <div className="border border-gray-400 bg-gray-100 py-2">اسم المخزن</div>
          <div className="border border-gray-400 bg-gray-100 py-2">كود المخزن</div>
          <div className="border border-gray-400 bg-gray-100 py-2">الكمية</div>
        </div>

        {/* 🏬 صفوف البيانات */}
        {selectedItem.warehouses.map((w) => (
          <Listbox.Option
            key={w.code}
            value={w.code}
            className={({ active }) =>
              `grid grid-cols-3 text-center cursor-pointer ${
                active ? "bg-gray-100" : "bg-white"
              }`
            }
          >
            <div className="border border-gray-300 py-2 px-2 truncate">{w.name}</div>
            <div className="border border-gray-300 py-2 px-2">{w.code}</div>
            <div className="border border-gray-300 py-2 px-2 text-green-700 font-semibold">
              {w.available}
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
  value={qty}
  onChange={(e) => setQty(e.target.value)}
  className="w-full border border-gray-300 rounded-xl px-2 py-2 bg-white text-sm focus:border-[#2f3a47] outline-none"
  placeholder="الكمية"
/>

<div className="relative">
  <input
    type="text"
    inputMode="decimal"
    value={disc === 0 ? "" : disc} // ✅ إذا القيمة صفر، خليه فارغ
    onChange={(e) => {
      const val = e.target.value;

      // ✅ لو المستخدم مسح الحقل بالكامل
      if (val.trim() === "") {
        setDisc("");
        return;
      }

      // ✅ نحاول نحول القيمة لرقم
      const num = Number(val);

      // 🚫 لو مو رقم صالح
      if (isNaN(num)) return;

      // 🔒 إذا عندنا خصم من SAP، لا نسمح بالزيادة
      if (discFromSAP > 0 && num > discFromSAP) {
        toast.error(`⚠️ لا يمكن تجاوز خصم SAP (${discFromSAP}%)`);
        return;
      }

      setDisc(num);
    }}
    placeholder="الخصم"
    className={`w-full border rounded-xl pl-2 pr-6 py-2 text-sm outline-none transition
      ${discFromSAP > 0
        ? "bg-white border-yellow-400 focus:border-yellow-500 text-gray-800"
        : "bg-white focus:border-[#2f3a47] border-gray-300"}`}
  />

  {Number(disc) > 0 && (
    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold">
      %
    </span>
  )}
</div>


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
  className="flex flex-col sm:flex-row items-center sm:items-start gap-5 bg-gradient-to-br from-white to-gray-50 border border-gray-300 rounded-2xl p-5 shadow-lg w-full max-w-4xl mx-auto"
>
  {/* 🖼️ صورة المادة */}
  <div className="relative">
    <img
      src={selectedItem.image || placeholder}
      onError={(e) => (e.target.src =placeholder)}
      alt={selectedItem.name}
      className="w-32 h-32 object-cover rounded-xl border border-gray-300 shadow-md"
    />
    <div className="absolute bottom-1 right-1 bg-[#2f3a47] text-white text-[10px] px-2 py-0.5 rounded-md shadow-md">
      {currency}
    </div>
  </div>

  {/* 🧾 تفاصيل المادة */}
  <div className="flex-1 text-[#2f3a47] space-y-3 w-full">
    <div>
      <h2 className="font-semibold text-xl mb-1">{selectedItem.name}</h2>
      <p className="text-gray-600 text-sm">{selectedItem.desc || "—"}</p>
    </div>

    {/* 📦 كروت المعلومات */}
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-2">
      {/* 🧩 Model */}
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-300 rounded-xl p-3 shadow-sm">
        <FiCpu className="text-[#2f3a47] text-lg" />
        <div>
          <div className="text-xs text-gray-500">Model</div>
          <div className="font-semibold text-gray-800 text-sm">
            {selectedItem.U_ST_Model || "—"}
          </div>
        </div>
      </div>

      {/* 🔩 Part No */}
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-300 rounded-xl p-3 shadow-sm">
        <FiBox className="text-[#2f3a47] text-lg" />
        <div>
          <div className="text-xs text-gray-500">Part No</div>
          <div className="font-semibold text-gray-800 text-sm">
            {selectedItem.U_ST_PartNo || "—"}
          </div>
        </div>
      </div>

      {/* 🏷️ Code */}
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-300 rounded-xl p-3 shadow-sm">
        <FiTag className="text-[#2f3a47] text-lg" />
        <div>
          <div className="text-xs text-gray-500">Code</div>
          <div className="font-semibold text-gray-800 text-sm">
            {selectedItem.code || selectedItem.ItemCode || "—"}
          </div>
        </div>
      </div>

      {/* ⚙️ SWW */}
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-300 rounded-xl p-3 shadow-sm">
        <FiSettings className="text-[#2f3a47] text-lg" />
        <div>
          <div className="text-xs text-gray-500">SWW</div>
          <div className="font-semibold text-gray-800 text-sm">
            {selectedItem.SWW || "—"}
          </div>
        </div>
      </div>
    </div>

    {/* 💰 السعر */}
    <div className="flex justify-end items-center mt-3 bg-[#2f3a47] text-white rounded-xl px-4 py-2 shadow-inner w-fit ml-auto">
      <FiHash className="text-white text-lg mr-2" />
      <span className="text-base font-semibold">
        {fmt(selectedItem.price)} {currency}
      </span>
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
            className={`border-b transition-colors duration-200 
              ${r.isSAPDiscount ? "bg-yellow-50 hover:bg-yellow-100" : "bg-white hover:bg-gray-100"}`}
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
              <td className="p-3 text-gray-800 font-medium">
  <input
    type="number"
    min={1}
    value={r.qty}
    onChange={(e) => {
      const val = Number(e.target.value);
      if (!val || val <= 0) return;
      updateCartItem(i, "qty", val);
    }}
    className="w-20 text-center border border-gray-300 rounded-lg px-2 py-1 focus:border-[#2f3a47] outline-none"
  />
</td>
              <td className="p-3 text-gray-800">
                {fmt(r.price)} {r.currency}
              </td>
              <td className="p-3 text-gray-800">
  <input
    type="number"
    min={0}
    value={r.disc}
    onChange={(e) => {
      const val = Number(e.target.value);
      if (isNaN(val)) return;

      // ✅ لا تسمح بالزيادة فوق خصم SAP
      if (discFromSAP > 0 && val > discFromSAP) {
        toast.error(`⚠️ لا يمكن تجاوز خصم SAP (${discFromSAP}%)`);
        return;
      }

      updateCartItem(i, "disc", val);
    }}
    className={`w-20 text-center border-2 rounded-lg px-2 py-1 outline-none transition
    ${
      r.isSAPDiscount
        ? "border-yellow-400 focus:border-yellow-500" // 🟡 فقط البوردر أصفر
        : "border-gray-300 focus:border-[#2f3a47]"    // ⚪ طبيعي
    }`}
  />
</td>
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
  </div>{/* 💰 الملخص حسب العملة */}
{Object.entries(totalsByCurrency).map(([currency, v]) => (
  <motion.div
    key={currency}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="mt-8 space-y-6 text-gray-800 text-sm"
  >
    <div className="bg-white/80 rounded-2xl shadow-md border border-gray-200 p-5">
      {/* 🔹 عنوان العملة */}
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 border-b border-gray-200 pb-2">
        <FaMoneyBills className="text-[#2f3a47]" />
        <span>{currency} Summary</span>
      </h3>

      {/* 🔸 الكروت داخل Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Before Discount */}
        <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl border border-gray-300 shadow-sm">
          <FaMoneyBills className="text-[#2f3a47] text-lg" />
          <div>
            <div className="text-xs text-gray-500">Before Discount</div>
            <div className="text-base font-semibold">
              {fmt(v.before)} {currency}
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
  </motion.div>
))}
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
  تم حفظ الطلب في النظام بنجاح.
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
                {fmt(totalQty)}  <b>إجمالي الكميات</b>
              </span>
            </div>

            <div className="flex items-center gap-2 bg-gray-100 p-3 rounded-xl border border-gray-300">
              <FaMoneyBills className="text-[#2f3a47] text-lg" />
              <span>
              {fmt(totalBeforeDiscount)} IQD <b>قبل الخصم</b> 
              </span>
            </div>

            <div className="flex items-center gap-2 bg-gray-100 p-3 rounded-xl border border-gray-300 text-red-600">
              <FiPercent className="text-red-600 text-lg" />
              <span>
               {fmt(totalDiscount)} IQD <b>الخصومات</b> 
              </span>
            </div>

            <div className="flex items-center gap-2 bg-[#2f3a47] text-white p-3 rounded-xl shadow-inner">
              <FiCreditCard className="text-white text-lg" />
              <span className="font-semibold">
                 {fmt(Number(grandTotal))} IQD المجموع النهائي
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