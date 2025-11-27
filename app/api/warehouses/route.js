export const runtime = "nodejs";
import odbc from "odbc";

const CONN_STR =
  'DRIVER={HDBODBC};SERVERNODE=hanab1:30015;UID=SYSTEM;PWD=Skytech@1234;CHAR_AS_UTF8=1';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const itemCode = searchParams.get("itemCode")?.trim();

    if (!itemCode) {
      return new Response(
        JSON.stringify({ error: "Missing itemCode parameter" }),
        { status: 400 }
      );
    }

    const conn = await odbc.connect(CONN_STR);

    // ✅ الكويري الصحيح — كل عمود مستقل
    const sql = `
      SELECT 
        owhs."WhsCode",
        owhs."WhsName",
        TO_DECIMAL(oitw."OnHand" - oitw."IsCommited", 15, 2) AS "Available",
        COALESCE(itm1."Price", 0) AS "Price"
      FROM "DEMO_RYD_05102025"."OITW" oitw
      INNER JOIN "DEMO_RYD_05102025"."OWHS" owhs 
        ON oitw."WhsCode" = owhs."WhsCode"
      LEFT JOIN "DEMO_RYD_05102025"."ITM1" itm1 
        ON itm1."ItemCode" = oitw."ItemCode" 
        AND itm1."PriceList" = 1
      WHERE oitw."ItemCode" = '${itemCode}'
        AND (oitw."OnHand" - oitw."IsCommited") > 0
      ORDER BY "Available" DESC
    `;

    const result = await conn.query(sql);
    await conn.close();

    console.log("🏬 Warehouses for", itemCode, "=>", result);

    // ✅ كل حقل منفصل — بدون دمج
    const warehouses = result.map((w) => ({
      WhsCode: w.WhsCode,
      WhsName: w.WhsName,
      Available: Number(w.Available || 0),
      Price: Number(w.Price || 0),
    }));

    return new Response(JSON.stringify(warehouses), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ SAP fetch error:", err);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch warehouses",
        details: err.message,
      }),
      { status: 500 }
    );
  }
}