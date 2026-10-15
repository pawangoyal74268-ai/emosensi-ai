// Automated Test Suite for Stage 4C: Face Analysis Migration & Local Express Backend
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
import aiService, { CLINICAL_DISCLAIMER } from "./services/aiService.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const TEST_PORT = 5058;
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

async function runStage4cTests() {
  console.log("\n=======================================================");
  console.log("  EMOSENSE AI — STAGE 4C FACE ANALYSIS TEST SUITE");
  console.log("=======================================================\n");

  const app = createTestApp();
  const server = app.listen(TEST_PORT);
  const originalAnalyzeFaceImage = aiService.analyzeFaceImage;

  try {
    const timestamp = Date.now();
    const userAEmail = `stage4c_alice_${timestamp}@emosense.test`;
    const userBEmail = `stage4c_bob_${timestamp}@emosense.test`;

    // -----------------------------------------------------------
    // 1. Setup Test Users
    // -----------------------------------------------------------
    console.log("--- 1. Setup Authenticated Test Users ---");
    const regARes = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userAEmail, password: "Password123!", name: "Alice FaceTester" }),
    });
    const regAData = await regARes.json();
    assert(regARes.status === 201, "User A registered successfully");
    const tokenA = regAData.token;
    const userAId = regAData.user.id;

    const regBRes = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userBEmail, password: "Password123!", name: "Bob FaceTester" }),
    });
    const regBData = await regBRes.json();
    assert(regBRes.status === 201, "User B registered successfully");
    const tokenB = regBData.token;
    const userBId = regBData.user.id;

    // -----------------------------------------------------------
    // 2. Authentication Enforcement
    // -----------------------------------------------------------
    console.log("\n--- 2. Authentication Enforcement ---");
    const unauthForm = new FormData();
    unauthForm.append("image", new Blob([Buffer.from("fake-jpg-content")], { type: "image/jpeg" }), "face.jpg");

    const unauthRes = await fetch(`${BASE_URL}/analysis/face`, {
      method: "POST",
      body: unauthForm,
    });
    const unauthData = await unauthRes.json();
    assert(unauthRes.status === 401, "Unauthenticated POST /api/analysis/face returns 401 Unauthorized");
    assert(unauthData.error?.code === "UNAUTHORIZED", "Unauthenticated response code is UNAUTHORIZED");

    // -----------------------------------------------------------
    // 3. Image Upload Validation & Safety
    // -----------------------------------------------------------
    console.log("\n--- 3. Image Upload Validation & Safety ---");

    // 3a. Missing image file
    const noFileForm = new FormData();
    noFileForm.append("notes", "no image here");
    const noFileRes = await fetch(`${BASE_URL}/analysis/face`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: noFileForm,
    });
    const noFileData = await noFileRes.json();
    assert(noFileRes.status === 400, "Missing image file returns 400 Bad Request");
    assert(noFileData.error?.code === "IMAGE_FILE_REQUIRED", "Error code is IMAGE_FILE_REQUIRED");

    // 3b. Invalid MIME type (e.g., audio, text, or PDF)
    const invalidMimeForm = new FormData();
    invalidMimeForm.append("image", new Blob([Buffer.from("RIFFwavdata")], { type: "audio/wav" }), "audio.wav");
    const invalidMimeRes = await fetch(`${BASE_URL}/analysis/face`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: invalidMimeForm,
    });
    const invalidMimeData = await invalidMimeRes.json();
    assert(invalidMimeRes.status === 400, "Invalid MIME type returns 400 Bad Request");
    assert(invalidMimeData.error?.code === "INVALID_FILE_TYPE", "Error code is INVALID_FILE_TYPE");

    // 3c. Oversized file (>10MB)
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
    const largeForm = new FormData();
    largeForm.append("image", new Blob([largeBuffer], { type: "image/jpeg" }), "large.jpg");
    const largeRes = await fetch(`${BASE_URL}/analysis/face`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: largeForm,
    });
    const largeData = await largeRes.json();
    assert(largeRes.status === 400, "Oversized image (>10MB) returns 400 Bad Request");
    assert(largeData.error?.code === "FILE_TOO_LARGE", "Error code is FILE_TOO_LARGE");

    // -----------------------------------------------------------
    // 4. Missing Vision Provider Configuration & Honest Reporting
    // -----------------------------------------------------------
    console.log("\n--- 4. Missing Vision Provider & Honest Fallback ---");

    // Mock analyzeFaceImage to return null (no vision provider configured)
    aiService.analyzeFaceImage = async () => null;

    const noProviderForm = new FormData();
    noProviderForm.append("image", new Blob([Buffer.from("fake-jpg-bytes")], { type: "image/jpeg" }), "test.jpg");
    const noProviderRes = await fetch(`${BASE_URL}/analysis/face`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: noProviderForm,
    });
    const noProviderData = await noProviderRes.json();

    assert(noProviderRes.status === 422, "Returns 422 Unprocessable Entity when no vision provider is configured");
    assert(noProviderData.error?.code === "VISION_UNAVAILABLE", "Error code is VISION_UNAVAILABLE");
    assert(
      noProviderData.error?.message.includes("Facial expression image analysis is currently unavailable"),
      "Explains that facial expression analysis is unavailable and does NOT fabricate results"
    );

    // Verify NO MoodEntry or AnalysisRecord was created during 422 failure
    const unrecordedMoods = await prisma.moodEntry.findMany({ where: { userId: userAId } });
    assert(unrecordedMoods.length === 0, "No fake MoodEntry was created in database on 422");

    // -----------------------------------------------------------
    // 5. Successful Analysis via Mocked Server Vision Provider
    // -----------------------------------------------------------
    console.log("\n--- 5. Successful Vision Analysis via Mocked Server Provider ---");

    const mockVisionResult = {
      dominant_emotion: "happy",
      confidence: 88,
      stress_level: 2,
      mood_score: 9,
      observations: "Visible relaxed eye tension, subtle cheek elevation, and natural smile curve indicating positive valence.",
      recommendations: [
        "Take a moment to savor what brought a smile to your day.",
        "Share this positive energy with someone close to you.",
      ],
      visionProvider: "google-gemini",
      disclaimer: CLINICAL_DISCLAIMER,
    };

    aiService.analyzeFaceImage = async (buffer, mimeType, filename) => {
      return mockVisionResult;
    };

    const validImageForm = new FormData();
    validImageForm.append("image", new Blob([Buffer.from("valid-jpg-content")], { type: "image/jpeg" }), "face.jpg");

    const successRes = await fetch(`${BASE_URL}/analysis/face`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: validImageForm,
    });
    const successData = await successRes.json();

    assert(successRes.status === 201, "POST /api/analysis/face with valid image returns 201 Created");
    assert(successRes.headers.get("x-backend-service") === "EmoSense-Express-Local", "Header X-Backend-Service is set");
    assert(successData._handledBy === "emosense-local-express", "Handled by emosense-local-express");
    assert(successData.analysis?.dominant_emotion === "happy", "Dominant emotion identified as 'happy'");
    assert(successData.analysis?.confidence === 88, "Confidence matches vision provider (88%)");
    assert(successData.analysis?.stress_level === 2, "Stress level matches vision provider (2)");
    assert(successData.analysis?.visionProvider === "google-gemini", "Vision provider is 'google-gemini'");
    assert(Boolean(successData.analysis?.observations), "Observations text populated");
    assert(Array.isArray(successData.analysis?.recommendations), "Recommendations array populated");
    assert(Boolean(successData.analysis?.disclaimer), "Clinical disclaimer present in analysis result");

    // Database Persistence for User A
    assert(Boolean(successData.record?.id), "AnalysisRecord returned with unique ID");
    assert(Boolean(successData.moodEntry?.id), "MoodEntry returned with unique ID");

    const savedRecord = await prisma.analysisRecord.findUnique({ where: { id: successData.record.id } });
    assert(Boolean(savedRecord), "AnalysisRecord persisted in SQLite database");
    assert(savedRecord.userId === userAId, "AnalysisRecord scoped to User A");
    assert(savedRecord.analysisType === "face", "AnalysisRecord type is 'face'");

    const savedMood = await prisma.moodEntry.findUnique({ where: { id: successData.moodEntry.id } });
    assert(Boolean(savedMood), "MoodEntry persisted in SQLite database");
    assert(savedMood.userId === userAId, "MoodEntry scoped to User A");
    assert(savedMood.source === "face", "MoodEntry source is 'face'");
    assert(savedMood.mood === "happy", "MoodEntry mood is 'happy'");
    assert(Boolean(savedMood.faceAnalysis), "faceAnalysis JSON column populated in MoodEntry");

    // Duplicate Prevention Check: Exactly 1 MoodEntry created
    const userAMoods = await prisma.moodEntry.findMany({ where: { userId: userAId } });
    assert(userAMoods.length === 1, "Exactly one MoodEntry created in database (no duplicates)");

    // -----------------------------------------------------------
    // 6. User Isolation & Access Control
    // -----------------------------------------------------------
    console.log("\n--- 6. User Isolation & Access Control ---");

    // User A fetches history
    const historyARes = await fetch(`${BASE_URL}/analysis?type=face`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const historyAData = await historyARes.json();
    assert(historyARes.status === 200, "User A GET /api/analysis?type=face returns 200");
    assert(historyAData.records.length === 1, "User A sees exactly their 1 face analysis record");

    // User B fetches history
    const historyBRes = await fetch(`${BASE_URL}/analysis?type=face`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const historyBData = await historyBRes.json();
    assert(historyBRes.status === 200, "User B GET /api/analysis?type=face returns 200");
    assert(historyBData.records.length === 0, "User B sees ZERO of User A's face analysis records");

    // User B attempts direct access by ID
    const directAccessRes = await fetch(`${BASE_URL}/analysis/${successData.record.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(directAccessRes.status === 404, "User B cannot access User A's face analysis record (404 Not Found)");

    // User B checks moods
    const moodsBRes = await fetch(`${BASE_URL}/moods`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const moodsBData = await moodsBRes.json();
    assert(moodsBData.entries.length === 0, "User B sees ZERO of User A's face mood entries");

    // -----------------------------------------------------------
    // 7. Cleanup & Teardown
    // -----------------------------------------------------------
    console.log("\n--- 7. Cleanup & Teardown ---");
    await prisma.moodEntry.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.analysisRecord.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    assert(true, "Test data cleanly deleted from SQLite database");

  } catch (error) {
    console.error("Test execution exception:", error);
    failed += 1;
  } finally {
    aiService.analyzeFaceImage = originalAnalyzeFaceImage;
    server.close();
  }

  console.log("\n=======================================================");
  console.log(`  STAGE 4C RESULTS:  ${passed} PASSED  |  ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runStage4cTests();
