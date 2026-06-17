import { NextResponse } from "next/server";
import odbc from "odbc";

// 🔥 Connection Pool (يبقى مفتوح - أسرع ×50)
const pool = await odbc.pool(
  'DRIVER={HDBODBC};SERVERNODE=hanab1:30015;UID=SYSTEM;PWD=Skytech@1234;CHAR_AS_UTF8=1',
  { connectionTimeout: 3, loginTimeout: 3 }
);

// 🔥 Cache لمدة 10 ثواني فقط (كافي للضغط)
const cache = new Map();
const TTL = 10 * 1000; // 10 seconds

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const docEntry = searchParams.get("docEntry");

    if (!docEntry)
      return NextResponse.json({ error: "❌ docEntry is required" }, { status: 400 });

    const key = `hdr_${docEntry}`;
    const now = Date.now();

    // ⚡ 1) رجّع من الكاش فورًا
    if (cache.has(key)) {
      const item = cache.get(key);
      if (now - item.time < TTL) {
        return NextResponse.json(item.data, { status: 200 });
      }
    }

    // ⚡ 2) استخدم Pool وليس اتصال جديد
    const conn = await pool.connect();

    const query = `
      SELECT 
        T0."DocEntry",
        T0."DocNum",
        T0."DocDate",
        T1."CardCode",
        T1."CardName",
        T1."Phone1",
        T2."descript" AS "TerritoryName",
        T3."SlpName" AS "SalesPersonName",
        T0."U_Department",
        T0."U_Location",
        T4."U_NAME" AS "CreatedBy",
        T0."Comments"
      FROM "RYD"."ORDR" T0
      INNER JOIN "RYD"."OCRD" T1 
        ON T0."CardCode" = T1."CardCode"
      LEFT JOIN "RYD"."OTER" T2 
        ON T1."Territory" = T2."territryID"
      LEFT JOIN "RYD"."OSLP" T3 
        ON T0."SlpCode" = T3."SlpCode"
      INNER JOIN "RYD"."OUSR" T4 
        ON T0."UserSign" = T4."USERID"
      WHERE T0."DocEntry" = ${docEntry};
    `;

    const result = await conn.query(query);
    await conn.close();

    if (!result.length)
      return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const data = result[0];

    // ⚡ 3) خزّن بالكاش
    cache.set(key, { time: now, data });

    return NextResponse.json(data, { status: 200 });

  } catch (err) {
    console.error("❌ /api/order-header Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}