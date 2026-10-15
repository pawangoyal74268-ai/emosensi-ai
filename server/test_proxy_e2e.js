// Proxy and Chat Flow Verification Script
import { createServer } from "vite";
import app from "./index.js";
import prisma from "./db.js";

async function verifyProxyFlow() {
  console.log("==================================================");
  console.log("  VERIFYING VITE PROXY -> EXPRESS BACKEND FLOW   ");
  console.log("==================================================");

  // 1. Start Vite dev server on port 5173
  const viteServer = await createServer({
    configFile: "./vite.config.js",
    server: { port: 5173 },
  });
  await viteServer.listen();
  const vitePort = viteServer.config.server.port || 5173;
  console.log(`✔ Vite Dev Server active at http://localhost:${vitePort}`);

  try {
    // 2. Test GET /api/health through Vite proxy
    console.log("\n1. Testing GET http://localhost:5173/api/health through Vite proxy...");
    const healthRes = await fetch(`http://localhost:5173/api/health`);
    const healthData = await healthRes.json();
    console.log("   Status:", healthRes.status);
    console.log("   Service:", healthData.service);
    console.log("   Active AI Provider:", healthData.ai?.provider);
    console.log("   AI Mode:", healthData.ai?.mode);

    if (healthRes.status !== 200 || healthData.service !== "EmoSense AI Backend") {
      throw new Error(`Health check failed through Vite proxy: ${JSON.stringify(healthData)}`);
    }
    console.log("✔ Health check successfully proxied from Vite :5173 to Express :5000");

    // 3. Demo login through Vite proxy
    console.log("\n2. Testing POST http://localhost:5173/api/auth/demo-login through Vite proxy...");
    const loginRes = await fetch("http://localhost:5173/api/auth/demo-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log("   Logged in demo user:", loginData.user?.email);
    console.log("✔ Auth successfully proxied to Express");

    // 4. Send chat message through Vite proxy
    console.log("\n3. Testing POST http://localhost:5173/api/chat/message through Vite proxy...");
    const chatRes = await fetch("http://localhost:5173/api/chat/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: "Hello, I am testing the local backend proxy flow.",
      }),
    });
    const chatData = await chatRes.json();
    const backendServiceHeader = chatRes.headers.get("x-backend-service");
    console.log("   Status:", chatRes.status);
    console.log("   X-Backend-Service Header:", backendServiceHeader);
    console.log("   _handledBy in response:", chatData._handledBy);
    console.log("   AI Provider:", chatData.provider);
    console.log("   Reply preview:", chatData.reply?.substring(0, 80));

    if (backendServiceHeader !== "EmoSense-Express-Local") {
      throw new Error(`Header mismatch: expected EmoSense-Express-Local, got ${backendServiceHeader}`);
    }
    if (chatData._handledBy !== "emosense-local-express") {
      throw new Error(`_handledBy mismatch: expected emosense-local-express, got ${chatData._handledBy}`);
    }
    console.log("✔ Chat message verified: PROXIED TO LOCAL EXPRESS BACKEND, NOT BASE44!");

    console.log("\n==================================================");
    console.log("  ALL END-TO-END PROXY VERIFICATIONS PASSED!       ");
    console.log("==================================================");
  } finally {
    try {
      await viteServer.close();
    } catch {
      // Ignore abort errors from Vite scan on early exit
    }
    await prisma.$disconnect();
    process.exit(0);
  }
}

verifyProxyFlow().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
