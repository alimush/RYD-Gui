"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { FaUser, FaLock, FaUserCircle } from "react-icons/fa";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!username || !password) return toast.error("أدخل البيانات كاملة");
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success("تم تسجيل الدخول بنجاح");

        // ✅ خزن بيانات المستخدم كاملة
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("mode", data.mode); // ✅ يخزن نوع المستخدم (Project أو غيره)
        window.dispatchEvent(new Event("userChanged"));

        // ✅ أنشئ كوكي للجلسة (يُستخدم في الـ middleware)
        document.cookie = "userLoggedIn=true; path=/; max-age=86400";

        // 🔁 انتقل إلى صفحة أوامر البيع
        setTimeout(() => router.push("/sales-order"), 1000);
      } else {
        toast.error(data.error || "❌ فشل تسجيل الدخول");
      }
    } catch (err) {
      console.error(err);
      toast.error("⚠️ خطأ في الاتصال بالسيرفر");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center 
                 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 relative overflow-hidden"
    >
      <Toaster position="top-center" />

      {/* background decorations */}
      <div className="absolute -top-40 -left-32 w-[30rem] h-[30rem] rounded-full bg-gray-300/20 blur-3xl" />
      <div className="absolute -bottom-40 -right-32 w-[28rem] h-[28rem] rounded-full bg-slate-400/20 blur-3xl" />

      <motion.form
        onSubmit={handleLogin}
        className="relative bg-white/50 shadow-xl rounded-2xl p-8 w-96 
                   space-y-6 text-gray-800 backdrop-blur-xl border border-gray-200/60"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        {/* user icon */}
        <motion.div
          className="flex justify-center mb-2 text-gray-700"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <FaUserCircle className="text-6xl drop-shadow-md" />
        </motion.div>

        {/* title */}
        <motion.h1
          className="text-2xl font-bold text-center 
                     bg-gradient-to-r from-gray-600 via-slate-700 to-gray-900 
                     text-transparent bg-clip-text"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          Sign in
        </motion.h1>

        {/* username input */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-600">
            <FaUser />
          </span>
          <motion.input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border rounded-lg p-3 pl-10 
                       focus:ring-2 focus:ring-gray-400 outline-none 
                       text-gray-900 bg-white/70"
            required
            whileFocus={{ scale: 1.02 }}
          />
        </div>

        {/* password input */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-600">
            <FaLock />
          </span>
          <motion.input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-lg p-3 pl-10 
                       focus:ring-2 focus:ring-gray-400 outline-none 
                       text-gray-900 bg-white/70"
            required
            whileFocus={{ scale: 1.02 }}
          />
        </div>

        {/* login button */}
        <motion.button
          type="submit"
          disabled={loading}
          className={`w-full bg-gradient-to-r from-gray-500 via-slate-600 to-gray-800 
                     text-white font-bold p-3 rounded-lg shadow-lg 
                     hover:from-gray-600 hover:to-gray-900 transition
                     ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {loading ? 'جاري الدخول...' : 'Login'}
        </motion.button>
      </motion.form>
    </div>
  );
}