export const runtime = "nodejs";

import { NextResponse } from "next/server";
import odbc from "odbc";

const HANA_CONN_STR =
  "DRIVER={HDBODBC};SERVERNODE=hanab1:30015;UID=SYSTEM;PWD=Skytech@1234;CHAR_AS_UTF8=1";

const SALES_STATISTICS_SQL = `
  SELECT TOP 6
      a."Memo" AS "saleman",
      TO_DECIMAL(SUM(a."SaleAftDis"), 10, 0)
        + TO_DECIMAL(SUM(a."RetuAftDisc"), 10, 0) AS "Revenue"
  FROM (

      SELECT
          T0."DocDate" AS "Date",
          oocr2."OcrName" AS "Location",
          oocr1."OcrName" AS "Department",
          T3."Memo" AS "Memo",
          SUM(T1."LineTotal") AS "SaleAftDis",
          0.0 AS "RetuAftDisc"
      FROM "RYD"."OINV" T0
      INNER JOIN "RYD"."INV1" T1 ON T1."DocEntry" = T0."DocEntry"
      INNER JOIN "RYD"."OSLP" T3 ON T3."SlpCode" = T0."SlpCode"
      LEFT JOIN "RYD"."OOCR" oocr1 ON oocr1."OcrCode" = T1."OcrCode"
      LEFT JOIN "RYD"."OOCR" oocr2 ON oocr2."OcrCode" = T1."OcrCode2"
      WHERE T0."CANCELED" = 'N'
      GROUP BY
          T0."DocDate",
          oocr2."OcrName",
          oocr1."OcrName",
          T3."Memo"

      UNION ALL

      SELECT
          T0."DocDate" AS "Date",
          oocr2."OcrName" AS "Location",
          oocr1."OcrName" AS "Department",
          T3."Memo" AS "Memo",
          0.0 AS "SaleAftDis",
          SUM(T1."LineTotal") * -1 AS "RetuAftDisc"
      FROM "RYD"."ORIN" T0
      INNER JOIN "RYD"."RIN1" T1 ON T1."DocEntry" = T0."DocEntry"
      INNER JOIN "RYD"."OSLP" T3 ON T3."SlpCode" = T0."SlpCode"
      LEFT JOIN "RYD"."OOCR" oocr1 ON oocr1."OcrCode" = T1."OcrCode"
      LEFT JOIN "RYD"."OOCR" oocr2 ON oocr2."OcrCode" = T1."OcrCode2"
      WHERE T0."CANCELED" = 'N'
      GROUP BY
          T0."DocDate",
          oocr2."OcrName",
          oocr1."OcrName",
          T3."Memo"

  ) A

  WHERE
      A."Date" >= ADD_MONTHS(NEXT_DAY(LAST_DAY(CURRENT_DATE)), -1)
      AND A."Date" <= LAST_DAY(CURRENT_DATE)
      AND A."Department" = ?
      AND A."Location" = ?

  GROUP BY A."Memo"

  HAVING
      TO_DECIMAL(SUM(A."SaleAftDis"), 10, 0)
      + TO_DECIMAL(SUM(A."RetuAftDisc"), 10, 0) > 1

  ORDER BY "Revenue" DESC
`;

export async function GET(req) {
  let conn;
  try {
    const { searchParams } = new URL(req.url);
    const department = searchParams.get("department")?.trim();
    const location = searchParams.get("location")?.trim();

    if (!department || !location) {
      return NextResponse.json(
        {
          success: false,
          error: "القسم والموقع مطلوبان من بيانات المستخدم الحالي",
        },
        { status: 400 }
      );
    }

    conn = await odbc.connect(HANA_CONN_STR);
    const rows = await conn.query(SALES_STATISTICS_SQL, [
      department,
      location,
    ]);

    const data = (rows || []).slice(0, 6).map((row) => ({
      salesman: String(row.saleman || row.SALEMAN || "").trim(),
      revenue: Number(row.Revenue ?? row.REVENUE ?? 0),
    }));

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("❌ Sales Statistics API Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "فشل جلب إحصائيات المبيعات",
      },
      { status: 500 }
    );
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (_) {}
    }
  }
}
