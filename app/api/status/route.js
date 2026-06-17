process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { NextResponse } from "next/server";
import axios from "axios";

const SAP_BASE_URL = "https://hanab1:50000/b1s/v1";
const COMPANY_DB = "RYD";

export async function POST(req) {
  try {
    const { sapUser, sapPass } = await req.json();

    if (!sapUser || !sapPass)
      return NextResponse.json(
        { error: "بيانات الدخول غير موجودة" },
        { status: 400 }
      );

    // 🔹 تسجيل الدخول في SAP
    const loginRes = await axios.post(`${SAP_BASE_URL}/Login`, {
      CompanyDB: COMPANY_DB,
      UserName: sapUser,
      Password: sapPass,
    });

    const cookies = loginRes.headers["set-cookie"];
    if (!cookies) throw new Error("فشل تسجيل الدخول إلى SAP");

    // 🔹 جلب أوامر البيع مع الحالات والتفاصيل
    const res = await axios.get(
      `${SAP_BASE_URL}/Orders?$orderby=DocEntry desc&$top=100&$select=DocEntry,DocNum,CardCode,CardName,DocDate,DocTotal,DocCurrency,DocStatus,DocumentStatus,CANCELED,DocumentLines`,
      { headers: { Cookie: cookies.join(";") } }
    );

    // 🔹 تجهيز البيانات مع تحليل الحالة
    const orders = (res.data.value || []).map((o) => {
      let Status = "Open";
      if (o.CANCELED === "Y" || o.Canceled === "tYES") Status = "Canceled";
      else if (o.DocStatus === "C" || o.DocumentStatus === "C") Status = "Closed";
      return {
        DocEntry: o.DocEntry,
        DocNum: o.DocNum,
        CardCode: o.CardCode,
        CardName: o.CardName,
        DocDate: o.DocDate,
        DocTotal: o.DocTotal,
        DocCurrency: o.DocCurrency,
        Status,
        DocumentLines: o.DocumentLines || [],
      };
    });

    // تسجيل الخروج
    await axios.post(`${SAP_BASE_URL}/Logout`, {}, { headers: { Cookie: cookies.join(";") } });

    return NextResponse.json({ success: true, orders });
  } catch (err) {
    console.error("❌ SAP Fetch Status Error:", err.response?.data || err.message);
    const msg =
      err.response?.data?.error?.message?.value ||
      err.message ||
      "فشل جلب حالات أوامر البيع.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}