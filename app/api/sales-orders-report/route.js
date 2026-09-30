process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { NextResponse } from "next/server";
import axios from "axios";
import odbc from "odbc";

const SAP_BASE_URL = "https://hanab1:50000/b1s/v1";
const COMPANY_DB = "RYD";
const HANA_CONN_STR =
  "DRIVER={HDBODBC};SERVERNODE=hanab1:30015;UID=SYSTEM;PWD=Skytech@1234;CHAR_AS_UTF8=1";

const listCache = new Map();
const LIST_TTL = 20 * 1000;

let poolPromise = null;
function getPool() {
  if (!poolPromise) {
    poolPromise = odbc.pool(HANA_CONN_STR, {
      connectionTimeout: 5,
      loginTimeout: 5,
    });
  }
  return poolPromise;
}

function mapStatus(row) {
  const canceled = String(row.CANCELED || "").toUpperCase() === "Y";
  const docStatus = String(row.DocStatus || "").toUpperCase();
  if (canceled) return "Canceled";
  if (docStatus === "C") return "Closed";
  return "Open";
}

async function fetchOrdersList(RepID, { nocache = false } = {}) {
  const rep = Number(RepID) || 0;
  const cacheKey = `list_eshop_fields_v2_${rep}`;
  const now = Date.now();

  if (!nocache && listCache.has(cacheKey)) {
    const hit = listCache.get(cacheKey);
    if (now - hit.time < LIST_TTL) return hit.orders;
  }

  const pool = await getPool();
  const conn = await pool.connect();

  try {
    const repFilter = rep !== 0 ? `AND T0."SlpCode" = ${rep}` : "";

    // Link ORDR.DocNum <-> @SOECOM.U_SaleOrderCreateNo
    // e-shop fields apply when CardName = 'eShope Customer'
    const sqlWithEshop = `
      SELECT TOP 50
        T0."DocEntry",
        T0."DocNum",
        T0."DocDate",
        T0."CardCode",
        T0."CardName",
        S."U_SaleOrderCreateNo" AS "eshop_sale_order_no",
        S."U_CustomerName" AS "eshop_customer_name",
        S."U_CustomerEmail" AS "eshop_customer_email",
        S."U_ShippingAddressAddress" AS "eshop_shipping_address",
        S."U_ShippingAddressMobile" AS "eshop_shipping_mobile",
        T0."DocTotal",
        T0."DocCur" AS "DocCurrency",
        T0."DocStatus",
        T0."CANCELED",
        T0."SlpCode" AS "SalesPersonCode"
      FROM "RYD"."ORDR" T0
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
      WHERE T0."DocStatus" = 'O'
        AND T0."CANCELED" = 'N'
        ${repFilter}
      ORDER BY T0."DocEntry" DESC
    `;

    const sqlBase = `
      SELECT TOP 50
        T0."DocEntry",
        T0."DocNum",
        T0."DocDate",
        T0."CardCode",
        T0."CardName",
        T0."DocTotal",
        T0."DocCur" AS "DocCurrency",
        T0."DocStatus",
        T0."CANCELED",
        T0."SlpCode" AS "SalesPersonCode"
      FROM "RYD"."ORDR" T0
      WHERE T0."DocStatus" = 'O'
        AND T0."CANCELED" = 'N'
        ${repFilter}
      ORDER BY T0."DocEntry" DESC
    `;

    let rows;
    try {
      rows = await conn.query(sqlWithEshop);
    } catch (eshopErr) {
      console.error(
        "⚠️ @SOECOM join failed, using base query:",
        eshopErr?.odbcErrors || eshopErr?.message || eshopErr
      );
      rows = await conn.query(sqlBase);
    }

    const orders = (rows || []).map((o) => {
      const isEshopCustomer =
        String(o.CardName || "").trim().toLowerCase() === "eshope customer";

      const pick = (...vals) => {
        if (!isEshopCustomer) return "";
        for (const v of vals) {
          const s = String(v ?? "").trim();
          if (s) return s;
        }
        return "";
      };

      return {
        ...o,
        eshop_sale_order_no: pick(
          o.eshop_sale_order_no,
          o.ESHOP_SALE_ORDER_NO,
          o.U_SaleOrderCreateNo
        ),
        eshop_customer_name: pick(
          o.eshop_customer_name,
          o.ESHOP_CUSTOMER_NAME,
          o.U_CustomerName
        ),
        eshop_customer_email: pick(
          o.eshop_customer_email,
          o.ESHOP_CUSTOMER_EMAIL,
          o.U_CustomerEmail
        ),
        eshop_shipping_address: pick(
          o.eshop_shipping_address,
          o.ESHOP_SHIPPING_ADDRESS,
          o.U_ShippingAddressAddress
        ),
        eshop_shipping_mobile: pick(
          o.eshop_shipping_mobile,
          o.ESHOP_SHIPPING_MOBILE,
          o.U_ShippingAddressMobile
        ),
        Status: mapStatus(o),
        DocumentStatus: o.DocStatus === "O" ? "bost_Open" : "bost_Close",
      };
    });

    listCache.set(cacheKey, { time: now, orders });
    return orders;
  } finally {
    try {
      await conn.close();
    } catch (_) {}
  }
}

async function fetchOrderDetail(sapUser, sapPass, docEntry) {
  const loginRes = await axios.post(`${SAP_BASE_URL}/Login`, {
    CompanyDB: COMPANY_DB,
    UserName: sapUser,
    Password: sapPass,
  });

  const sessionId = loginRes.data.SessionId;
  const cookies = loginRes.headers["set-cookie"]?.join(";") || `B1SESSION=${sessionId}`;

  try {
    const res = await axios.get(`${SAP_BASE_URL}/Orders(${docEntry})`, {
      headers: { Cookie: cookies },
    });

    const o = res.data || {};
    const canceled =
      o.CancelStatus === "csYes" ||
      o.CANCELED === "Y" ||
      o.Cancelled === "tYES";

    let Status = "Open";
    if (canceled) Status = "Canceled";
    else if (
      o.DocStatus === "C" ||
      o.DocumentStatus === "bost_Close" ||
      o.DocumentStatus === "C"
    ) {
      Status = "Closed";
    }

    return { ...o, Status };
  } finally {
    // لا ننتظر Logout حتى ما نبطّئ الرد
    axios
      .post(`${SAP_BASE_URL}/Logout`, {}, { headers: { Cookie: cookies } })
      .catch(() => {});
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { sapUser, sapPass, RepID, docEntry, nocache } = body;

    if (!sapUser || !sapPass) {
      return NextResponse.json(
        { error: "بيانات الدخول إلى SAP غير موجودة" },
        { status: 400 }
      );
    }

    // 🔎 تفاصيل أمر واحد (عند فتح الـ popup)
    if (docEntry) {
      const order = await fetchOrderDetail(sapUser, sapPass, docEntry);
      return NextResponse.json({ success: true, order });
    }

    // ⚡ قائمة سريعة من HANA بدون Login لـ Service Layer
    const orders = await fetchOrdersList(RepID, { nocache: !!nocache });
    return NextResponse.json({ success: true, orders });
  } catch (err) {
    console.error("❌ SAP Fetch Orders Error:", err.response?.data || err?.odbcErrors || err.message);
    const msg =
      err.response?.data?.error?.message?.value ||
      err?.odbcErrors?.[0]?.message ||
      err.message ||
      "فشل جلب أوامر البيع.";
    return NextResponse.json({ error: msg, odbcErrors: err.odbcErrors || null }, { status: 500 });
  }
}
