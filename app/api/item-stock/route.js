export const runtime = "nodejs";
import odbc from "odbc";

const CONN_STR =
  'DRIVER={HDBODBC};SERVERNODE=hanab1:30015;UID=SYSTEM;PWD=Skytech@1234;CHAR_AS_UTF8=1';

// 🟢 GET /api/item-stock
// يرجع كل المواد مع الكمية الإجمالية المتوفرة بكل المخازن
export async function GET() {
  try {
    const conn = await odbc.connect(CONN_STR);

    // ✅ الكويري داخل قاعدة DEMO_RYD_05102025
    const sql = `
      SELECT 
        oitw."ItemCode",
        oitm."ItemName",
        SUM(oitw."OnHand" - oitw."IsCommited") AS "TotalAvailable"
      FROM "DEMO_RYD_05102025"."OITW" oitw
      INNER JOIN "DEMO_RYD_05102025"."OITM" oitm 
        ON oitm."ItemCode" = oitw."ItemCode"
      WHERE oitw."OnHand" - oitw."IsCommited" > 0
      GROUP BY oitw."ItemCode", oitm."ItemName"
      ORDER BY "TotalAvailable" DESC
    `;

    const result = await conn.query(sql);
    await conn.close();

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ SAP fetch error:", err);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch item stock",
        details: err.message,
      }),
      { status: 500 }
    );
  }
}