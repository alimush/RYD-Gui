"use client";
import { useState, useEffect } from "react";
import {
  FaUserCircle,
  FaBars,
  FaUserPlus,
  FaSignOutAlt,
  FaTasks,
} from "react-icons/fa";
import { BiSolidReport } from "react-icons/bi";
import { TiHome } from "react-icons/ti";
import { motion, AnimatePresence } from "framer-motion";
import { Poppins } from "next/font/google";
import { useRouter, usePathname } from "next/navigation";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export default function Header({ onLogout }) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [username, setUsername] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const updateUser = () => {
      const storedUser = localStorage.getItem("username");
      const storedRole = localStorage.getItem("role");
      setUsername(storedUser || null);
      setRole(storedRole || "user");
      if (!storedUser) setMenuOpen(false);
    };
    updateUser();
    window.addEventListener("userChanged", updateUser);
    return () => window.removeEventListener("userChanged", updateUser);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("username");
    localStorage.removeItem("role");
    setUsername(null);
    setRole(null);
    window.dispatchEvent(new Event("userChanged"));
    if (onLogout) onLogout();
    router.push("/login");
  };

  return (
    <motion.header
      initial={{ y: "-100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "-100%", opacity: 0 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className="sticky top-0 z-50 w-full
                 backdrop-blur-xl border-b border-gray-800/60
                 bg-gradient-to-b from-gray-800 via-gray-750 to-gray-900
                 shadow-[0_4px_24px_rgba(0,0,0,0.7)]"
    >
      <div className="w-full grid grid-cols-3 items-center px-6 h-16">
        {/* يسار */}
        <div className="flex flex-col items-start leading-tight">
          <span
            className={`font-bold text-2xl tracking-tight
                        bg-gradient-to-r from-gray-300 via-gray-100 to-white
                        text-transparent bg-clip-text ${poppins.className}`}
          >
            SPC
          </span>
          <span className={`text-[11px] text-gray-300 ${poppins.className}`}>
            Developed by SPC Team
          </span>
        </div>

        {/* الوسط */}
        <div className="flex justify-center">
          <h1
            className="text-base sm:text-lg md:text-2xl font-bold tracking-tight
                       bg-gradient-to-r from-gray-200 via-gray-100 to-white
                       text-transparent bg-clip-text"
          >
            Sales Order Portal
          </h1>
        </div>

        {/* يمين */}
        <div className="flex justify-end items-center relative">
          <AnimatePresence>
            {pathname !== "/login" && username && (
              <motion.div
                key="user-cluster"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="flex items-center gap-3"
              >
                {/* بطاقة المستخدم */}
                <motion.div
                  whileHover={{ scale: 1.04 }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl
                             bg-gray-800/80 border border-gray-600 shadow-sm"
                >
                  <FaUserCircle className="text-gray-200 text-2xl" />
                  <span className="text-sm font-medium text-gray-100">
                    {username}
                  </span>
                </motion.div>

                {/* زر القائمة */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={() => setMenuOpen((v) => !v)}
                  className={`p-2 rounded-xl border transition 
                    ${
                      menuOpen
                        ? "bg-gray-700 border-gray-500"
                        : "bg-gray-800 hover:bg-gray-700 border-gray-600"
                    }`}
                  aria-label="menu"
                >
                  <motion.div
                    animate={{ rotate: menuOpen ? 90 : 0 }}
                    transition={{ duration: 0.35 }}
                  >
                    <FaBars className="text-gray-200 text-lg" />
                  </motion.div>
                </motion.button>

                {/* القائمة */}
                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      key="menu"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.35, ease: "easeInOut" }}
                      className="absolute right-0 top-12 w-56 overflow-hidden rounded-2xl
                                 border border-gray-600 bg-gray-800 shadow-xl"
                    >
                      <div className="p-1">
                        <MenuItem
                          onClick={() => {
                            setMenuOpen(false);
                            router.push("/home");
                          }}
                          icon={<TiHome className="text-gray-200" />}
                          label="Home"
                        />
                        <MenuItem
                          onClick={() => {
                            setMenuOpen(false);
                            router.push("/sales-orders");
                          }}
                          icon={<FaTasks className="text-gray-200" />}
                          label="Sales Orders"
                        />
                        {role === "admin" && (
                          <MenuItem
                            onClick={() => {
                              setMenuOpen(false);
                              router.push("/register");
                            }}
                            icon={<FaUserPlus className="text-gray-200" />}
                            label="Create User"
                          />
                        )}
                        {role === "admin" && (
                          <MenuItem
                            onClick={() => {
                              setMenuOpen(false);
                              router.push("/reports");
                            }}
                            icon={<BiSolidReport className="text-gray-200" />}
                            label="Reports"
                          />
                        )}
                        <MenuItem
                          onClick={handleLogout}
                          icon={<FaSignOutAlt className="text-red-400" />}
                          label="Logout"
                          danger
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.header>
  );
}

/* 🔹 عنصر المنيو */
function MenuItem({ onClick, icon, label, danger = false }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm rounded-xl transition
        ${
          danger
            ? "text-red-400 hover:bg-red-900/40"
            : "text-gray-200 hover:bg-gray-700"
        }`}
    >
      <span className="text-base">{icon}</span>
      <span className="font-medium">{label}</span>
    </motion.button>
  );
}