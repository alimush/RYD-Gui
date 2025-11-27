// ✅ تجاهل SSL في بيئة التطوير فقط
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { NextResponse } from "next/server";
import axios from "axios";
import odbc from "odbc";

// 🔹 إعداد الاتصال بـ SAP HANA مباشرة عبر ODBC
const HANA_CONN_STR =
  'DRIVER={HDBODBC};SERVERNODE=hanab1:30015;UID=SYSTEM;PWD=Skytech@1234;CHAR_AS_UTF8=1';

// 🔹 بيانات الاتصال بـ Service Layer
const SAP_BASE_URL = "https://hanab1:50000/b1s/v1";
const COMPANY_DB = "DEMO_RYD_05102025";

export async function POST(req) {
  try {
    const { sapUser, sapPass, RepID, canceledOnly } = await req.json();

    if (!sapUser || !sapPass) {
      return NextResponse.json(
        { error: "❌ بيانات الدخول إلى SAP غير موجودة." },
        { status: 400 }
      );
    }

    console.log(`🔐 تسجيل الدخول في SAP بواسطة المستخدم: ${sapUser}`);

    // 🟢 تسجيل الدخول إلى SAP Service Layer
    const loginRes = await axios.post(`${SAP_BASE_URL}/Login`, {
      CompanyDB: COMPANY_DB,
      UserName: sapUser,
      Password: sapPass,
    });

    const sessionId = loginRes?.data?.SessionId;
    if (!sessionId) throw new Error("فشل تسجيل الدخول (SessionId مفقود)");

    console.log(`✅ تم تسجيل الدخول - SessionId: ${sessionId}`);

    // 🧭 فلترة حسب المندوب إن وُجد
    const filter =
      RepID && Number(RepID) !== 0
        ? `$filter=SalesPersonCode eq ${RepID}&`
        : "";

    // 📦 جلب أوامر البيع من Service Layer (الطلبات النشطة)
    const query = `?$select=DocEntry,DocNum,DocDate,CardCode,CardName,DocTotal,DocCurrency,DiscountPercent,SalesPersonCode,Comments,DocumentLines&$orderby=DocDate desc&$top=50&${filter}`;
    const ordersRes = await axios.get(`${SAP_BASE_URL}/Orders${query}`, {
      headers: { Cookie: `B1SESSION=${sessionId}` },
    });

    const orders = ordersRes?.data?.value || [];
    console.log(`📋 تم جلب ${orders.length} أمر بيع`);

    // 🧠 جلب بيانات العملاء والمندوبين من SAP
    const [salesRes, bpRes] = await Promise.all([
      axios.get(`${SAP_BASE_URL}/SalesPersons?$select=SalesEmployeeCode,SalesEmployeeName`, {
        headers: { Cookie: `B1SESSION=${sessionId}` },
      }),
      axios.get(`${SAP_BASE_URL}/BusinessPartners?$select=CardCode,Phone1,Cellular,U_Phone,Territory,U_Territory`, {
        headers: { Cookie: `B1SESSION=${sessionId}` },
      }),
    ]);

    // 🧩 تحويل البيانات إلى خرائط
    const salesMap = new Map(
      (salesRes?.data?.value || []).map((s) => [
        s.SalesEmployeeCode,
        s.SalesEmployeeName,
      ])
    );

    const bpMap = new Map(
      (bpRes?.data?.value || []).map((bp) => [
        bp.CardCode,
        {
          Phone:
            bp.Phone1?.trim() ||
            bp.Cellular?.trim() ||
            bp.U_Phone?.trim() ||
            "—",
          TerritoryID: bp.U_Territory || bp.Territory || null,
        },
      ])
    );

    // 🗺️ جلب أسماء المناطق + الطلبات الملغاة من SAP HANA عبر ODBC
    console.log("📡 جلب المناطق والطلبات الملغاة من SAP HANA...");
    const conn = await odbc.connect(HANA_CONN_STR);

    // 1️⃣ المناطق
    const terrRes = await conn.query(`
      SELECT DISTINCT 
        T0."territryID" AS "ID",
        T0."descript" AS "Name"
      FROM "DEMO_RYD_05102025"."OTER" T0
      WHERE T0."territryID" IS NOT NULL
      ORDER BY T0."territryID"
    `);

    // 2️⃣ الطلبات الملغاة
    const canceledRes = await conn.query(`
      SELECT 
        T0."DocNum",
        T0."DocDate",
        T0."CardCode",
        T1."CardName",
        T1."Phone1",
        T2."descript" AS "TerritoryName",
        T3."SlpName" AS "SalesPersonName",
        T0."U_Department",
        T0."U_Location",
        T4."U_NAME" AS "CreatedBy",
        T0."Comments",
        T0."CANCELED"
      FROM "DEMO_RYD_05102025"."ORDR" T0
      INNER JOIN "DEMO_RYD_05102025"."OCRD" T1 
        ON T0."CardCode" = T1."CardCode"
      LEFT JOIN "DEMO_RYD_05102025"."OTER" T2 
        ON T1."Territory" = T2."territryID"
      LEFT JOIN "DEMO_RYD_05102025"."OSLP" T3 
        ON T0."SlpCode" = T3."SlpCode"
      LEFT JOIN "DEMO_RYD_05102025"."OUSR" T4 
        ON T0."UserSign" = T4."USERID"
      WHERE T0."CANCELED" = 'Y'
      ORDER BY T0."DocDate" DESC
    `);

    await conn.close();

    const territoryMap = new Map(
      (terrRes || []).map((t) => [t.ID, t.Name])
    );

    console.log(`✅ تم جلب ${territoryMap.size} منطقة و ${canceledRes.length} طلب ملغي`);

    // 🔄 دمج بيانات الهاتف + المندوب + المنطقة
    const enrichedOrders = orders.map((o) => {
      const customer = bpMap.get(o.CardCode) || {};
      const salesName = salesMap.get(o.SalesPersonCode) || "—";
      const terrName = customer.TerritoryID
        ? territoryMap.get(customer.TerritoryID) || "—"
        : "—";

      return {
        ...o,
        Phone1: customer.Phone || "—",
        SalesPersonName: salesName,
        Territory: customer.TerritoryID || "—",
        TerritoryName: terrName,
        CANCELED: "N", // الطلبات النشطة
      };
    });

    // 🧾 تحديد النتيجة النهائية بناءً على `canceledOnly`
    const finalResult = canceledOnly ? canceledRes : enrichedOrders;

    // 🚪 تسجيل الخروج من SAP
    try {
      await axios.post(`${SAP_BASE_URL}/Logout`, {}, {
        headers: { Cookie: `B1SESSION=${sessionId}` },
      });
    } catch {
      console.warn("⚠️ فشل تسجيل الخروج (تم التجاهل)");
    }

    // ✅ النتيجة النهائية
    return NextResponse.json({
      success: true,
      count: finalResult.length,
      orders: finalResult,
    });

  } catch (err) {
    console.error("❌ خطأ في جلب البيانات:", err.response?.data || err.message);
    return NextResponse.json(
      {
        error:
          err.response?.data?.error?.message?.value ||
          err.message ||
          "حدث خطأ أثناء جلب أوامر البيع من SAP.",
      },
      { status: 500 }
    );
  }
}