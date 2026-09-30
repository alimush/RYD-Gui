export const runtime = "nodejs";
import odbc from "odbc";

const CONN_STR =
  'DRIVER={HDBODBC};SERVERNODE=hanab1:30015;UID=SYSTEM;PWD=Skytech@1234;CHAR_AS_UTF8=1';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim().toLowerCase() || "";

    const conn = await odbc.connect(CONN_STR);

    let sql = `
      SELECT 
        T0."Phone1",
        T0."CardName",
        T0."CardCode",
        S."U_CustomerName" AS "eshop_customer_name"
      FROM "RYD"."OCRD" T0
      LEFT JOIN "RYD"."@SOECOM" S
        ON S."Code" = T0."CardCode"
      WHERE T0."CardType" = 'C'
    `;

    // 🔎 دعم البحث بالاسم أو الكود أو الرقم أو اسم الإي شوب
    if (q) {
      sql += `
        AND (
          LOWER(T0."CardName") LIKE '%${q}%'
          OR LOWER(T0."CardCode") LIKE '%${q}%'
          OR LOWER(T0."Phone1") LIKE '%${q}%'
          OR LOWER(IFNULL(S."U_CustomerName", '')) LIKE '%${q}%'
        )
      `;
    }

    sql += ` ORDER BY T0."CardName" LIMIT 50;`;

    const result = await conn.query(sql);
    await conn.close();

    const customers = (result || []).map((r) => ({
      Phone1: r.Phone1,
      CardName: r.CardName,
      CardCode: r.CardCode,
      eshop_customer_name: String(
        r.eshop_customer_name || r.ESHOP_CUSTOMER_NAME || ""
      ).trim(),
    }));

    return new Response(JSON.stringify(customers), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ Customer fetch error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to fetch customers", details: err.message }),
      { status: 500 }
    );
  }
}