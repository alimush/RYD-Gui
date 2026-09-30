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

    // Link ORDR.DocNum <-> @SOECOM.U_SaleOrderCreateNo
    const queryWithEshop = `
      SELECT 
        T0."DocEntry",
        T0."DocNum",
        T0."DocDate",
        T1."CardCode",
        T1."CardName",
        T1."Phone1",
        S."U_SaleOrderCreateNo" AS "eshop_sale_order_no",
        S."U_CustomerName" AS "eshop_customer_name",
        S."U_CustomerEmail" AS "eshop_customer_email",
        S."U_ShippingAddressAddress" AS "eshop_shipping_address",
        S."U_ShippingAddressMobile" AS "eshop_shipping_mobile",
        T2."descript" AS "TerritoryName",
        T3."SlpName" AS "SalesPersonName",
        T0."U_Department",
        T0."U_Location",
        T4."U_NAME" AS "CreatedBy",
        T0."Comments"
      FROM "RYD"."ORDR" T0
      INNER JOIN "RYD"."OCRD" T1 
        ON T0."CardCode" = T1."CardCode"
      LEFT JOIN (
        SELECT
          TO_NVARCHAR("U_SaleOrderCreateNo") AS "SaleOrdNo",
          MAX("U_SaleOrderCreateNo") AS "U_SaleOrderCreateNo",
          MAX("U_CustomerName") AS "U_CustomerName",
          MAX("U_CustomerEmail") AS "U_CustomerEmail",
          MAX("U_ShippingAddressAddress") AS "U_ShippingAddressAddress",
          MAX("U_ShippingAddressMobile") AS "U_ShippingAddressMobile"
        FROM "RYD"."@SOECOM"
        GROUP BY TO_NVARCHAR("U_SaleOrderCreateNo")
      ) S
        ON S."SaleOrdNo" = TO_NVARCHAR(T0."DocNum")
      LEFT JOIN "RYD"."OTER" T2 
        ON T1."Territory" = T2."territryID"
      LEFT JOIN "RYD"."OSLP" T3 
        ON T0."SlpCode" = T3."SlpCode"
      INNER JOIN "RYD"."OUSR" T4 
        ON T0."UserSign" = T4."USERID"
      WHERE T0."DocEntry" = ${docEntry}
    `;

    const queryBase = `
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
      WHERE T0."DocEntry" = ${docEntry}
    `;

    let result;
    try {
      result = await conn.query(queryWithEshop);
    } catch (eshopErr) {
      console.error(
        "⚠️ order-header @SOECOM join failed, using base:",
        eshopErr?.odbcErrors || eshopErr?.message || eshopErr
      );
      result = await conn.query(queryBase);
    }
    await conn.close();

    if (!result.length)
      return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const row = result[0];
    const isEshopCustomer =
      String(row.CardName || "").trim().toLowerCase() === "eshope customer";

    const pick = (...vals) => {
      if (!isEshopCustomer) return "";
      for (const v of vals) {
        const s = String(v ?? "").trim();
        if (s) return s;
      }
      return "";
    };

    const data = {
      ...row,
      eshop_sale_order_no: pick(
        row.eshop_sale_order_no,
        row.ESHOP_SALE_ORDER_NO,
        row.U_SaleOrderCreateNo
      ),
      eshop_customer_name: pick(
        row.eshop_customer_name,
        row.ESHOP_CUSTOMER_NAME,
        row.U_CustomerName
      ),
      eshop_customer_email: pick(
        row.eshop_customer_email,
        row.ESHOP_CUSTOMER_EMAIL,
        row.U_CustomerEmail
      ),
      eshop_shipping_address: pick(
        row.eshop_shipping_address,
        row.ESHOP_SHIPPING_ADDRESS,
        row.U_ShippingAddressAddress
      ),
      eshop_shipping_mobile: pick(
        row.eshop_shipping_mobile,
        row.ESHOP_SHIPPING_MOBILE,
        row.U_ShippingAddressMobile
      ),
    };

    // ⚡ 3) خزّن بالكاش
    cache.set(key, { time: now, data });

    return NextResponse.json(data, { status: 200 });

  } catch (err) {
    console.error("❌ /api/order-header Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}