import { NextResponse } from "next/server";
import sql from "mssql";

const MSSQL_CONFIG = {
  user: "sa",
  password: "M@mm1234",
  server: "172.30.30.237",
  database: "master",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

export async function POST(req) {
  try {
    const { username, password } = await req.json();

    // 🔸 تحقق أساسي من المدخلات
    if (!username?.trim() || !password?.trim()) {
      return NextResponse.json(
        { error: "يرجى إدخال اسم المستخدم وكلمة المرور" },
        { status: 400 }
      );
    }

    // 🔹 الاتصال بقاعدة البيانات
    const pool = await sql.connect(MSSQL_CONFIG);

    const query = `
      SELECT TOP 1
        [username],
        [pass],
        [RepID],
        [sapuser],
        [sappass],
        [fullname],
        [dis],
        [location],
        [department],
        [Currency],
        [tcash]
      FROM [master].[dbo].[SaleOrderLogin]
      WHERE LTRIM(RTRIM([username])) = @username
        AND LTRIM(RTRIM([pass])) = @password
    `;

    const result = await pool
      .request()
      .input("username", sql.VarChar, username.trim())
      .input("password", sql.VarChar, password.trim())
      .query(query);

    await pool.close();

    // 🔸 تحقق من وجود المستخدم
    if (!result.recordset?.length) {
      return NextResponse.json(
        { error: "❌ اسم المستخدم أو كلمة المرور غير صحيحة" },
        { status: 401 }
      );
    }

    const user = result.recordset[0];
    const department = user.department?.trim()?.toLowerCase() || "";

    // ✅ إعداد الاستجابة بناءً على نوع الـ department
    let mode = "department-based";
    let message = "⚙️ مستخدم عادي - الأسعار والعملة حسب القسم";

    if (department === "project") {
      mode = "select-sale-order";
      message = "🏗️ مستخدم قسم المشاريع - الأسعار حسب إعدادات أمر البيع";
    }

    // ✅ إرجاع بيانات المستخدم
    return NextResponse.json({
      success: true,
      message,
      mode,
      user: {
        username: user.username?.trim(),
        fullname: user.fullname?.trim(),
        RepID: user.RepID,
        sapUser: user.sapuser?.trim(),
        sapPass: user.sappass?.trim(),
        department: user.department?.trim(),
        location: user.location?.trim(),
        currency: user.Currency?.trim(),
        tcash: user.tcash,
        dis: user.dis,
      },
    });
  } catch (err) {
    console.error("❌ Login Error:", err);
    return NextResponse.json(
      { error: "خطأ في الاتصال بقاعدة البيانات أو تنفيذ الاستعلام" },
      { status: 500 }
    );
  }
}