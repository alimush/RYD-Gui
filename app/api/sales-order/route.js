// ✅ تجاهل فحص الشهادة SSL في بيئة التطوير فقط
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { NextResponse } from "next/server";
import axios from "axios";
import odbc from "odbc";

const SAP_BASE_URL = "https://hanab1:50000/b1s/v1";
const HANA_CONN_STR =
  'DRIVER={HDBODBC};SERVERNODE=hanab1:30015;UID=SYSTEM;PWD=Skytech@1234;CHAR_AS_UTF8=1';

// 🟢 إنشاء أمر بيع باستخدام المستخدم من SQL
export async function POST(req) {
  try {
    const body = await req.json();
    const { sapUser, sapPass, RepID } = body;

    if (!sapUser || !sapPass)
      return NextResponse.json(
        { error: "بيانات الدخول إلى SAP غير موجودة" },
        { status: 400 }
      );

    if (!RepID || isNaN(Number(RepID)))
      return NextResponse.json(
        { error: "رقم المندوب (RepID) مفقود أو غير صالح." },
        { status: 400 }
      );

    const repIdNum = Number(RepID);
    console.log(`🔐 محاولة تسجيل الدخول في SAP بواسطة: ${sapUser}`);

    // ✅ تسجيل الدخول بالـ Service Layer باستخدام sapUser
    let loginRes;
    try {
      loginRes = await axios.post(`${SAP_BASE_URL}/Login`, {
        CompanyDB: "DEMO_RYD_05102025",
        UserName: sapUser,
        Password: sapPass,
      });
    } catch (err) {
      console.error("🚫 فشل تسجيل الدخول:", err.response?.data);
      return NextResponse.json(
        {
          error:
            err.response?.data?.error?.message?.value ||
            "فشل تسجيل الدخول إلى SAP. تأكد من اسم المستخدم وكلمة المرور.",
        },
        { status: 401 }
      );
    }

    const sessionId = loginRes.data.SessionId;
    console.log(`✅ تسجيل دخول ناجح إلى SAP بواسطة ${sapUser}`);

    // ✅ تحقق من الكميات قبل إنشاء أمر البيع
    const conn = await odbc.connect(HANA_CONN_STR);

    for (const line of body.DocumentLines || []) {
      const query = `
        SELECT TO_DECIMAL("OnHand" - "IsCommited", 15, 2) AS "Available"
        FROM "DEMO_RYD_05102025"."OITW"
        WHERE "ItemCode" = '${line.ItemCode}'
          AND "WhsCode" = '${line.WarehouseCode}'
      `;
      const result = await conn.query(query);
      const available = Number(result[0]?.Available || 0);

      if (line.Quantity > available) {
        await conn.close();
        return NextResponse.json(
          {
            error: `⚠️ الكمية المطلوبة (${line.Quantity}) تتجاوز المتاحة (${available}) في المخزن ${line.WarehouseCode}`,
          },
          { status: 400 }
        );
      }
    }

    await conn.close();

    // ✅ بناء الطلب النهائي
    const { sapUser: _, sapPass: __, ...sapOrder } = body;
    sapOrder.SalesPersonCode = repIdNum; // ← إضافة رقم المندوب من SQL

    console.log("🧾 Final payload to SAP:", JSON.stringify(sapOrder, null, 2));

    // ✅ إرسال الطلب إلى SAP
    const res = await axios.post(`${SAP_BASE_URL}/Orders`, sapOrder, {
      headers: {
        "Content-Type": "application/json",
        Cookie: `B1SESSION=${sessionId}`,
      },
    });

    const sapResponse = res.data;
    console.log(`🧾 أمر البيع أنشئ بنجاح من قبل ${sapUser}:`, sapResponse);

    return NextResponse.json({
      success: true,
      message: `تم إنشاء أمر البيع بنجاح بواسطة ${sapUser}`,
      docEntry: sapResponse.DocEntry,
      docNum: sapResponse.DocNum,
    });
  } catch (err) {
    console.error("❌ SAP Order Error:", err.response?.data || err.message);
    const errorMsg =
      err.response?.data?.error?.message?.value ||
      err.response?.data ||
      err.message ||
      "حدث خطأ غير متوقع أثناء إنشاء أمر البيع.";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}