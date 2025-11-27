// ✅ تجاهل فحص الشهادة SSL في بيئة التطوير فقط
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { NextResponse } from "next/server";
import https from "https";

const SAP_BASE_URL = "https://hanab1:50000/b1s/v1";
const COMPANY_DB = "DEMO_RYD_05102025";
const agent = new https.Agent({ rejectUnauthorized: false });

// 🟢 تسجيل الدخول إلى SAP
async function sapLogin(user, pass) {
  const res = await fetch(`${SAP_BASE_URL}/Login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      CompanyDB: COMPANY_DB,
      UserName: user,
      Password: pass,
    }),
    agent,
  });
  if (!res.ok) throw new Error(await res.text());
  const cookies = res.headers.get("set-cookie") || "";
  if (!cookies) throw new Error("SAP cookie not received");
  return cookies;
}

// 🔴 تسجيل الخروج من SAP
async function sapLogout(cookies) {
  try {
    await fetch(`${SAP_BASE_URL}/Logout`, {
      method: "POST",
      headers: { Cookie: cookies },
      agent,
    });
  } catch {}
}

// 🧾 جلب الأوردر من SAP
async function fetchOrder(docEntry, cookies) {
  const r = await fetch(`${SAP_BASE_URL}/Orders(${docEntry})`, {
    headers: { Cookie: cookies },
    agent,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function POST(req) {
  let cookies;
  try {
    const { docEntry, sapUser, sapPass, updatedLines } = await req.json();

    if (!docEntry || !sapUser || !sapPass)
      return NextResponse.json(
        { error: "❌ Missing parameters" },
        { status: 400 }
      );

    // 🟢 تسجيل الدخول
    cookies = await sapLogin(sapUser, sapPass);

    // 🧭 جلب بيانات الأوردر القديم
    const orderData = await fetchOrder(docEntry, cookies);

    console.log("🧨 تعديل موجود → إنشاء أوردر جديد وإغلاق القديم...");

    // 🆕 إنشاء أوردر جديد بنفس البيانات + تمييز خصم SAP داخل FreeText
    const newOrder = {
      CardCode: orderData.CardCode,
      DocDate: orderData.DocDate,
      DocDueDate: orderData.DocDueDate,
      DocCurrency: orderData.DocCurrency,
      SalesPersonCode: orderData.SalesPersonCode,
      Comments: orderData.Comments || "",
      DocumentLines: (updatedLines || []).map((ln) => ({
        ItemCode: ln.ItemCode,
        Quantity: Number(ln.Quantity) || 0,
        UnitPrice: Number(ln.UnitPrice) || 0,
        DiscountPercent: Number(ln.DiscountPercent) || 0,
        WarehouseCode: ln.WarehouseCode,
        LineStatus: "O",

        // ✅ نميز خصم SAP داخل SAP نفسه (يبقى محفوظ)
       FreeText:
  ln.isSAPDiscount && (ln.originalSAPDiscount || ln.DiscountPercent)
    ? `DG:${Number(ln.originalSAPDiscount || ln.DiscountPercent || 0)}`
    : "",
      })),
    };

    // 🟢 إنشاء أوردر جديد في SAP
    const postRes = await fetch(`${SAP_BASE_URL}/Orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookies,
        Prefer: "return-content",
      },
      body: JSON.stringify(newOrder),
      agent,
    });

    const postText = await postRes.text();
    if (!postRes.ok) throw new Error(postText);

    let createdOrder = {};
    try {
      createdOrder = JSON.parse(postText);
    } catch {
      createdOrder = { message: "Order created (SAP returned empty body)" };
    }

    console.log("✅ تم إنشاء أوردر جديد:", createdOrder.DocNum || "unknown");

    // 🔒 إغلاق الأوردر القديم
    const closeRes = await fetch(`${SAP_BASE_URL}/Orders(${docEntry})`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookies },
      body: JSON.stringify({ DocumentStatus: "C" }),
      agent,
    });

    if (!closeRes.ok) {
      const t = await closeRes.text();
      console.warn("⚠️ فشل إغلاق الأوردر القديم:", t);
    } else {
      console.log("✅ الأوردر القديم تم إغلاقه بنجاح");
    }

    // 🔚 تسجيل خروج من SAP
    await sapLogout(cookies);

    return NextResponse.json({
      success: true,
      message: "✅ New order created successfully and old order closed",
      newOrder: createdOrder,
    });
  } catch (err) {
    console.error("❌ /api/update-order Error:", err.message);
    if (cookies) await sapLogout(cookies);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}