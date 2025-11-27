export const runtime = "nodejs";
import odbc from "odbc";

// 🚀 Connection Pool
const pool = await odbc.pool(
  'DRIVER={HDBODBC};SERVERNODE=hanab1:30015;UID=SYSTEM;PWD=Skytech@1234;CHAR_AS_UTF8=1',
  { connectionTimeout: 5, loginTimeout: 5 }
);

// 🔥 Cache
const cache = new Map();
const CACHE_TTL = 10 * 1000; // 10 seconds

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim().toLowerCase() || "";

    // 🔒 شرط: إذا المستخدم كتب أقل من 3 أحرف — رجّع مصفوفة فارغة
    if (q.length > 0 && q.length < 3) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const cacheKey = `items_${q}`;
    const now = Date.now();

    // 🚀 Cache hit
    if (cache.has(cacheKey)) {
      const data = cache.get(cacheKey);
      if (now - data.time < CACHE_TTL) {
        return new Response(JSON.stringify(data.result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const conn = await pool.connect();

    // ⚡ Query
    let sql = `
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
      FROM "DEMO_RYD_05102025"."OITM" oitm
      LEFT JOIN "DEMO_RYD_05102025"."OITW" oitw 
        ON oitm."ItemCode" = oitw."ItemCode"
      WHERE oitm."validFor" = 'Y'
    `;

    if (q) {
      sql += `
        AND (
          LOWER(oitm."ItemCode") LIKE '%${q}%'
          OR LOWER(oitm."ItemName") LIKE '%${q}%'
          OR LOWER(oitm."U_ST_Model") LIKE '%${q}%'
          OR LOWER(oitm."U_ST_PartNo") LIKE '%${q}%'
          OR LOWER(oitm."SWW") LIKE '%${q}%'
        )
      `;
    }

    sql += `
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
      LIMIT 20
    `;

    const result = await conn.query(sql);

    const defaultImage = "http://109.205.118.249:3002/no-image.jpg";

    const items = result.map((r) => {
      const pic = (r.PicturName || "").trim();
      const imageUrl = pic
        ?  `http://109.205.118.249:8777/${pic}`
        : defaultImage;

      return {
        ItemCode: r.ItemCode,
        ItemName: r.ItemName,
        U_ST_Model: r.U_ST_Model,
        U_ST_PartNo: r.U_ST_PartNo,
        U_ST_LV1: r.U_ST_LV1,
        U_ST_LV2: r.U_ST_LV2,
        SWW: r.SWW,
        TotalAvailable: Number(r.TotalAvailable || 0),
        Price: Number(r.WarehousePrice?.toFixed(2) || 0),
        image: imageUrl,
      };
    });

    // 🧊 Cache save
    cache.set(cacheKey, { time: now, result: items });

    return new Response(JSON.stringify(items), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("❌ SAP fetch error:", err);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch items",
        details: err.message,
      }),
      { status: 500 }
    );
  }
}