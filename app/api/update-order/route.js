// ✅ تجاهل فحص الشهادة SSL في بيئة التطوير فقط
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { NextResponse } from "next/server";
import https from "https";

const SAP_BASE_URL = "https://hanab1:50000/b1s/v1";
const COMPANY_DB = "RYD";
const agent = new https.Agent({ rejectUnauthorized: false });

function num(x) {
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
}
function str(x) {
  return String(x ?? "").trim();
}

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

function normalizeIncomingLine(ln) {
  return {
    LineNum: ln.LineNum ?? ln.LineId ?? ln.lineNum ?? null, // القديم لازم بيه LineNum
    ItemCode: str(ln.ItemCode),
    Quantity: num(ln.Quantity),
    UnitPrice: num(ln.UnitPrice),
    DiscountPercent: num(ln.DiscountPercent),
    WarehouseCode: str(ln.WarehouseCode),
    FreeText: str(ln.FreeText),
  };
}

export async function POST(req) {
  let cookies;

  try {
    const body = await req.json();

    const { docEntry, sapUser, sapPass, updatedLines, headerUpdates } = body;

    // ✅ حماية: هذا الـ API ممنوع يغير حالة الأوردر
    if (body?.DocumentStatus !== undefined || body?.Canceled !== undefined || body?.Cancelled !== undefined) {
      return NextResponse.json(
        { error: "❌ ممنوع إرسال DocumentStatus/Canceled إلى update-order" },
        { status: 400 }
      );
    }

    if (!docEntry || !sapUser || !sapPass) {
      return NextResponse.json(
        { error: "❌ Missing parameters (docEntry, sapUser, sapPass)" },
        { status: 400 }
      );
    }

    if (!Array.isArray(updatedLines)) {
      return NextResponse.json(
        { error: "❌ updatedLines لازم يكون Array" },
        { status: 400 }
      );
    }

    console.log("✅ UPDATE-ORDER called", { docEntry });

    cookies = await sapLogin(sapUser, sapPass);

    // جلب الأوردر الحالي فقط حتى نتحقق من LineNum
    const orderData = await fetchOrder(docEntry, cookies);
    const sapLineNums = new Set(
      (orderData.DocumentLines || []).map((l) => Number(l.LineNum))
    );

    const incoming = updatedLines.map(normalizeIncomingLine);

    // ✅ نبني updates + inserts بدون تكرار
    const updatesMap = new Map(); // LineNum -> obj
    const insertsMap = new Map(); // Item|Whs|Price|Disc|FreeText -> obj (merge qty)

    for (const ln of incoming) {
      const isNew = ln.LineNum === null || ln.LineNum === undefined || ln.LineNum === "";

      if (isNew) {
        if (!ln.ItemCode || ln.Quantity <= 0) continue;

        const k = [
          ln.ItemCode,
          ln.WarehouseCode || "",
          ln.UnitPrice,
          ln.DiscountPercent,
          ln.FreeText || "",
        ].join("|");

        if (!insertsMap.has(k)) {
          insertsMap.set(k, {
            ItemCode: ln.ItemCode,
            Quantity: ln.Quantity,
            UnitPrice: ln.UnitPrice,
            DiscountPercent: ln.DiscountPercent,
            WarehouseCode: ln.WarehouseCode || undefined,
            FreeText: ln.FreeText || "",
          });
        } else {
          const cur = insertsMap.get(k);
          cur.Quantity = num(cur.Quantity) + ln.Quantity;
          insertsMap.set(k, cur);
        }

        continue;
      }

      // ✅ سطر قديم لازم LineNum موجود فعلاً بالأوردر
      const lineNum = Number(ln.LineNum);
      if (!sapLineNums.has(lineNum)) {
        // إذا LineNum غلط، لا نسويه Update حتى لا يسبب -2035
        // نخليه Insert (سطر جديد)
        if (!ln.ItemCode || ln.Quantity <= 0) continue;

        const k = [
          ln.ItemCode,
          ln.WarehouseCode || "",
          ln.UnitPrice,
          ln.DiscountPercent,
          ln.FreeText || "",
        ].join("|");

        if (!insertsMap.has(k)) {
          insertsMap.set(k, {
            ItemCode: ln.ItemCode,
            Quantity: ln.Quantity,
            UnitPrice: ln.UnitPrice,
            DiscountPercent: ln.DiscountPercent,
            WarehouseCode: ln.WarehouseCode || undefined,
            FreeText: ln.FreeText || "",
          });
        } else {
          const cur = insertsMap.get(k);
          cur.Quantity = num(cur.Quantity) + ln.Quantity;
          insertsMap.set(k, cur);
        }
        continue;
      }

      updatesMap.set(lineNum, {
        LineNum: lineNum,
        Quantity: ln.Quantity,
        UnitPrice: ln.UnitPrice,
        DiscountPercent: ln.DiscountPercent,
        WarehouseCode: ln.WarehouseCode || undefined,
        FreeText: ln.FreeText || "",
      });
    }

    const updateLines = Array.from(updatesMap.values());
    const insertLines = Array.from(insertsMap.values());

    // ✅ Header updates (اختياري) بدون حالة
    const headerPatch = {};
    if (headerUpdates && typeof headerUpdates === "object") {
      const allowed = ["Comments", "DocDueDate", "DocDate", "NumAtCard", "U_Approval"];
      for (const k of allowed) {
        if (headerUpdates[k] !== undefined) headerPatch[k] = headerUpdates[k];
      }
    }

    if (!updateLines.length && !insertLines.length && !Object.keys(headerPatch).length) {
      await sapLogout(cookies);
      return NextResponse.json({ success: true, message: "✅ لا يوجد تغييرات" });
    }

    const patchBody = {
      ...headerPatch,
      DocumentLines: [...updateLines, ...insertLines],
    };

    // 🔥 هذا الهيدر مهم حتى ما يستبدل كل السطور
    const patchRes = await fetch(`${SAP_BASE_URL}/Orders(${docEntry})`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookies,
        Prefer: "return-content",
        "B1S-ReplaceCollectionsOnPatch": "false",
      },
      body: JSON.stringify(patchBody),
      agent,
    });

    const patchText = await patchRes.text();
    if (!patchRes.ok) throw new Error(patchText);

    let updatedOrder;
    try {
      updatedOrder = JSON.parse(patchText);
    } catch {
      updatedOrder = await fetchOrder(docEntry, cookies);
    }

    await sapLogout(cookies);

    return NextResponse.json({
      success: true,
      message: "✅ Updated (no cancel/close touched)",
      order: updatedOrder,
    });
  } catch (err) {
    console.error("❌ update-order error:", err?.message || err);
    if (cookies) await sapLogout(cookies);
    return NextResponse.json(
      { error: err?.message || "Update failed" },
      { status: 500 }
    );
  }
}