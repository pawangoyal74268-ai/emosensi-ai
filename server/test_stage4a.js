// Automated Test Suite for Stage 4A: Text Analysis & AI Assistant
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

const TEST_PORT = 5056;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

function createTestApp() {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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

async function runStage4Tests() {
  console.log("\n=======================================================");
  console.log("  EMOSENSE AI — STAGE 4A TEXT ANALYSIS & AI ASSISTANT");
  console.log("=======================================================\n");

  const app = createTestApp();
  const server = app.listen(TEST_PORT);

  try {
    const timestamp = Date.now();
    const userAEmail = `stage4_userA_${timestamp}@emosense.test`;
    const userBEmail = `stage4_userB_${timestamp}@emosense.test`;

    // -----------------------------------------------------------
    // 1. Setup Test Users
    // -----------------------------------------------------------
    console.log("--- 1. Setup Test Users ---");
    const regARes = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userAEmail, password: "Password123!", name: "Alice Journaler" }),
    });
    const regAData = await regARes.json();
    assert(regARes.status === 201, "User A registered successfully");
    const tokenA = regAData.token;
    const userAId = regAData.user.id;

    const regBRes = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userBEmail, password: "Password123!", name: "Bob Explorer" }),
    });
    const regBData = await regBRes.json();
    assert(regBRes.status === 201, "User B registered successfully");
    const tokenB = regBData.token;
    const userBId = regBData.user.id;

    // -----------------------------------------------------------
    // 2. Health & AI Provider Detection
    // -----------------------------------------------------------
    console.log("\n--- 2. Health & AI Provider Identification ---");
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, "GET /api/health returns 200 ok");
    assert(healthData.status === "ok", "Backend health status is 'ok'");
    assert(Boolean(healthData.ai), "AI provider metadata present in health check");
    assert(Boolean(healthData.ai?.provider), `Active AI provider identified: ${healthData.ai?.provider}`);
    assert(Boolean(healthData.ai?.mode), `AI provider operational mode: ${healthData.ai?.mode}`);

    // -----------------------------------------------------------
    // 3. Text Analysis Endpoints
    // -----------------------------------------------------------
    console.log("\n--- 3. Text Analysis Endpoints ---");

    // Unauthenticated rejection
    const unauthAnalysis = await fetch(`${BASE_URL}/analysis/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Feeling overwhelmed with work today." }),
    });
    assert(unauthAnalysis.status === 401, "Unauthenticated text analysis rejected with 401");

    // Empty text validation failure
    const emptyTextRes = await fetch(`${BASE_URL}/analysis/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ text: "   " }),
    });
    assert(emptyTextRes.status === 400, "Empty text submission rejected with 400 VALIDATION_ERROR");

    // Valid text analysis: Stressed/anxious journal entry
    const journal1 =
      "I have so many project deadlines due tomorrow and I feel completely stressed and anxious. I am worried I won't finish in time and running on empty.";
    const analysisRes1 = await fetch(`${BASE_URL}/analysis/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ text: journal1, saveMood: true }),
    });
    const data1 = await analysisRes1.json();
    assert(analysisRes1.status === 201, "Text analysis created successfully (201)");
    assert(
      analysisRes1.headers.get("x-backend-service") === "EmoSense-Express-Local",
      "Analysis response header confirms local Express backend execution (X-Backend-Service: EmoSense-Express-Local)"
    );
    assert(data1._handledBy === "emosense-local-express", "Analysis payload confirms handledBy: emosense-local-express");
    assert(
      data1.analysis?.dominant_mood === "stressed" || data1.analysis?.dominant_mood === "anxious",
      `Detected dominant mood matches stressed/anxious (got ${data1.analysis?.dominant_mood})`
    );
    assert(data1.analysis?.stress_level >= 6, `Stress level is elevated (got ${data1.analysis?.stress_level})`);
    assert(Boolean(data1.analysis?.summary), "Summary text is returned");
    assert(Boolean(data1.analysis?.observations), "Emotional observations are returned");
    assert(Array.isArray(data1.analysis?.recommendations), "Wellness recommendations is an array");
    assert(data1.analysis?.recommendations.length >= 3, "At least 3 recommendations provided");
    assert(
      data1.analysis?.disclaimer.includes("not a clinical assessment"),
      "Explicit non-diagnostic clinical disclaimer present in output"
    );
    assert(Boolean(data1.record?.id), "AnalysisRecord ID returned in response");
    assert(Boolean(data1.moodEntry?.id), "Linked MoodEntry ID created in database");
    const aliceRecordId = data1.record.id;

    // Verify persisted in SQLite database
    const dbRecord = await prisma.analysisRecord.findUnique({
      where: { id: aliceRecordId },
    });
    assert(dbRecord !== null, "AnalysisRecord persisted in SQLite database");
    assert(dbRecord?.userId === userAId, "AnalysisRecord correctly linked to User A");
    assert(dbRecord?.analysisType === "text", "AnalysisRecord analysisType is 'text'");

    // -----------------------------------------------------------
    // 3. Analysis Privacy & Multi-User Isolation
    // -----------------------------------------------------------
    console.log("\n--- 3. Analysis Privacy & Record Security ---");

    // Alice retrieves her analysis records
    const aliceListRes = await fetch(`${BASE_URL}/analysis`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const aliceList = await aliceListRes.json();
    assert(aliceListRes.status === 200, "Alice retrieves her analysis history");
    assert(aliceList.count === 1, "Alice has exactly 1 analysis record");

    // Bob retrieves his analysis records (must be 0!)
    const bobListRes = await fetch(`${BASE_URL}/analysis`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const bobList = await bobListRes.json();
    assert(bobListRes.status === 200, "Bob retrieves his analysis history");
    assert(bobList.count === 0, "Bob cannot view Alice's analysis records (count is 0)");

    // Bob attempts to view Alice's analysis record by ID
    const bobSpyRecord = await fetch(`${BASE_URL}/analysis/${aliceRecordId}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(bobSpyRecord.status === 404, "Bob cannot access Alice's private analysis record by ID (404)");

    // Bob attempts to delete Alice's analysis record
    const bobDeleteRecord = await fetch(`${BASE_URL}/analysis/${aliceRecordId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(bobDeleteRecord.status === 404, "Bob cannot delete Alice's analysis record (404)");

    // -----------------------------------------------------------
    // 4. Conversational AI Assistant & Messages
    // -----------------------------------------------------------
    console.log("\n--- 4. Chat Assistant & Conversational Flow ---");

    // Unauthenticated chat message rejection
    const unauthChat = await fetch(`${BASE_URL}/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Hello EmoSense" }),
    });
    assert(unauthChat.status === 401, "Unauthenticated chat message rejected with 401");

    // Short message test: length matching
    const shortMsgRes = await fetch(`${BASE_URL}/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ message: "Feeling okay today." }),
    });
    const shortData = await shortMsgRes.json();
    assert(shortMsgRes.status === 200, "Chat message returns 200");
    assert(
      shortMsgRes.headers.get("x-backend-service") === "EmoSense-Express-Local",
      "Chat message response header confirms local Express backend (X-Backend-Service: EmoSense-Express-Local)"
    );
    assert(shortData._handledBy === "emosense-local-express", "Chat message payload confirms handledBy: emosense-local-express");
    assert(Boolean(shortData.provider), `Chat message reports active AI provider (${shortData.provider})`);
    assert(Boolean(shortData.reply), "Assistant reply is populated");
    assert(Boolean(shortData.detectedMood), "Assistant detects mood from message");

    // -----------------------------------------------------------
    // 5. Chat Sessions Lifecycle & Multi-User Isolation
    // -----------------------------------------------------------
    console.log("\n--- 5. Chat Sessions Lifecycle & Persistence ---");

    // Create session for Alice
    const sessionRes = await fetch(`${BASE_URL}/chat/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ title: "Alice Evening Check-in" }),
    });
    const sessionData = await sessionRes.json();
    assert(sessionRes.status === 201, "ChatSession created with 201");
    const aliceSessionId = sessionData.session?.id;
    assert(Boolean(aliceSessionId), "Session ID returned");

    // Send message linked to active sessionId
    const msgInSessionRes = await fetch(`${BASE_URL}/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        message: "I took a slow walk in the park and feel much more relaxed and calm now.",
        sessionId: aliceSessionId,
      }),
    });
    assert(msgInSessionRes.status === 200, "Message in session processed with 200");
    assert(
      msgInSessionRes.headers.get("x-backend-service") === "EmoSense-Express-Local",
      "Session message header confirms local Express backend (X-Backend-Service: EmoSense-Express-Local)"
    );

    // Verify messages saved in SQLite database
    const dbMessages = await prisma.chatMessage.findMany({
      where: { sessionId: aliceSessionId },
    });
    assert(dbMessages.length >= 2, `Session messages persisted in SQLite (found ${dbMessages.length})`);
    assert(dbMessages.some((m) => m.role === "user"), "User message persisted");
    assert(dbMessages.some((m) => m.role === "assistant"), "Assistant message persisted");

    // Bob tries to access Alice's session
    const bobSessionSpy = await fetch(`${BASE_URL}/chat/sessions/${aliceSessionId}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(bobSessionSpy.status === 404, "Bob cannot access Alice's chat session (404)");

    // Bob tries to complete Alice's session
    const bobCompleteSpy = await fetch(`${BASE_URL}/chat/sessions/${aliceSessionId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    assert(bobCompleteSpy.status === 404, "Bob cannot complete Alice's chat session (404)");

    // Alice completes her session
    const completeRes = await fetch(`${BASE_URL}/chat/sessions/${aliceSessionId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        messages: [
          { role: "user", content: "I had a stressful morning with work." },
          { role: "assistant", content: "I hear you, stress can be overwhelming." },
          { role: "user", content: "Then I rested and feel peaceful and calm now." },
        ],
      }),
    });
    const completeData = await completeRes.json();
    assert(completeRes.status === 200, "Alice completes session successfully (200)");
    assert(
      completeRes.headers.get("x-backend-service") === "EmoSense-Express-Local",
      "Complete session header confirms local Express backend (X-Backend-Service: EmoSense-Express-Local)"
    );
    assert(completeData._handledBy === "emosense-local-express", "Complete session payload confirms handledBy: emosense-local-express");
    assert(Boolean(completeData.analysis?.overall_mood), "Overall mood generated");
    assert(Boolean(completeData.analysis?.summary), "Session summary generated");
    assert(
      completeData.analysis?.disclaimer.includes("not a clinical assessment"),
      "Non-diagnostic disclaimer present in session completion"
    );
    assert(Boolean(completeData.analysisRecordId), "AnalysisRecord saved from session completion");
    assert(Boolean(completeData.moodEntry?.id), "MoodEntry created from session completion");

    // Clean up test users
    await prisma.user.deleteMany({
      where: { id: { in: [userAId, userBId] } },
    });
    console.log("\nStage 4A test artifacts cleaned up from database.");
  } finally {
    server.close();
    await prisma.$disconnect();
  }

  console.log("\n=======================================================");
  console.log(`STAGE 4A SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runStage4Tests().catch((err) => {
  console.error("Unhandled Stage 4A test execution error:", err);
  process.exit(1);
});
