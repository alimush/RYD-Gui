import { NextResponse } from "next/server";
import odbc from "odbc";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const itemCode = searchParams.get("itemCode");
    const currency = searchParams.get("currency") || "IQD";

    if (!itemCode) {
      return NextResponse.json(
        { error: "❌ Missing itemCode parameter" },
        { status: 400 }
      );
    }

    // 🟢 اتصال مباشر بدون DSN
    const CONN_STR =
      'DRIVER={HDBODBC};SERVERNODE=hanab1:30015;UID=SYSTEM;PWD=Skytech@1234;CHAR_AS_UTF8=1';

    // 🔹 نختار الكويري حسب نوع العملة
    const query =
      currency === "USD"
        ? `
          SELECT 
            TO_DECIMAL(oitw."OnHand" - oitw."IsCommited") || '| ' || 
            owhs."WhsName" || ' |' || owhs."WhsCode" AS "whsname",
            TO_DECIMAL(oitw."OnHand" - oitw."IsCommited") AS "Available",
            TO_DECIMAL(itm1."AddPrice1", 10, 2) AS "Price"
          FROM "DEMO_RYD_05102025"."OITW" oitw
          INNER JOIN "DEMO_RYD_05102025"."OITM" oitm ON oitm."ItemCode" = oitw."ItemCode"
          INNER JOIN "DEMO_RYD_05102025"."ITM1" itm1 ON itm1."ItemCode" = oitw."ItemCode" AND itm1."PriceList" = 1
          INNER JOIN "DEMO_RYD_05102025"."OITB" oitb ON oitb."ItmsGrpCod" = oitm."ItmsGrpCod"
          INNER JOIN "DEMO_RYD_05102025"."OWHS" owhs ON owhs."WhsCode" = oitw."WhsCode"
          INNER JOIN "DEMO_RYD_05102025"."OLCT" olct ON olct."Code" = owhs."Location"
          WHERE (oitw."OnHand" - oitw."IsCommited") > 0
            AND oitw."ItemCode" = ?
            AND owhs."WhsCode" NOT IN (
              'EWJ002','HQQ001','HQQ002','HQQ003','HQQ005','HQQ006',
              'KRA003','MNS003','NDA003','NJF004','RYD003',
              'SM001','SM002','SM003','SM004','SM005','SM006',
              'SM007','SM008','SM009'
            )
          ORDER BY "Available" DESC;
        `
        : `
          SELECT 
            TO_DECIMAL(oitw."OnHand" - oitw."IsCommited") || '| ' || 
            owhs."WhsName" || ' |' || owhs."WhsCode" AS "whsname",
            TO_DECIMAL(oitw."OnHand" - oitw."IsCommited") AS "Available",
            TO_DECIMAL(itm1."Price", 10, 2) AS "Price"
          FROM "DEMO_RYD_05102025"."OITW" oitw
          INNER JOIN "DEMO_RYD_05102025"."OITM" oitm ON oitm."ItemCode" = oitw."ItemCode"
          INNER JOIN "DEMO_RYD_05102025"."ITM1" itm1 ON itm1."ItemCode" = oitw."ItemCode" AND itm1."PriceList" = 1
          INNER JOIN "DEMO_RYD_05102025"."OITB" oitb ON oitb."ItmsGrpCod" = oitm."ItmsGrpCod"
          INNER JOIN "DEMO_RYD_05102025"."OWHS" owhs ON owhs."WhsCode" = oitw."WhsCode"
          INNER JOIN "DEMO_RYD_05102025"."OLCT" olct ON olct."Code" = owhs."Location"
          WHERE (oitw."OnHand" - oitw."IsCommited") > 0
            AND oitw."ItemCode" = ?
            AND owhs."WhsCode" NOT IN (
              'EWJ002','HQQ001','HQQ002','HQQ003','HQQ005','HQQ006',
              'KRA003','MNS003','NDA003','NJF004','RYD003',
              'SM001','SM002','SM003','SM004','SM005','SM006',
              'SM007','SM008','SM009'
            )
          ORDER BY "Available" DESC;
        `;

    // 🟢 تنفيذ الاتصال والكويري
    const connection = await odbc.connect(CONN_STR);
    const result = await connection.query(query, [itemCode]);
    await connection.close();

    return NextResponse.json({
      success: true,
      currency,
      itemCode,
      data: result,
    });
  } catch (err) {
    console.error("❌ Item Price API Error:", err);
    return NextResponse.json(
      { error: err.message || "Database query failed" },
      { status: 500 }
    );
  }
}