process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { NextResponse } from "next/server";
import axios from "axios";

const SAP_BASE_URL = "https://hanab1:50000/b1s/v1";

export async function POST(req) {
  try {
    const body = await req.json();
    const { CardName, AliasName, Remarks, Phone1, Territory, sapUser, sapPass } = body;

    if (!CardName || !sapUser || !sapPass)
      return NextResponse.json({ error: "❌ Missing required fields" }, { status: 400 });

    // ✅ نخلي SAP يولّد الكود حسب السلسلة (Series)
    const bpData = {
      Series: 122,                        // ← السلسلة المسؤولة عن توليد CardCode
      CardName: CardName.trim(),
      AliasName: AliasName?.trim() || "",
      Notes: Remarks?.trim() || "",
      CardType: "cCustomer",
      Territory: parseInt(Territory) || 0,
      Phone1: Phone1?.trim() || "",
      Currency: "##",                     // ✅ جميع العملات (All Currencies)
    };

    // 🔐 تسجيل الدخول
    const loginRes = await axios.post(`${SAP_BASE_URL}/Login`, {
      CompanyDB: "DEMO_RYD_05102025",
      UserName: sapUser,
      Password: sapPass,
    });

    const sessionId = loginRes.data.SessionId;

    // 🟢 إنشاء الزبون
    const createRes = await axios.post(`${SAP_BASE_URL}/BusinessPartners`, bpData, {
      headers: {
        "Content-Type": "application/json",
        Cookie: `B1SESSION=${sessionId}`,
      },
    });

    const createdBP = createRes.data;

    // 🔒 تسجيل خروج
    await axios.post(`${SAP_BASE_URL}/Logout`, {}, {
      headers: { Cookie: `B1SESSION=${sessionId}` },
    });

    // ✅ نرجع الكود الحقيقي اللي SAP ولدّه
    return NextResponse.json({
      success: true,
      message: "✅ Customer created successfully",
      CardCode: createdBP.CardCode,   // ← الكود من SAP نفسه
      CardName: createdBP.CardName,
    });
  } catch (err) {
    console.error("❌ Create Customer Error:", err.response?.data || err.message);
    return NextResponse.json(
      { error: err.response?.data?.error?.message?.value || err.message },
      { status: 500 }
    );
  }
}