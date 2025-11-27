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

    const sql = `
      SELECT T1."Discount"
      FROM "DEMO_RYD_05102025"."OEDG" T0
      INNER JOIN "DEMO_RYD_05102025"."EDG1" T1
        ON T0."AbsEntry" = T1."AbsEntry"
      WHERE 
        T1."ObjKey" = '${itemCode}'
        AND T0."ValidTo" >= CURRENT_DATE
        AND T0."Type" = 'A'
      LIMIT 1
    `;

    const result = await conn.query(sql);
    await conn.close();

    const discount = result?.[0]?.Discount || 0;

    return new Response(JSON.stringify({ itemCode, discount }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ Discount fetch error:", err);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch discount",
        details: err.message,
      }),
      { status: 500 }
    );
  }
}