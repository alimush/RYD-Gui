import { NextResponse } from "next/server";
import axios from "axios";
import https from "https";

// 🧩 SAP Connection Settings
const SAP_BASE_URL = "https://hanab1:50000/b1s/v1";
const COMPANY_DB = "DEMO_RYD_05102025";

export async function POST(req) {
  try {
    const { docEntry, sapUser, sapPass } = await req.json();

    if (!docEntry)
      return NextResponse.json(
        { error: "❌ Missing sales order DocEntry" },
        { status: 400 }
      );

    if (!sapUser || !sapPass)
      return NextResponse.json(
        { error: "❌ Missing SAP user credentials" },
        { status: 400 }
      );

    console.log(`🔐 Logging into SAP to cancel order #${docEntry} by ${sapUser}`);

    // ✅ SAP Login
    const loginRes = await axios.post(
      `${SAP_BASE_URL}/Login`,
      {
        CompanyDB: COMPANY_DB,
        UserName: sapUser,
        Password: sapPass,
      },
      { httpsAgent: new https.Agent({ rejectUnauthorized: false }) }
    );

    const sessionId = loginRes.data?.SessionId;
    const cookies = loginRes.headers["set-cookie"];
    const routeId = cookies
      ?.find((c) => c.includes("ROUTEID"))
      ?.split(";")[0]
      ?.split("=")[1];

    if (!sessionId)
      return NextResponse.json(
        { error: "Failed to create SAP session (SessionId missing)" },
        { status: 401 }
      );

    console.log(`✅ Active SAP session for ${sapUser}`);

    // 🟥 Cancel the order
    const cancelRes = await axios.post(
      `${SAP_BASE_URL}/Orders(${docEntry})/Cancel`,
      {},
      {
        headers: {
          Cookie: `B1SESSION=${sessionId}; ROUTEID=${routeId}`,
          "Content-Type": "application/json",
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      }
    );

    console.log(`🧾 Sales order #${docEntry} successfully canceled`);

    // 🔒 Logout
    await axios.post(
      `${SAP_BASE_URL}/Logout`,
      {},
      {
        headers: {
          Cookie: `B1SESSION=${sessionId}; ROUTEID=${routeId}`,
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      }
    );

    return NextResponse.json({
      success: true,
      message: `✅ Sales order #${docEntry} canceled successfully`,
      docNum: cancelRes.data?.DocNum,
    });
  } catch (err) {
    console.error("❌ SAP Cancel Error:", err.response?.data || err.message);

    return NextResponse.json(
      {
        error:
          err.response?.data?.error?.message?.value ||
          "An error occurred while canceling the sales order in SAP.",
      },
      { status: 500 }
    );
  }
}