export const runtime = "nodejs";
import odbc from "odbc";

const CONN_STR =
  'DRIVER={HDBODBC};SERVERNODE=hanab1:30015;UID=SYSTEM;PWD=Skytech@1234;CHAR_AS_UTF8=1';

function mapCustomers(result) {
  return (result || []).map((r) => ({
    Phone1: r.Phone1,
    CardName: r.CardName,
    CardCode: r.CardCode,
    eshop_customer_name: String(
      r.eshop_customer_name || r.ESHOP_CUSTOMER_NAME || r.U_CustomerName || ""
    ).trim(),
  }));
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim().toLowerCase() || "";

    const conn = await odbc.connect(CONN_STR);

    const whereSearch = q
      ? `
        AND (
          LOWER(T0."CardName") LIKE '%${q}%'
          OR LOWER(T0."CardCode") LIKE '%${q}%'
          OR LOWER(IFNULL(T0."Phone1", '')) LIKE '%${q}%'
        )
      `
      : "";

    const sqlWithEshop = `
      SELECT
        T0."Phone1",
        T0."CardName",
        T0."CardCode",
        S."U_CustomerName" AS "eshop_customer_name"
      FROM "RYD"."OCRD" T0
      LEFT JOIN "RYD"."@SOECOM" S
        ON TO_NVARCHAR(S."U_CardCode") = TO_NVARCHAR(T0."CardCode")
      WHERE T0."CardType" = 'C'
      ${
        q
          ? `AND (
              LOWER(T0."CardName") LIKE '%${q}%'
              OR LOWER(T0."CardCode") LIKE '%${q}%'
              OR LOWER(IFNULL(T0."Phone1", '')) LIKE '%${q}%'
              OR LOWER(IFNULL(S."U_CustomerName", '')) LIKE '%${q}%'
            )`
          : ""
      }
      ORDER BY T0."CardName" LIMIT 50
    `;

    const sqlFallback = `
      SELECT
        T0."Phone1",
        T0."CardName",
        T0."CardCode",
        T0."U_CustomerName" AS "eshop_customer_name"
      FROM "RYD"."OCRD" T0
      WHERE T0."CardType" = 'C'
      ${
        q
          ? `AND (
              LOWER(T0."CardName") LIKE '%${q}%'
              OR LOWER(T0."CardCode") LIKE '%${q}%'
              OR LOWER(IFNULL(T0."Phone1", '')) LIKE '%${q}%'
              OR LOWER(IFNULL(T0."U_CustomerName", '')) LIKE '%${q}%'
            )`
          : ""
      }
      ORDER BY T0."CardName" LIMIT 50
    `;

    const sqlBase = `
      SELECT
        T0."Phone1",
        T0."CardName",
        T0."CardCode"
      FROM "RYD"."OCRD" T0
      WHERE T0."CardType" = 'C'
      ${whereSearch}
      ORDER BY T0."CardName" LIMIT 50
    `;

    let result;
    try {
      result = await conn.query(sqlWithEshop);
    } catch (eshopErr) {
      console.error(
        "⚠️ customers @SOECOM join failed, trying OCRD.U_CustomerName:",
        eshopErr?.odbcErrors || eshopErr?.message || eshopErr
      );
      try {
        result = await conn.query(sqlFallback);
      } catch (ocrdErr) {
        console.error(
          "⚠️ customers OCRD.U_CustomerName failed, using base query:",
          ocrdErr?.odbcErrors || ocrdErr?.message || ocrdErr
        );
        result = await conn.query(sqlBase);
      }
    }

    await conn.close();

    return new Response(JSON.stringify(mapCustomers(result)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ Customer fetch error:", err?.odbcErrors || err);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch customers",
        details: err.message,
        odbcErrors: err.odbcErrors || null,
      }),
      { status: 500 }
    );
  }
}
