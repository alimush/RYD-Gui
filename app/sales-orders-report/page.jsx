"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiSearch,
  FiUser,
  FiCalendar,
  FiHash,
} from "react-icons/fi";
import toast, { Toaster } from "react-hot-toast";
import ReportPopup from "@/components/ReportPopup";

export default function SalesOrdersReport() {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [docNum, setDocNum] = useState("");
  const [date, setDate] = useState({ from: "", to: "" });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // 🧭 تحميل أوامر البيع للمستخدم الحالي
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) return (window.location.href = "/login");
    fetchOrders(user.sapUser, user.sapPass, user.RepID);
  }, []);

  // 🟢 جلب أوامر البيع من الـ API
  const fetchOrders = async (sapUser, sapPass, RepID) => {
    setLoading(true);
    try {
      const res = await fetch("/api/sales-orders-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sapUser, sapPass, RepID }),
      });

      const data = await res.json();

      if (res.ok) {
        const ordersWithStatus = data.orders.map((o) => {
          const docStatus = (o.DocStatus || "").toUpperCase();
          const docStat2 = (o.DocumentStatus || "").toUpperCase();

          const canceledField =
            o.CANCELED ??
            o.Canceled ??
            o.Cancelled ??
            o.DocCanceled ??
            o.DocCancelled ??
            "";

          const canceled =
            typeof canceledField === "boolean"
              ? canceledField
              : ["Y", "YES", "CANCELED", "CANCELLED"].includes(
                  String(canceledField).toUpperCase()
                );

          let Status = "Open";
          if (canceled) Status = "Canceled";
          else if (
            ["C", "CLOSED", "BOST_CLOSE", "CLOSE"].includes(docStatus) ||
            ["C", "CLOSED", "BOST_CLOSE", "CLOSE"].includes(docStat2)
          )
            Status = "Closed";

          return { ...o, Status };
        });

        setOrders(ordersWithStatus);
        setFilteredOrders(ordersWithStatus);
      } else toast.error(data.error || "فشل جلب أوامر البيع");
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  // 🟡 اقتراحات الزبائن (autocomplete)
  useEffect(() => {
    const s = search.trim();
    if (!s) return setCustomerSuggestions([]);

    const fetchCustomers = async () => {
      try {
        const res = await fetch(`/api/customers?q=${encodeURIComponent(s)}`);
        const data = await res.json();
        setCustomerSuggestions(data.slice(0, 10));
      } catch (err) {
        console.error("❌ فشل جلب اقتراحات الزبائن:", err);
      }
    };

    fetchCustomers();
  }, [search]);

  // 🧮 فلترة الأوامر
  useEffect(() => {
    let filtered = [...orders];

    // ✅ فلترة بناءً على الزبون المختار من الاقتراحات
    if (selectedCustomer) {
      filtered = filtered.filter(
        (o) => o.CardCode === selectedCustomer.CardCode
      );
    }

    if (docNum.trim()) {
      filtered = filtered.filter((o) =>
        String(o.DocNum).includes(docNum.trim())
      );
    }

    if (date.from) {
      filtered = filtered.filter(
        (o) => new Date(o.DocDate) >= new Date(date.from)
      );
    }
    if (date.to) {
      const end = new Date(date.to);
      end.setHours(23, 59, 59);
      filtered = filtered.filter((o) => new Date(o.DocDate) <= end);
    }

    setFilteredOrders(filtered);
  }, [orders, selectedCustomer, docNum, date]);

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      <Toaster position="top-center" />

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
          <FiHash /> Sales Orders Report
        </h1>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 bg-white rounded-2xl p-6 shadow-md border border-gray-200 mb-6">
        {/* Customer Filter */}
<div className="relative">
  <label className="text-sm text-gray-600 mb-1 flex items-center gap-2">
    <FiSearch /> Customer
  </label>

  <div className="flex items-center gap-2 bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 shadow-sm relative">
    <FiUser className="text-gray-600" />
    <input
      value={search}
      onChange={(e) => {
        setSearch(e.target.value);
        setSelectedCustomer(null);
      }}
      placeholder="Search customer..."
      className="w-full outline-none bg-transparent text-gray-800"
    />
    {/* زر X لمسح النص */}
    {search && (
      <button
        onClick={() => {
          setSearch("");
          setSelectedCustomer(null);
          setCustomerSuggestions([]);
        }}
        className="text-gray-400 hover:text-gray-600 transition absolute right-3"
      >
        ✕
      </button>
    )}
  </div>


          {/* Suggestions */}
          <AnimatePresence>
            {search && !selectedCustomer && customerSuggestions.length > 0 && (
              <motion.ul
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-56 overflow-y-auto"
              >
                {customerSuggestions.map((cust) => (
                  <li key={cust.CardCode}>
                    <button
                      onClick={() => {
                        setSelectedCustomer(cust);
                        setSearch(`${cust.CardCode} — ${cust.CardName}`);
                        setCustomerSuggestions([]);
                      }}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                    >
                      {cust.CardCode} — {cust.CardName}
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>

        {/* Order Filter */}
        <div>
          <label className="text-sm text-gray-600 mb-1 flex items-center gap-2">
            <FiHash /> Order #
          </label>
          <input
            type="text"
            value={docNum}
            onChange={(e) => setDocNum(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-2 text-gray-800"
          />
        </div>

        {/* Date Filters */}
        <div>
          <label className="text-sm text-gray-600 mb-1 flex items-center gap-2">
            <FiCalendar /> From
          </label>
          <input
            type="date"
            value={date.from}
            onChange={(e) => setDate({ ...date, from: e.target.value })}
            className="w-full border border-gray-300 rounded-lg p-2 text-gray-800"
          />
        </div>

        <div>
          <label className="text-sm text-gray-600 mb-1 flex items-center gap-2">
            <FiCalendar /> To
          </label>
          <input
            type="date"
            value={date.to}
            onChange={(e) => setDate({ ...date, to: e.target.value })}
            className="w-full border border-gray-300 rounded-lg p-2 text-gray-800"
          />
        </div>
      </div>

      {/* Table */}
      <AnimatePresence mode="wait">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28">
            <motion.div className="w-12 h-12 border-4 border-gray-200 border-t-gray-700 rounded-full animate-spin" />
            <p className="mt-4 text-gray-600 font-medium">Loading Orders...</p>
          </div>
        ) : filteredOrders.length > 0 ? (
          <motion.div
            key="table"
            className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
          <table className="min-w-full text-sm text-gray-700 border-collapse">
  {/* 🎨 الهيدر بلون موحد أنيق */}
  <thead className="bg-gray-700 text-white uppercase text-xs tracking-wide border-b border-gray-300">
    <tr>
      <th className="px-5 py-3 text-left font-semibold w-[8%]">Order #</th>
      <th className="px-5 py-3 text-left font-semibold w-[32%]">Customer</th>
      <th className="px-5 py-3 text-center font-semibold w-[14%]">Date</th>
      <th className="px-5 py-3 text-right font-semibold w-[18%]">Total</th>
      <th className="px-5 py-3 text-center font-semibold w-[8%]">Currency</th>
      <th className="px-5 py-3 text-center font-semibold w-[10%]">Status</th>
    </tr>
  </thead>

  <tbody>
    {filteredOrders
      .filter(
        (o) =>
          !["C", "CLOSED", "CANCELED", "CANCELLED"].includes(
            (o.DocStatus || o.Status || "").toUpperCase()
          )
      )
      .map((o, i) => (
        <tr
          key={o.DocEntry}
          onClick={() => setSelectedOrder(o)}
          className={`border-t border-gray-200 transition-colors duration-150 hover:bg-gray-50 ${
            i % 2 === 0 ? "bg-white" : "bg-gray-50"
          }`}
        >
          {/* رقم الأوردر */}
          <td className="px-5 py-3 font-semibold text-gray-800 whitespace-nowrap">
            {o.DocNum}
          </td>

          {/* اسم الزبون */}
          <td className="px-5 py-3 text-gray-700 truncate">
            {o.CardName}
          </td>

          {/* التاريخ */}
          <td className="px-5 py-3 text-center text-gray-600 whitespace-nowrap">
            {new Date(o.DocDate).toLocaleDateString("en-GB")}
          </td>

          {/* الإجمالي */}
          <td className="px-5 py-3 text-right font-semibold text-gray-800 whitespace-nowrap">
            {(
              o.DocumentLines?.reduce(
                (sum, r) =>
                  sum +
                  (r.Quantity *
                    r.UnitPrice *
                    (1 - (r.DiscountPercent || 0) / 100)),
                0
              ) || 0
            ).toLocaleString()}
          </td>

          {/* العملة بعد التوتال */}
          <td
            className={`px-5 py-3 text-center font-medium whitespace-nowrap ${
              o.DocCurrency === "USD"
                ? "text-blue-600"
                : o.DocCurrency === "EUR"
                ? "text-purple-600"
                : "text-green-700"
            }`}
          >
            {o.DocCurrency || "IQD"}
          </td>

          {/* الحالة */}
          <td className="px-5 py-3 text-center">
            {o.Status === "Closed" ? (
              <span className="px-3 py-1 text-xs rounded-full border border-gray-400 bg-gray-100 text-gray-700 font-medium">
                Closed
              </span>
            ) : o.Status === "Canceled" ? (
              <span className="px-3 py-1 text-xs rounded-full border border-red-300 bg-red-50 text-red-700 font-medium">
                Canceled
              </span>
            ) : (
              <span className="px-3 py-1 text-xs rounded-full border border-green-300 bg-green-50 text-green-700 font-medium">
                Open
              </span>
            )}
          </td>
        </tr>
      ))}
  </tbody>
</table>
          </motion.div>
        ) : (
          <div className="text-center text-gray-500 italic py-20 bg-white rounded-2xl border border-gray-200 shadow">
            No sales orders found
          </div>
        )}
      </AnimatePresence>

      {/* Popup */}
      {selectedOrder && (
  <ReportPopup
  order={selectedOrder}
  onClose={() => setSelectedOrder(null)}
  onCanceled={(docEntry) => {
    setOrders((prev) => prev.filter((o) => o.DocEntry !== docEntry));
    setFilteredOrders((prev) => prev.filter((o) => o.DocEntry !== docEntry));
    setSelectedOrder(null);
    // toast.success("🗑️ تم إلغاء الأوردر وإزالته من القائمة");
  }}
  onUpdated={() => {
    // 🔄 إعادة تحميل البيانات من الـ API بدون ريفرش البراوزر
    const user = JSON.parse(localStorage.getItem("user"));
    if (user) fetchOrders(user.sapUser, user.sapPass, user.RepID);
    setSelectedOrder(null);
    // toast.success("✅ تم حفظ التعديلات وتحديث الصفحة");
  }}
/>
)}
    </motion.div>
  );
}