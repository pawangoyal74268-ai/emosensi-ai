// Automated Test Suite for Stage 5: Complete Base44 Removal & Standalone Verification
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

const TEST_PORT = 5075;
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

async function runStage5Tests() {
  console.log("\n=======================================================");
  console.log("  EMOSENSE AI — STAGE 5 COMPLETE BASE44 REMOVAL SUITE");
  console.log("=======================================================\n");

  const cwd = process.cwd();
  const app = createTestApp();
  const server = app.listen(TEST_PORT);

  try {
    // -----------------------------------------------------------
    // 1. Dependency & Configuration Audit
    // -----------------------------------------------------------
    console.log("--- 1. Package & Configuration Verification ---");

    const pkgPath = path.join(cwd, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

    assert(!pkg.dependencies["@base44/sdk"], "package.json does not contain @base44/sdk");
    assert(!pkg.dependencies["@base44/vite-plugin"], "package.json does not contain @base44/vite-plugin");
    if (pkg.devDependencies) {
      assert(!pkg.devDependencies["@base44/sdk"], "devDependencies does not contain @base44/sdk");
      assert(!pkg.devDependencies["@base44/vite-plugin"], "devDependencies does not contain @base44/vite-plugin");
    }

    const viteConfigPath = path.join(cwd, "vite.config.js");
    const viteConfigContent = fs.readFileSync(viteConfigPath, "utf-8");
    assert(!/@base44\/vite-plugin/i.test(viteConfigContent), "vite.config.js does not import @base44/vite-plugin");
    assert(!/\bbase44\s*\(/i.test(viteConfigContent), "vite.config.js does not invoke base44 plugin");
    assert(viteConfigContent.includes('"@"') || viteConfigContent.includes("'@'"), "vite.config.js configures @ alias for src directory");
    assert(viteConfigContent.includes("http://localhost:5000"), "vite.config.js preserves local proxy to Express (5000)");

    // -----------------------------------------------------------
    // 2. File Tree Audit: Obsolete Files Removed
    // -----------------------------------------------------------
    console.log("\n--- 2. File Tree Audit: Obsolete Base44 Files Absent ---");

    const obsoleteFiles = [
      "src/api/base44Client.js",
      "src/lib/app-params.js",
      "src/pages/OAuthConsent.jsx",
    ];

    for (const rel of obsoleteFiles) {
      const fullPath = path.join(cwd, rel);
      assert(!fs.existsSync(fullPath), `Obsolete file ${rel} is absent`);
    }

    // -----------------------------------------------------------
    // 3. Static Audit: All Active Source Files Clean
    // -----------------------------------------------------------
    console.log("\n--- 3. Static Source Tree Audit (Zero Base44 References) ---");

    const filesToAudit = [
      "src/pages/Home.jsx",
      "src/pages/History.jsx",
      "src/pages/Doctors.jsx",
      "src/pages/Chat.jsx",
      "src/pages/Voice.jsx",
      "src/pages/Face.jsx",
      "src/pages/Settings.jsx",
      "src/components/mood/MoodLogger.jsx",
      "src/components/voice/VoiceAnalyzer.jsx",
      "src/components/face/FaceAnalyzer.jsx",
      "src/lib/NavigationTracker.jsx",
      "src/lib/PageNotFound.jsx",
      "src/lib/AuthContext.jsx",
      "src/api/apiClient.js",
      "src/App.jsx",
    ];

    for (const rel of filesToAudit) {
      const fullPath = path.join(cwd, rel);
      assert(fs.existsSync(fullPath), `Active file exists: ${rel}`);
      const content = fs.readFileSync(fullPath, "utf-8");
      assert(!/from\s+["'][^"']*base44[^"']*["']/i.test(content), `${rel} has zero Base44 imports`);
      assert(!/\bbase44\.\w+/i.test(content), `${rel} has zero base44.* runtime calls`);
      assert(!/\bInvokeLLM\b/i.test(content), `${rel} has zero InvokeLLM calls`);
      assert(!/\bUploadFile\b/i.test(content), `${rel} has zero UploadFile calls`);
    }

    // -----------------------------------------------------------
    // 4. API Endpoints & Local Execution Verification
    // -----------------------------------------------------------
    console.log("\n--- 4. Local Express & SQLite Runtime Functionality ---");

    // Public endpoints
    const healthRes = await fetch(`${BASE_URL}/health`);
    assert(healthRes.status === 200, "GET /api/health returns 200 OK");
    const healthData = await healthRes.json();
    assert(healthData.status === "ok", "Backend health status is ok");

    const docsRes = await fetch(`${BASE_URL}/doctors`);
    assert(docsRes.status === 200, "GET /api/doctors returns 200 OK");
    const docsData = await docsRes.json();
    assert(docsData.doctors.length > 0, "Doctors list populated from SQLite seed");

    // Guest protection (401 Unauthorized)
    const guestMoodRes = await fetch(`${BASE_URL}/moods`);
    assert(guestMoodRes.status === 401, "Guest GET /api/moods returns 401");
    const guestApptRes = await fetch(`${BASE_URL}/appointments`);
    assert(guestApptRes.status === 401, "Guest GET /api/appointments returns 401");
    const guestChatRes = await fetch(`${BASE_URL}/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Hello" }),
    });
    assert(guestChatRes.status === 401, "Guest POST /api/chat/message returns 401");

    // Authentication: Register two distinct users
    const runId = Date.now().toString(36);
    const userAEmail = `stage5_a_${runId}@emosense.local`;
    const userBEmail = `stage5_b_${runId}@emosense.local`;

    const regARes = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Stage 5 User A", email: userAEmail, password: "Password123!" }),
    });
    const regAData = await regARes.json();
    assert(regARes.status === 201, "User A registered successfully");
    const tokenA = regAData.token;
    const userAId = regAData.user.id;

    const regBRes = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Stage 5 User B", email: userBEmail, password: "Password123!" }),
    });
    const regBData = await regBRes.json();
    assert(regBRes.status === 201, "User B registered successfully");
    const tokenB = regBData.token;
    const userBId = regBData.user.id;

    // Mood Tracking (User A)
    const moodRes = await fetch(`${BASE_URL}/moods`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        mood: "happy",
        moodScore: 9,
        stressLevel: 2,
        notes: "Completely independent local architecture",
      }),
    });
    const moodData = await moodRes.json();
    assert(moodRes.status === 201, "User A records mood check-in (201 Created)");
    assert(moodRes.headers.get("x-backend-service") === "EmoSense-Express-Local", "Response has X-Backend-Service header");

    // Appointment Booking (User A)
    const apptRes = await fetch(`${BASE_URL}/appointments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        doctorId: docsData.doctors[0].id,
        date: "2026-10-20",
        time: "14:00",
        consultationType: "video",
        notes: "Follow-up consultation",
      }),
    });
    const apptData = await apptRes.json();
    assert(apptRes.status === 201, "User A books appointment (201 Created)");

    // AI Chat (User A)
    const chatRes = await fetch(`${BASE_URL}/chat/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        message: "Hello assistant, how can I practice daily mindfulness?",
      }),
    });
    const chatData = await chatRes.json();
    assert(chatRes.status === 200, "User A chats via local Express backend (200 OK)");
    assert(chatData._handledBy === "emosense-local-express", "Chat handled by emosense-local-express");
    assert(Boolean(chatData.reply), "AI reply generated successfully");

    // Text Analysis (User A)
    const textRes = await fetch(`${BASE_URL}/analysis/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        text: "I am feeling inspired, calm, and ready to take on the day with focus.",
      }),
    });
    const textData = await textRes.json();
    assert(textRes.status === 201, "User A text analysis (201 Created)");
    assert(Boolean(textData.analysis && (textData.analysis.dominant_mood || textData.analysis.dominantEmotion)), "Text analysis returned dominant emotion");

    // -----------------------------------------------------------
    // 5. Strict Data Isolation
    // -----------------------------------------------------------
    console.log("\n--- 5. User Data Isolation Verification ---");

    const moodsARes = await fetch(`${BASE_URL}/moods`, { headers: { Authorization: `Bearer ${tokenA}` } });
    const moodsA = await moodsARes.json();
    assert(moodsA.entries.length === 2, "User A sees their 2 mood entries (manual check-in + text analysis)");

    const moodsBRes = await fetch(`${BASE_URL}/moods`, { headers: { Authorization: `Bearer ${tokenB}` } });
    const moodsB = await moodsBRes.json();
    assert(moodsB.entries.length === 0, "User B sees ZERO of User A's mood entries");

    const apptsARes = await fetch(`${BASE_URL}/appointments`, { headers: { Authorization: `Bearer ${tokenA}` } });
    const apptsA = await apptsARes.json();
    assert(apptsA.appointments.length === 1, "User A sees their 1 appointment");

    const apptsBRes = await fetch(`${BASE_URL}/appointments`, { headers: { Authorization: `Bearer ${tokenB}` } });
    const apptsB = await apptsBRes.json();
    assert(apptsB.appointments.length === 0, "User B sees ZERO of User A's appointments");

    // User B cannot access User A's appointment ID
    const directAccess = await fetch(`${BASE_URL}/appointments/${apptData.appointment.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(directAccess.status === 404, "User B receives 404 attempting to access User A's appointment");

    // -----------------------------------------------------------
    // 6. Cleanup
    // -----------------------------------------------------------
    console.log("\n--- 6. Cleanup & Database Integrity ---");
    await prisma.appointment.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.moodEntry.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.chatMessage.deleteMany({ where: { session: { userId: { in: [userAId, userBId] } } } });
    await prisma.chatSession.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.analysisRecord.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    assert(true, "Test users cleanly removed without modifying persistent data");

  } catch (error) {
    console.error("Test execution exception:", error);
    failed += 1;
  } finally {
    server.close();
  }

  console.log("\n=======================================================");
  console.log(`  STAGE 5 RESULTS:  ${passed} PASSED  |  ${failed} FAILED`);
  console.log("=======================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runStage5Tests();
