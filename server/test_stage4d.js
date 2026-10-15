// Automated Test Suite for Stage 4D: Zero Runtime Base44 Dependencies & Coherent Guest Flow
import fs from "fs";
import path from "path";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import prisma from "./db.js";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import moodsRouter from "./routes/moods.js";
import analyticsRouter from "./routes/analytics.js";
import doctorsRouter from "./routes/doctors.js";
import appointmentsRouter from "./routes/appointments.js";
import analysisRouter from "./routes/analysis.js";
import chatRouter from "./routes/chat.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const TEST_PORT = 5059;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

function createTestApp() {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use((req, res, next) => {
    res.setHeader("X-Backend-Service", "EmoSense-Express-Local");
    next();
  });

  app.use("/api", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/moods", moodsRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/doctors", doctorsRouter);
  app.use("/api/appointments", appointmentsRouter);
  app.use("/api/analysis", analysisRouter);
  app.use("/api/chat", chatRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

let passed = 0;
let failed = 0;

function assert(condition, testName, details = "") {
  if (condition) {
    passed += 1;
    console.log(`  ✔ PASS: ${testName}`);
  } else {
    failed += 1;
    console.error(`  ✖ FAIL: ${testName} ${details ? `(${details})` : ""}`);
  }
}

async function runStage4dTests() {
  console.log("\n=======================================================");
  console.log("  EMOSENSE AI — STAGE 4D ZERO RUNTIME BASE44 TEST SUITE");
  console.log("=======================================================\n");

  const app = createTestApp();
  const server = app.listen(TEST_PORT);

  try {
    // -----------------------------------------------------------
    // 1. Static Audit: Prove Zero Runtime Imports in UI Pages/Components
    // -----------------------------------------------------------
    console.log("--- 1. Static Audit: Zero Runtime Base44 Imports in Pages & Components ---");
    const srcDir = path.resolve(process.cwd(), "src");

    const activeFilesToCheck = [
      "pages/Home.jsx",
      "pages/History.jsx",
      "pages/Doctors.jsx",
      "pages/Chat.jsx",
      "pages/Voice.jsx",
      "pages/Face.jsx",
      "pages/Settings.jsx",
      "components/mood/MoodLogger.jsx",
      "components/voice/VoiceAnalyzer.jsx",
      "components/face/FaceAnalyzer.jsx",
      "lib/NavigationTracker.jsx",
      "lib/PageNotFound.jsx",
    ];

    for (const relPath of activeFilesToCheck) {
      const fullPath = path.join(srcDir, relPath);
      const content = fs.readFileSync(fullPath, "utf-8");
      const hasBase44Import = /from\s+["'][^"']*base44[^"']*["']/i.test(content);
      const hasBase44Call = /\bbase44\.\w+/i.test(content);
      const hasInvokeLLM = /InvokeLLM/i.test(content);
      const hasUploadFile = /UploadFile/i.test(content);

      assert(!hasBase44Import, `${relPath} has no Base44 imports`);
      assert(!hasBase44Call, `${relPath} has no runtime base44.* calls`);
      assert(!hasInvokeLLM, `${relPath} has no InvokeLLM calls`);
      assert(!hasUploadFile, `${relPath} has no UploadFile calls`);
    }

    // -----------------------------------------------------------
    // 2. Guest-Mode & Unauthenticated Endpoint Rejections
    // -----------------------------------------------------------
    console.log("\n--- 2. Guest-Mode & Unauthenticated Endpoint Protection ---");

    // Public endpoints allow guests
    const healthRes = await fetch(`${BASE_URL}/health`);
    assert(healthRes.status === 200, "GET /api/health allows guest access (200 OK)");

    const docsRes = await fetch(`${BASE_URL}/doctors`);
    const docsData = await docsRes.json();
    assert(docsRes.status === 200, "GET /api/doctors allows guest browsing (200 OK)");
    assert(Array.isArray(docsData.doctors) && docsData.doctors.length > 0, "Guest can browse doctor directory");

    // Protected endpoints strictly reject unauthenticated requests (never leaking or writing)
    const protectedEndpoints = [
      { method: "GET", path: "/moods", desc: "GET /api/moods" },
      { method: "POST", path: "/moods", body: { mood: "happy", moodScore: 8 }, desc: "POST /api/moods" },
      { method: "GET", path: "/appointments", desc: "GET /api/appointments" },
      { method: "POST", path: "/appointments", body: { doctorId: "xyz" }, desc: "POST /api/appointments" },
      { method: "POST", path: "/chat/message", body: { message: "Hello" }, desc: "POST /api/chat/message" },
      { method: "POST", path: "/analysis/text", body: { text: "I feel good" }, desc: "POST /api/analysis/text" },
      { method: "GET", path: "/analysis", desc: "GET /api/analysis" },
    ];

    for (const ep of protectedEndpoints) {
      const res = await fetch(`${BASE_URL}${ep.path}`, {
        method: ep.method,
        headers: { "Content-Type": "application/json" },
        body: ep.body ? JSON.stringify(ep.body) : undefined,
      });
      const data = await res.json();
      assert(res.status === 401, `Unauthenticated ${ep.desc} returns 401 Unauthorized`);
      assert(data.error?.code === "UNAUTHORIZED", `${ep.desc} error code is UNAUTHORIZED`);
    }

    // -----------------------------------------------------------
    // 3. Authenticated Flow & Persistence Integrity
    // -----------------------------------------------------------
    console.log("\n--- 3. Authenticated Flow & Local Express Execution ---");
    const timestamp = Date.now();
    const userAEmail = `stage4d_alice_${timestamp}@emosense.test`;
    const userBEmail = `stage4d_bob_${timestamp}@emosense.test`;

    const regARes = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userAEmail, password: "Password123!", name: "Alice Stage4D" }),
    });
    const regAData = await regARes.json();
    assert(regARes.status === 201, "User A registered successfully");
    const tokenA = regAData.token;
    const userAId = regAData.user.id;

    const regBRes = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userBEmail, password: "Password123!", name: "Bob Stage4D" }),
    });
    const regBData = await regBRes.json();
    assert(regBRes.status === 201, "User B registered successfully");
    const tokenB = regBData.token;
    const userBId = regBData.user.id;

    // User A logs mood check-in
    const moodRes = await fetch(`${BASE_URL}/moods`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        mood: "calm",
        moodScore: 8,
        stressLevel: 2,
        notes: "Grounded morning check-in",
      }),
    });
    const moodData = await moodRes.json();
    assert(moodRes.status === 201, "User A records manual mood check-in (201 Created)");
    assert(moodRes.headers.get("x-backend-service") === "EmoSense-Express-Local", "Response has X-Backend-Service header");

    // User A books an appointment
    const firstDoctor = docsData.doctors[0];
    const apptRes = await fetch(`${BASE_URL}/appointments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        doctorId: firstDoctor.id,
        date: "2026-10-15",
        time: "10:00",
        consultationType: "video",
        notes: "Initial consultation",
      }),
    });
    const apptData = await apptRes.json();
    assert(apptRes.status === 201, "User A books appointment with local backend (201 Created)");

    // User A chats with AI
    const chatRes = await fetch(`${BASE_URL}/chat/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        message: "I am feeling peaceful and ready for the week.",
      }),
    });
    const chatData = await chatRes.json();
    assert(chatRes.status === 200, "User A chats via local Express backend (200 OK)");
    assert(chatData._handledBy === "emosense-local-express", "Chat handled by emosense-local-express");
    assert(Boolean(chatData.reply), "AI reply generated successfully");

    // -----------------------------------------------------------
    // 4. Strict User-Data Isolation & Privacy Protection
    // -----------------------------------------------------------
    console.log("\n--- 4. User-Data Isolation & Ownership Verification ---");

    // User A views their history
    const userAMoodsRes = await fetch(`${BASE_URL}/moods`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const userAMoodsData = await userAMoodsRes.json();
    assert(userAMoodsData.entries.length === 1, "User A sees exactly 1 mood check-in");

    const userAApptsRes = await fetch(`${BASE_URL}/appointments`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const userAApptsData = await userAApptsRes.json();
    assert(userAApptsData.appointments.length === 1, "User A sees exactly 1 appointment");

    // User B checks history -> MUST BE ZERO
    const userBMoodsRes = await fetch(`${BASE_URL}/moods`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const userBMoodsData = await userBMoodsRes.json();
    assert(userBMoodsData.entries.length === 0, "User B sees ZERO of User A's mood entries");

    const userBApptsRes = await fetch(`${BASE_URL}/appointments`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const userBApptsData = await userBApptsRes.json();
    assert(userBApptsData.appointments.length === 0, "User B sees ZERO of User A's appointments");

    // User B tries to cancel or access User A's appointment -> 404
    const directApptAccess = await fetch(`${BASE_URL}/appointments/${apptData.appointment.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(directApptAccess.status === 404, "User B cannot view User A's appointment (404 Not Found)");

    // -----------------------------------------------------------
    // 5. Cleanup
    // -----------------------------------------------------------
    console.log("\n--- 5. Cleanup & Teardown ---");
    await prisma.appointment.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.moodEntry.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.chatMessage.deleteMany({ where: { session: { userId: { in: [userAId, userBId] } } } });
    await prisma.chatSession.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    assert(true, "Test data cleanly deleted from SQLite database");

  } catch (error) {
    console.error("Test execution exception:", error);
    failed += 1;
  } finally {
    server.close();
  }

  console.log("\n=======================================================");
  console.log(`  STAGE 4D RESULTS:  ${passed} PASSED  |  ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runStage4dTests();
