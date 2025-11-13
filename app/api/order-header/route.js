import { NextResponse } from "next/server";
import odbc from "odbc";

const HANA_CONN_STR =
  'DRIVER={HDBODBC};SERVERNODE=hanab1:30015;UID=SYSTEM;PWD=Skytech@1234;CHAR_AS_UTF8=1';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const docEntry = searchParams.get("docEntry");

  if (!docEntry)
    return NextResponse.json({ error: "❌ docEntry is required" }, { status: 400 });

  let connection;
  try {
    connection = await odbc.connect(HANA_CONN_STR);

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
      FROM "DEMO_RYD_05102025"."ORDR" T0
      INNER JOIN "DEMO_RYD_05102025"."OCRD" T1 
        ON T0."CardCode" = T1."CardCode"
      LEFT JOIN "DEMO_RYD_05102025"."OTER" T2 
        ON T1."Territory" = T2."territryID"
      LEFT JOIN "DEMO_RYD_05102025"."OSLP" T3 
        ON T0."SlpCode" = T3."SlpCode"
      INNER JOIN "DEMO_RYD_05102025"."OUSR" T4 
        ON T0."UserSign" = T4."USERID"
      WHERE T0."DocEntry" = ${docEntry};
    `;

    const result = await connection.query(query);
    if (!result.length)
      return NextResponse.json({ error: "Order not found" }, { status: 404 });

    return NextResponse.json(result[0], { status: 200 });
  } catch (err) {
    console.error("❌ /api/order-header Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    if (connection) await connection.close();
  }
}