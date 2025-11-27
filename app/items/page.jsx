"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { FiSearch, FiDownload, FiBox } from "react-icons/fi";
import { motion } from "framer-motion";

export default function ItemStockPage() {
  const [data, setData] = useState([]);
  const [query, setQuery] = useState("");
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(false);

  // 🟢 تحميل بيانات الستوك من API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/item-stock");
        const rows = await res.json();
        setData(rows);
        setFiltered(rows);
      } catch (err) {
        console.error("❌ فشل جلب بيانات الستوك:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 🔍 فلترة حسب الكود أو الاسم أو الموديل أو البارت نمبر
  useEffect(() => {
    if (!query) return setFiltered(data);
    const s = query.trim().toLowerCase();
    const f = data.filter(
      (i) =>
        i.ItemCode?.toLowerCase().includes(s) ||
        i.ItemName?.toLowerCase().includes(s) ||
        i.U_ST_Model?.toLowerCase().includes(s) ||
        i.U_ST_PartNo?.toLowerCase().includes(s)
    );
    setFiltered(f);
  }, [query, data]);

  // 📦 تصدير Excel
  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filtered);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Item Stock");
    XLSX.writeFile(wb, "item_stock.xlsx");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 text-gray-900 p-6 flex flex-col items-center">
      <div className="w-full max-w-6xl space-y-6">
        {/* العنوان */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold flex items-center gap-2 text-[#2f3a47]">
            <FiBox /> تقرير المخزون (Item Stock)
          </h1>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border bg-gray-100 hover:bg-gray-200 text-sm font-medium"
          >
            <FiDownload /> تصدير Excel
          </button>
        </div>

        {/* مربع البحث */}
        <div className="relative">
          <div className="flex items-center gap-3 bg-white border border-gray-300 rounded-xl px-4 py-2 shadow-sm focus-within:border-[#2f3a47] transition-all">
            <FiSearch className="text-[#2f3a47] text-lg" />
            <input
              type="text"
              placeholder="ابحث عن المادة بالكود، الاسم، الموديل أو رقم القطعة..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent outline-none text-gray-800"
            />
          </div>
        </div>

        {/* الجدول */}
        <div className="bg-white border border-gray-300 rounded-2xl shadow-lg overflow-hidden">
          <table className="w-full text-sm text-right border-collapse">
            <thead className="bg-[#2f3a47] text-white">
              <tr>
                <th className="p-3">الكود</th>
                <th className="p-3">اسم المادة</th>
                <th className="p-3">الموديل</th>
                <th className="p-3">رقم القطعة</th>
                <th className="p-3 text-center">الكمية المتاحة</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="5"
                    className="text-center py-6 text-gray-500 font-medium"
                  >
                    جاري تحميل البيانات...
                  </td>
                </tr>
              ) : filtered.length ? (
                filtered.map((row, i) => (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-b hover:bg-gray-50"
                  >
                    <td className="p-3 font-semibold text-gray-800">
                      {row.ItemCode}
                    </td>
                    <td className="p-3 text-gray-700">{row.ItemName}</td>
                    <td className="p-3 text-gray-600">{row.U_ST_Model || "—"}</td>
                    <td className="p-3 text-gray-600">{row.U_ST_PartNo || "—"}</td>
                    <td className="p-3 text-center font-bold text-[#2f3a47]">
                      {Number(row.TotalAvailable).toLocaleString()}
                    </td>
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="5"
                    className="text-center py-6 text-gray-500 font-medium"
                  >
                    لا توجد نتائج مطابقة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}