// ✅ تجاهل SSL في بيئة التطوير فقط
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { NextResponse } from "next/server";
import axios from "axios";

const SAP_BASE_URL = "https://hanab1:50000/b1s/v1";

export async function POST(req) {
  try {
    const { sapUser, sapPass, RepID } = await req.json();

    if (!sapUser || !sapPass)
      return NextResponse.json(
        { error: "بيانات الدخول إلى SAP غير موجودة" },
        { status: 400 }
      );

    console.log(`🔐 تسجيل الدخول في SAP بواسطة: ${sapUser}`);
    const loginRes = await axios.post(`${SAP_BASE_URL}/Login`, {
      CompanyDB: "DEMO_RYD_05102025", // ← غيّرها إذا لازم
      UserName: sapUser,
      Password: sapPass,
    });

    const sessionId = loginRes.data.SessionId;
    console.log(`✅ تسجيل دخول ناجح في SAP`);

    // 🧭 فلترة الأوامر حسب RepID
    let query = "";
    if (RepID && Number(RepID) !== 0) {
      // فقط أوامر المندوب
      query = `?$filter=SalesPersonCode eq ${RepID}&$orderby=DocEntry desc&$top=50`;
      console.log(`📋 فلترة حسب المندوب: SalesPersonCode = ${RepID}`);
    } else {
      // المدير يشوف الكل
      query = `?$orderby=DocEntry desc&$top=50`;
      console.log("📋 المدير يشاهد كل الأوامر");
    }

    // 🟢 جلب الأوامر من SAP
    const res = await axios.get(`${SAP_BASE_URL}/Orders${query}`, {
      headers: { Cookie: `B1SESSION=${sessionId}` },
    });

    // 🔒 تسجيل الخروج
    await axios.post(`${SAP_BASE_URL}/Logout`, {}, {
      headers: { Cookie: `B1SESSION=${sessionId}` },
    });

    return NextResponse.json({
      success: true,
      orders: res.data.value || [],
    });
  } catch (err) {
    console.error("❌ SAP Fetch Orders Error:", err.response?.data || err.message);
    const msg =
      err.response?.data?.error?.message?.value ||
      err.message ||
      "فشل جلب أوامر البيع.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}