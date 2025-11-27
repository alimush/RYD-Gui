/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config) => {
      // يخلي ODBC والمكتبات الأصلية تشتغل طبيعي
      config.externals.push("odbc");
      return config;
    },
    experimental: {
      // 🔴 نعطّل Turbopack كلياً حتى "npm run dev" يشتغل بالـ Webpack العادي
      turbo: {
        rules: {}, // تعطيل دعم turbopack للملفات
      },
    },
    // نضمن التشغيل ببيئة Node.js حتى داخل الـ routes
    output: "standalone",
  };
  
  module.exports = nextConfig;