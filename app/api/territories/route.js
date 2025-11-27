// ✅ تجاهل فحص SSL أثناء التطوير
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { NextResponse } from "next/server";
import odbc from "odbc";

// إعداد الاتصال بـ SAP HANA
const HANA_CONN_STR =
  'DRIVER={HDBODBC};SERVERNODE=hanab1:30015;UID=SYSTEM;PWD=Skytech@1234;CHAR_AS_UTF8=1';

// ✅ كويري متوافقة مع ODBC 100%
const GET_TERRITORIES_QUERY = `
  SELECT DISTINCT 
    T0."territryID" AS "ID",
    T0."descript" AS "Name"
  FROM "DEMO_RYD_05102025"."OTER" T0
  WHERE T0."territryID" IS NOT NULL
  ORDER BY T0."territryID"
`;

export async function GET() {
  try {
    console.log("📡 Fetching Territories from SAP HANA...");

    const conn = await odbc.connect(HANA_CONN_STR);
    const result = await conn.query(GET_TERRITORIES_QUERY);
    await conn.close();

    if (!result || result.length === 0) {
      console.warn("⚠️ لا توجد مناطق مسجلة في النظام");
      return NextResponse.json(
        { message: "⚠️ لا توجد مناطق مسجلة في النظام." },
        { status: 404 }
      );
    }

    // 🔹 رجّع النتيجة بشكل نظيف
    const territories = result.map((row) => ({
      ID: row.ID?.toString().trim(),
      Name: row.Name?.toString().trim() || "—",
    }));

    console.log(`✅ تم جلب ${territories.length} منطقة بنجاح`);
    return NextResponse.json(territories);
  } catch (err) {
    console.error("❌ GET Territories Error:", err);
    return NextResponse.json(
      {
        error: "حدث خطأ أثناء تنفيذ الاستعلام على قاعدة SAP HANA.",
        details: err.message,
      },
      { status: 500 }
    );
  }
}