"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaChartBar, FaTrophy, FaMedal } from "react-icons/fa";
import toast, { Toaster } from "react-hot-toast";

function formatRevenue(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function rankStyle(rank) {
  if (rank === 1) {
    return {
      badge: "bg-amber-100 text-amber-800 border-amber-300",
      bar: "bg-gradient-to-l from-amber-500 to-amber-300",
      card: "border-amber-200 bg-amber-50/40",
      chart: "#d97706",
    };
  }
  if (rank === 2) {
    return {
      badge: "bg-slate-200 text-slate-700 border-slate-300",
      bar: "bg-gradient-to-l from-slate-500 to-slate-300",
      card: "border-slate-200 bg-slate-50/60",
      chart: "#64748b",
    };
  }
  if (rank === 3) {
    return {
      badge: "bg-orange-100 text-orange-800 border-orange-300",
      bar: "bg-gradient-to-l from-orange-600 to-orange-300",
      card: "border-orange-200 bg-orange-50/40",
      chart: "#ea580c",
    };
  }
  return {
    badge: "bg-gray-100 text-gray-700 border-gray-300",
    bar: "bg-gradient-to-l from-gray-700 to-gray-400",
    card: "border-gray-200 bg-white",
    chart: "#4b5563",
  };
}

function RankIcon({ rank }) {
  if (rank === 1) return <FaTrophy className="text-amber-500" />;
  if (rank <= 3) return <FaMedal className={rank === 2 ? "text-slate-500" : "text-orange-500"} />;
  return <span className="font-bold">{rank}</span>;
}

function SimpleBarChart({ data }) {
  if (!data.length) return null;

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);
  const width = 640;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 56, left: 16 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const gap = 12;
  const barW = (chartW - gap * (data.length - 1)) / data.length;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[320px] h-auto"
        role="img"
        aria-label="مخطط أفضل 6 مندوبي مبيعات"
      >
        {data.map((item, index) => {
          const rank = index + 1;
          const style = rankStyle(rank);
          const barH = Math.max((item.revenue / maxRevenue) * chartH, 4);
          const x = padding.left + index * (barW + gap);
          const y = padding.top + chartH - barH;
          const label =
            item.salesman.length > 10
              ? `${item.salesman.slice(0, 10)}…`
              : item.salesman;

          return (
            <g key={`${item.salesman}-${rank}`}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx="6"
                fill={style.chart}
              />
              <text
                x={x + barW / 2}
                y={y - 6}
                textAnchor="middle"
                className="fill-gray-700"
                fontSize="11"
                fontWeight="600"
              >
                {formatRevenue(item.revenue)}
              </text>
              <text
                x={x + barW / 2}
                y={height - 28}
                textAnchor="middle"
                className="fill-gray-600"
                fontSize="11"
              >
                {label}
              </text>
              <text
                x={x + barW / 2}
                y={height - 10}
                textAnchor="middle"
                className="fill-gray-400"
                fontSize="10"
              >
                #{rank}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function SalesStatisticsPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const department = user.department?.trim();
    const location = user.location?.trim();

    if (!department || !location) {
      setError("تعذر تحديد القسم أو الموقع من بيانات المستخدم.");
      setLoading(false);
      return;
    }

    const fetchStatistics = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ department, location });
        const res = await fetch(`/api/reports/sales-statistics?${params}`);
        const json = await res.json();

        if (!res.ok || !json.success) {
          const message = json.error || "فشل جلب إحصائيات المبيعات";
          setError(message);
          toast.error(message);
          setData([]);
          return;
        }

        setData(Array.isArray(json.data) ? json.data.slice(0, 6) : []);
      } catch (err) {
        console.error(err);
        const message = "حدث خطأ أثناء تحميل البيانات";
        setError(message);
        toast.error(message);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchStatistics();
  }, []);

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <motion.div
      dir="rtl"
      className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 p-4 sm:p-6 lg:p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Toaster position="top-center" />

      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-3">
          <FaChartBar className="text-gray-700" />
          إحصائيات المبيعات
        </h1>
        <p className="mt-2 text-sm sm:text-base text-gray-600">
          أفضل 6 مندوبي مبيعات للشهر الحالي
        </p>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-28 bg-white rounded-2xl border border-gray-200 shadow"
          >
            <div className="w-12 h-12 border-4 border-gray-200 border-t-gray-700 rounded-full animate-spin" />
            <p className="mt-4 text-gray-600 font-medium">
              جاري تحميل الإحصائيات...
            </p>
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-center py-20 bg-white rounded-2xl border border-red-200 shadow"
          >
            <p className="text-red-600 font-medium mb-2">تعذر تحميل التقرير</p>
            <p className="text-gray-500 text-sm px-4">{error}</p>
          </motion.div>
        ) : data.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-center text-gray-500 italic py-20 bg-white rounded-2xl border border-gray-200 shadow"
          >
            لا توجد بيانات مبيعات لهذا الشهر
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">
                مقارنة الإيرادات
              </h2>
              <SimpleBarChart data={data} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:gap-4">
              {data.map((item, index) => {
                const rank = index + 1;
                const style = rankStyle(rank);
                const widthPct = Math.max(
                  (item.revenue / maxRevenue) * 100,
                  4
                );

                return (
                  <motion.div
                    key={`${item.salesman}-${rank}`}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`rounded-2xl border shadow-sm p-4 sm:p-5 ${style.card}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                      <div
                        className={`flex items-center justify-center w-11 h-11 rounded-full border shrink-0 ${style.badge}`}
                        aria-label={`المرتبة ${rank}`}
                      >
                        <RankIcon rank={rank} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm text-gray-500 font-medium shrink-0">
                              {rank}.
                            </span>
                            <h3 className="text-base sm:text-lg font-semibold text-gray-800 truncate">
                              {item.salesman || "—"}
                            </h3>
                          </div>
                          <p className="text-base sm:text-lg font-bold text-gray-800 whitespace-nowrap">
                            {formatRevenue(item.revenue)}{" "}
                            <span className="text-sm font-medium text-gray-500">
                              د.ع
                            </span>
                          </p>
                        </div>

                        <div className="h-2.5 w-full rounded-full bg-gray-200/80 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${widthPct}%` }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            className={`h-full rounded-full ${style.bar}`}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
