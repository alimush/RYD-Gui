"use client";

import { useState, useEffect, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiUser,
  FiPhone,
  FiMapPin,
  FiFileText,
  FiSend,
  FiCheckCircle,
  FiLoader,
} from "react-icons/fi";
import toast, { Toaster } from "react-hot-toast";
import { Listbox, Transition } from "@headlessui/react";

export default function CreateCustomerPage() {
  const [territories, setTerritories] = useState([]);
  const [selectedTerritory, setSelectedTerritory] = useState(null);
  const [form, setForm] = useState({
    CardName: "",
    AliasName: "",
    Notes: "",
    Phone1: "",
  });
  const [loading, setLoading] = useState(false);

  // 🟢 تحميل قائمة المناطق من API
  useEffect(() => {
    async function fetchTerritories() {
      try {
        const res = await fetch("/api/territories");
        const data = await res.json();
  
        if (Array.isArray(data)) {
          setTerritories(data);
          if (data.length > 0) setSelectedTerritory(data[0]); // ✅ اختار أول وحدة كديفولت
        } else {
          toast.error("⚠️ لم يتم العثور على مناطق");
        }
      } catch (err) {
        console.error("❌ Territory Fetch Error:", err);
        toast.error("فشل تحميل المناطق من SAP");
      }
    }
    fetchTerritories();
  

    // ✅ إذا كان هناك اسم زبون جديد محفوظ من صفحة البحث
    const storedName = localStorage.getItem("newCustomerName");
    if (storedName) {
      setForm((prev) => ({ ...prev, CardName: storedName }));
      localStorage.removeItem("newCustomerName");
    }
  }, []);

  // 🟢 معالجة تغيير القيم داخل الحقول
  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  // 🟢 حفظ وإنشاء الزبون في SAP
  const handleSubmit = async (e) => {
    e.preventDefault();
    const { CardName, AliasName, Notes, Phone1 } = form;

    if (!CardName || !selectedTerritory) {
      toast.error("يرجى إدخال اسم الزبون واختيار المنطقة");
      return;
    }

    setLoading(true);
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      if (!user?.sapUser || !user?.sapPass)
        return toast.error("بيانات دخول SAP غير متوفرة");

      const payload = {
        CardName,
        AliasName,
        Notes,
        Phone1,
        Territory: selectedTerritory?.ID,
        sapUser: user.sapUser,
        sapPass: user.sapPass,
      };

      const res = await fetch("/api/customers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل إنشاء الزبون");

      toast.success("✅ تم إنشاء الزبون بنجاح");

      // 🟢 خزّن بيانات الزبون الجديد مؤقتًا حتى تظهر في صفحة أوامر البيع
      localStorage.setItem(
        "newCreatedCustomer",
        JSON.stringify({
          CardCode: data.data?.CardCode || data.CardCode,
          CardName,
          Phone1,
        })
      );

      // ✅ انتقل إلى صفحة أوامر البيع بعد ثانية
      setTimeout(() => {
        window.location.href = "/sales-order";
      }, 1000);
    } catch (err) {
      console.error("❌ Create Customer Error:", err);
      toast.error(err.message || "فشل الاتصال بـ SAP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 flex items-center justify-center p-6">
      <Toaster position="top-center" />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white shadow-2xl rounded-3xl p-8 w-full max-w-3xl border border-gray-200"
      >
        <h1 className="text-3xl font-bold text-[#2f3a47] mb-6 flex items-center gap-3">
          <FiUser className="text-[#2f3a47]" /> إنشاء زبون جديد
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* اسم الزبون */}
          <div>
            <label className="block mb-1 text-gray-700 font-medium">
              اسم الزبون
            </label>
            <input
              name="CardName"
              value={form.CardName}
              onChange={handleChange}
              placeholder="أدخل اسم الزبون"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:border-[#2f3a47] outline-none"
              required
            />
          </div>

          {/* اسم الشركة */}
          <div>
            <label className="block mb-1 text-gray-700 font-medium">
              اسم الشركة
            </label>
            <input
              name="AliasName"
              value={form.AliasName}
              onChange={handleChange}
              placeholder="أدخل اسم الشركة"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:border-[#2f3a47] outline-none"
            />
          </div>

          {/* الهاتف */}
          <div>
            <label className="block mb-1 text-gray-700 font-medium">
              رقم الهاتف
            </label>
            <input
              name="Phone1"
              value={form.Phone1}
              onChange={handleChange}
              placeholder="أدخل رقم الهاتف"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:border-[#2f3a47] outline-none"
            />
          </div>

          {/* العنوان */}
          <div>
            <label className="block mb-1 text-gray-700 font-medium">
              العنوان
            </label>
            <textarea
              name="Notes"
              value={form.Notes}
              onChange={handleChange}
              placeholder="أدخل عنوان الزبون"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:border-[#2f3a47] outline-none resize-none"
              rows={3}
            />
          </div>

          {/* المنطقة */}
          <div>
            <label className="block mb-1 text-gray-700 font-medium">
              المنطقة (Territory)
            </label>
            <Listbox value={selectedTerritory} onChange={setSelectedTerritory}>
              <div className="relative">
                <Listbox.Button className="w-full border border-gray-300 rounded-xl px-3 py-2 text-right bg-white">
                  {selectedTerritory
                    ? selectedTerritory.Name
                    : "اختر المنطقة"}
                </Listbox.Button>
                <Transition
                  as={Fragment}
                  leave="transition ease-in duration-100"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <Listbox.Options className="absolute left-0 mt-2 w-full bg-white border border-gray-300 rounded-xl shadow-2xl text-sm z-50 max-h-[120px] overflow-y-auto">
                    {territories.map((t) => (
                      <Listbox.Option
                        key={t.ID}
                        value={t}
                        className={({ active }) =>
                          `px-4 py-2 cursor-pointer ${
                            active ? "bg-gray-100" : ""
                          }`
                        }
                      >
                        {t.ID} — {t.Name}
                      </Listbox.Option>
                    ))}
                  </Listbox.Options>
                </Transition>
              </div>
            </Listbox>
          </div>

          {/* زر الحفظ */}
          <div className="pt-4">
            <motion.button
              whileHover={{ scale: loading ? 1 : 1.05 }}
              whileTap={{ scale: loading ? 1 : 0.97 }}
              disabled={loading}
              type="submit"
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold ${
                loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-[#2f3a47] hover:bg-[#1e2832]"
              }`}
            >
              {loading ? (
                <>
                  <FiLoader className="animate-spin" />
                  جارٍ الإنشاء...
                </>
              ) : (
                <>
                  <FiSend /> إنشاء الزبون
                </>
              )}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}