export const runtime = "nodejs";
import odbc from "odbc";

const CONN_STR =
  'DRIVER={HDBODBC};SERVERNODE=hanab1:30015;UID=SYSTEM;PWD=Skytech@1234;CHAR_AS_UTF8=1';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim().toLowerCase() || "";

    const conn = await odbc.connect(CONN_STR);

    // ✅ الكويري تجيب السعر الحقيقي من المخزن (AvgPrice)
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
        COALESCE(
          AVG(NULLIF(oitw."AvgPrice", 0)),
          0
        ) AS "WarehousePrice"  -- ✅ متوسط الكلفة الفعلية فقط إذا مو صفر
      FROM "DEMO_RYD_05102025"."OITM" oitm
      LEFT JOIN "DEMO_RYD_05102025"."OITW" oitw 
        ON oitm."ItemCode" = oitw."ItemCode"
      WHERE oitm."validFor" = 'Y'
    `;

    // 🔍 فلترة البحث
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
    `;

    const result = await conn.query(sql);
    await conn.close();

    console.log("📦 Sample item (from warehouse):", result[0]);

    const defaultImage = "http://172.30.30.237:9086/12007777.jpg";

    const items = result.map((r) => {
      const pic = (r.PicturName || "").trim();
      const imageUrl = pic
        ? `http://172.30.30.237:9086/${pic}`
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
        Price: Number(r.WarehousePrice?.toFixed(2) || 0), // ✅ السعر من AvgPrice
        image: imageUrl,
      };
    });

    return new Response(JSON.stringify(items), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("❌ SAP fetch error:", err);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch items from warehouse",
        details: err.message,
      }),
      { status: 500 }
    );
  }
}