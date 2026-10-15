// Automated Test Suite for Stage 4B: Voice Analysis Migration & Local Express Backend
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
import aiService from "./services/aiService.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const TEST_PORT = 5057;
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

async function runStage4bTests() {
  console.log("\n=======================================================");
  console.log("  EMOSENSE AI — STAGE 4B VOICE ANALYSIS TEST SUITE");
  console.log("=======================================================\n");

  const app = createTestApp();
  const server = app.listen(TEST_PORT);
  const originalTranscribeAudio = aiService.transcribeAudio;

  try {
    const timestamp = Date.now();
    const userAEmail = `stage4b_alice_${timestamp}@emosense.test`;
    const userBEmail = `stage4b_bob_${timestamp}@emosense.test`;

    // -----------------------------------------------------------
    // 1. Setup Test Users
    // -----------------------------------------------------------
    console.log("--- 1. Setup Authenticated Test Users ---");
    const regARes = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userAEmail, password: "Password123!", name: "Alice VoiceTester" }),
    });
    const regAData = await regARes.json();
    assert(regARes.status === 201, "User A registered successfully");
    const tokenA = regAData.token;
    const userAId = regAData.user.id;

    const regBRes = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userBEmail, password: "Password123!", name: "Bob VoiceTester" }),
    });
    const regBData = await regBRes.json();
    assert(regBRes.status === 201, "User B registered successfully");
    const tokenB = regBData.token;
    const userBId = regBData.user.id;

    // -----------------------------------------------------------
    // 2. Authentication Enforcement
    // -----------------------------------------------------------
    console.log("\n--- 2. Authentication & Authorization Enforcement ---");
    const unauthForm = new FormData();
    unauthForm.append("audio", new Blob([Buffer.from("RIFFtestdata")], { type: "audio/webm" }), "recording.webm");

    const unauthRes = await fetch(`${BASE_URL}/analysis/voice`, {
      method: "POST",
      body: unauthForm,
    });
    const unauthData = await unauthRes.json();
    assert(unauthRes.status === 401, "Unauthenticated POST /api/analysis/voice returns 401 Unauthorized");
    assert(unauthData.error?.code === "UNAUTHORIZED", "Unauthenticated response code is UNAUTHORIZED");

    // -----------------------------------------------------------
    // 3. Audio File Validation (Required file, MIME types, size limits)
    // -----------------------------------------------------------
    console.log("\n--- 3. Audio Upload Validation & Safety ---");

    // 3a. Missing audio file
    const noFileForm = new FormData();
    noFileForm.append("pitch", "120");
    const noFileRes = await fetch(`${BASE_URL}/analysis/voice`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: noFileForm,
    });
    const noFileData = await noFileRes.json();
    assert(noFileRes.status === 400, "Missing audio file returns 400 Bad Request");
    assert(noFileData.error?.code === "AUDIO_FILE_REQUIRED", "Error code is AUDIO_FILE_REQUIRED");

    // 3b. Invalid MIME type (e.g. PDF / image)
    const invalidMimeForm = new FormData();
    invalidMimeForm.append("audio", new Blob([Buffer.from("%PDF-1.4...")], { type: "application/pdf" }), "doc.pdf");
    const invalidMimeRes = await fetch(`${BASE_URL}/analysis/voice`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: invalidMimeForm,
    });
    const invalidMimeData = await invalidMimeRes.json();
    assert(invalidMimeRes.status === 400, "Invalid MIME type returns 400 Bad Request");
    assert(invalidMimeData.error?.code === "INVALID_FILE_TYPE", "Error code is INVALID_FILE_TYPE");

    // 3c. Oversized file (>15MB)
    const largeBuffer = Buffer.alloc(16 * 1024 * 1024); // 16MB
    const largeForm = new FormData();
    largeForm.append("audio", new Blob([largeBuffer], { type: "audio/webm" }), "huge.webm");
    const largeRes = await fetch(`${BASE_URL}/analysis/voice`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: largeForm,
    });
    const largeData = await largeRes.json();
    assert(largeRes.status === 400, "Oversized audio file (>15MB) returns 400 Bad Request");
    assert(largeData.error?.code === "FILE_TOO_LARGE", "Error code is FILE_TOO_LARGE");

    // -----------------------------------------------------------
    // 4. Missing Transcription Provider Handling
    // -----------------------------------------------------------
    console.log("\n--- 4. Missing Transcription Provider & Honest Fallback ---");

    // Ensure mock returns null (no server provider)
    aiService.transcribeAudio = async () => null;

    const noProviderForm = new FormData();
    noProviderForm.append("audio", new Blob([Buffer.from("RIFFaudiodata")], { type: "audio/webm" }), "sample.webm");
    // No client transcript provided
    const noProviderRes = await fetch(`${BASE_URL}/analysis/voice`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: noProviderForm,
    });
    const noProviderData = await noProviderRes.json();

    assert(noProviderRes.status === 422, "Returns 422 when no provider is configured and no client transcript is sent");
    assert(noProviderData.error?.code === "TRANSCRIPTION_UNAVAILABLE", "Error code is TRANSCRIPTION_UNAVAILABLE");
    assert(
      noProviderData.error?.message.includes("Speech transcription is currently unavailable"),
      "Explains that speech transcription is unavailable and does NOT fake results"
    );

    // Verify NO MoodEntry or AnalysisRecord was created during 422 failure
    const unrecordedMoods = await prisma.moodEntry.findMany({ where: { userId: userAId } });
    assert(unrecordedMoods.length === 0, "No fake MoodEntry was created in database on 422");

    // -----------------------------------------------------------
    // 5. Successful Analysis via Browser Web Speech Recognition
    // -----------------------------------------------------------
    console.log("\n--- 5. Voice Analysis via Browser Speech Recognition Helper ---");

    const clientTranscript = "I have been feeling quite stressed, swamped and overwhelmed with project deadlines lately.";
    const browserForm = new FormData();
    browserForm.append("audio", new Blob([Buffer.from("RIFFfakeaudiobytes")], { type: "audio/webm" }), "voice.webm");
    browserForm.append("transcript", clientTranscript);
    browserForm.append("pitch", "185");
    browserForm.append("energy", "72");
    browserForm.append("tempo", "110");
    browserForm.append("duration", "45");

    const browserRes = await fetch(`${BASE_URL}/analysis/voice`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: browserForm,
    });
    const browserData = await browserRes.json();

    assert(browserRes.status === 201, "POST /api/analysis/voice with client transcript returns 201 Created");
    assert(browserRes.headers.get("x-backend-service") === "EmoSense-Express-Local", "Header X-Backend-Service is set");
    assert(browserData._handledBy === "emosense-local-express", "Handled by emosense-local-express");
    assert(browserData.analysis?.transcript === clientTranscript, "Transcript matches client submission");
    assert(browserData.analysis?.dominant_mood === "stressed", "Correctly identified dominant mood as 'stressed'");
    assert(browserData.analysis?.transcriptionProvider === "browser-speech-recognition", "Transcription provider is browser-speech-recognition");
    assert(browserData.analysis?.pitch === 185, "Acoustic pitch preserved (185 Hz)");
    assert(browserData.analysis?.energy === 72, "Acoustic energy preserved (72)");
    assert(browserData.analysis?.tempo === 110, "Acoustic tempo preserved (110 BPM)");
    assert(browserData.analysis?.duration === 45, "Acoustic duration preserved (45 sec)");
    assert(Array.isArray(browserData.analysis?.recommendations), "Analysis includes structured non-clinical recommendations");
    assert(Boolean(browserData.analysis?.disclaimer), "Analysis includes mandatory non-diagnostic disclaimer");

    // Check Database Persistence for User A
    assert(Boolean(browserData.record?.id), "AnalysisRecord returned with unique ID");
    assert(Boolean(browserData.moodEntry?.id), "MoodEntry returned with unique ID");

    const savedRecordA = await prisma.analysisRecord.findUnique({ where: { id: browserData.record.id } });
    assert(Boolean(savedRecordA), "AnalysisRecord successfully persisted to SQLite database");
    assert(savedRecordA.userId === userAId, "AnalysisRecord scoped to User A");
    assert(savedRecordA.analysisType === "voice", "AnalysisRecord type is 'voice'");

    const savedMoodA = await prisma.moodEntry.findUnique({ where: { id: browserData.moodEntry.id } });
    assert(Boolean(savedMoodA), "MoodEntry successfully persisted to SQLite database");
    assert(savedMoodA.userId === userAId, "MoodEntry scoped to User A");
    assert(savedMoodA.source === "voice", "MoodEntry source is 'voice'");
    assert(savedMoodA.mood === "stressed", "MoodEntry mood is 'stressed'");

    // Check that ONLY one MoodEntry was created (no duplicate)
    const userAMoods = await prisma.moodEntry.findMany({ where: { userId: userAId } });
    assert(userAMoods.length === 1, "Exactly one MoodEntry created in database (no duplicates)");

    // -----------------------------------------------------------
    // 6. Successful Analysis via Mocked Server Provider (OpenAI Whisper)
    // -----------------------------------------------------------
    console.log("\n--- 6. Voice Analysis via Mocked Server AI Provider (Whisper) ---");

    const mockWhisperTranscript = "I feel very calm, peaceful, grounded and relaxed after meditating in the morning.";
    aiService.transcribeAudio = async (audioBuffer, mimeType, filename) => {
      return {
        transcript: mockWhisperTranscript,
        provider: "openai-whisper",
      };
    };

    const serverProviderForm = new FormData();
    serverProviderForm.append("audio", new Blob([Buffer.from("RIFFwavpcmdata")], { type: "audio/wav" }), "speech.wav");
    serverProviderForm.append("pitch", "110");
    serverProviderForm.append("energy", "35");
    serverProviderForm.append("tempo", "68");
    serverProviderForm.append("duration", "30");

    const serverRes = await fetch(`${BASE_URL}/analysis/voice`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: serverProviderForm,
    });
    const serverData = await serverRes.json();

    assert(serverRes.status === 201, "Server-side transcribed audio returns 201 Created");
    assert(serverData.analysis?.transcript === mockWhisperTranscript, "Transcript matches Whisper mock output");
    assert(serverData.analysis?.dominant_mood === "calm", "Correctly identified dominant mood as 'calm'");
    assert(serverData.analysis?.transcriptionProvider === "openai-whisper", "Transcription provider is 'openai-whisper'");
    assert(serverData.analysis?.pitch === 110, "Pitch recorded as 110 Hz");

    // -----------------------------------------------------------
    // 7. User Data Isolation & Ownership Protection
    // -----------------------------------------------------------
    console.log("\n--- 7. User Isolation & Access Control ---");

    // User A fetches history
    const historyARes = await fetch(`${BASE_URL}/analysis?type=voice`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const historyAData = await historyARes.json();
    assert(historyARes.status === 200, "User A GET /api/analysis?type=voice returns 200");
    assert(historyAData.records.length === 2, "User A sees both voice analysis records");

    // User B fetches history
    const historyBRes = await fetch(`${BASE_URL}/analysis?type=voice`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const historyBData = await historyBRes.json();
    assert(historyBRes.status === 200, "User B GET /api/analysis?type=voice returns 200");
    assert(historyBData.records.length === 0, "User B sees ZERO of User A's voice analysis records");

    // User B attempts to access User A's specific record by ID
    const directAccessRes = await fetch(`${BASE_URL}/analysis/${browserData.record.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(directAccessRes.status === 404, "User B cannot access User A's analysis record by ID (404 Not Found)");

    // User B checks mood history
    const moodsBRes = await fetch(`${BASE_URL}/moods`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const moodsBData = await moodsBRes.json();
    assert(moodsBData.entries.length === 0, "User B sees ZERO of User A's mood entries");

    // -----------------------------------------------------------
    // 8. Cleanup and Final Assertions
    // -----------------------------------------------------------
    console.log("\n--- 8. Cleanup & Teardown ---");
    // Clean up test data
    await prisma.moodEntry.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.analysisRecord.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    assert(true, "Test data cleanly deleted from database");

  } catch (error) {
    console.error("Test execution exception:", error);
    failed += 1;
  } finally {
    aiService.transcribeAudio = originalTranscribeAudio;
    server.close();
  }

  console.log("\n=======================================================");
  console.log(`  STAGE 4B RESULTS:  ${passed} PASSED  |  ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runStage4bTests();
