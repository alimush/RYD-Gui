export const runtime = "nodejs";
import { NextResponse } from "next/server";

const CONN_STR =
  "DRIVER={HDBODBC};SERVERNODE=hanab1:30015;UID=SYSTEM;PWD=Skytech@1234;CHAR_AS_UTF8=1";

const cache = new Map();
const CACHE_TTL = 10 * 1000;

const PRIMARY_IP = "http://172.30.30.96:3003";
const FALLBACK_IP = "http://109.205.118.249:3003";
const DEFAULT_IMAGE = "http://172.30.30.96:3003/no-image.jpg";

async function getOdbc() {
  // استيراد ديناميكي — يمنع رجوع HTML 500 لو فشل تحميل المكتبة الأصلية
  const odbc = await import("odbc");
  return odbc.default || odbc;
}

function mapItems(result) {
  return result.map((r) => {
    const pic = (r.PicturName || "").trim();
    return {
      ItemCode: r.ItemCode,
      ItemName: r.ItemName,
      U_ST_Model: r.U_ST_Model,
      U_ST_PartNo: r.U_ST_PartNo,
      U_ST_LV1: r.U_ST_LV1,
      U_ST_LV2: r.U_ST_LV2,
      SWW: r.SWW,
      TotalAvailable: Number(r.TotalAvailable || 0),
      Price: Number(r.WarehousePrice?.toFixed?.(2) || r.WarehousePrice || 0),
      image: pic ? `${PRIMARY_IP}/${pic}` : DEFAULT_IMAGE,
      fallbackImage: pic ? `${FALLBACK_IP}/${pic}` : DEFAULT_IMAGE,
    };
  });
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim().toLowerCase() || "";

    // بدون بحث لا نجلب كل المواد (ثقيل ويسبب 500)
    if (!q) {
      return NextResponse.json([]);
    }

    if (q.length < 3) {
      return NextResponse.json([]);
    }

    const cacheKey = `items_${q}`;
    const now = Date.now();

    if (cache.has(cacheKey)) {
      const data = cache.get(cacheKey);
      if (now - data.time < CACHE_TTL) {
        return NextResponse.json(data.result);
      }
    }

    const odbc = await getOdbc();
    const conn = await odbc.connect(CONN_STR);

    try {
      const sql = `
        SELECT 
          oitm."ItemCode",
          oitm."ItemName",
          oitm."U_ST_Model",
          oitm."U_ST_PartNo",
          oitm."U_ST_LV1",
          oitm."U_ST_LV2",
          oitm."SWW",
          oitm."PicturName",
          SUM(oitw."OnHand" - oitw."IsCommited") AS "TotalAvailable",
          AVG(NULLIF(oitw."AvgPrice", 0)) AS "WarehousePrice"
        FROM "RYD"."OITM" oitm
        LEFT JOIN "RYD"."OITW" oitw 
          ON oitm."ItemCode" = oitw."ItemCode"
        WHERE oitm."validFor" = 'Y'
          AND (
            LOWER(oitm."ItemCode") LIKE '%${q}%'
            OR LOWER(oitm."ItemName") LIKE '%${q}%'
            OR LOWER(oitm."U_ST_Model") LIKE '%${q}%'
            OR LOWER(oitm."U_ST_PartNo") LIKE '%${q}%'
            OR LOWER(oitm."SWW") LIKE '%${q}%'
          )
        GROUP BY 
          oitm."ItemCode",
          oitm."ItemName",
          oitm."U_ST_Model",
          oitm."U_ST_PartNo",
          oitm."U_ST_LV1",
          oitm."U_ST_LV2",
          oitm."SWW",
          oitm."PicturName"
        ORDER BY "TotalAvailable" DESC
        LIMIT 50
      `;

      const result = await conn.query(sql);
      const items = mapItems(result);

      cache.set(cacheKey, { time: now, result: items });
      return NextResponse.json(items);
    } finally {
      try {
        await conn.close();
      } catch (_) {}
    }
  } catch (err) {
    console.error("❌ SAP fetch error:", err);
    return NextResponse.json(
      {
        error: "Failed to fetch items",
        details: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}
