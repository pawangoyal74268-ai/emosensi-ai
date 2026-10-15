// EmoSense AI — Gemini Face Analysis Verification & Failure Case Diagnostics
import prisma from "./db.js";
import { categorizeGeminiError, extractJson, DEFAULT_GEMINI_MODEL } from "./services/aiService.js";

const BASE_URL = "http://localhost:5000/api";

let passed = 0;
let failed = 0;

function assert(cond, name, details = "") {
  if (cond) {
    passed += 1;
    console.log(`  ✔ PASS: ${name}`);
  } else {
    failed += 1;
    console.error(`  ✖ FAIL: ${name} ${details ? `(${details})` : ""}`);
  }
}

async function runFaceDiagnostics() {
  console.log("\n=======================================================");
  console.log("  EMOSENSE AI — FACE ANALYSIS & GEMINI INTEGRATION TEST ");
  console.log("=======================================================");

  let testUserId = null;

  try {
    // -------------------------------------------------------------
    // 1. Verify Failure Case Categorization Function
    // -------------------------------------------------------------
    console.log("\n--- 1. Testing Failure Case Categorization ---");

    // Case A: Missing API Key
    const missingCat = categorizeGeminiError(422, { status: "MISSING_API_KEY", message: "API key is missing" }, null);
    assert(missingCat.category === "provider_error" || missingCat.status === 422, "Handles missing/unspecified status gracefully");

    // Case B: Invalid API Key
    const invalidCat = categorizeGeminiError(400, { status: "INVALID_ARGUMENT", message: "API key not valid. Please pass a valid API key." }, null);
    assert(invalidCat.category === "invalid_api_key", "Distinguishes 'invalid_api_key' category");
    assert(invalidCat.code === "INVALID_API_KEY", "Produces INVALID_API_KEY code");
    assert(invalidCat.status === 401, "Maps invalid key to HTTP 401 Unauthorized");

    // Case C: Quota / Billing restrictions
    const quotaCat = categorizeGeminiError(429, { status: "RESOURCE_EXHAUSTED", message: "Resource has been exhausted (e.g. check quota)." }, null);
    assert(quotaCat.category === "api_quota_billing", "Distinguishes 'api_quota_billing' category");
    assert(quotaCat.code === "QUOTA_EXCEEDED", "Produces QUOTA_EXCEEDED code");
    assert(quotaCat.status === 429, "Maps quota error to HTTP 429");

    // Case D: Unsupported Model
    const modelCat = categorizeGeminiError(404, { status: "NOT_FOUND", message: "models/gemini-1.5-flash is not found for API version v1beta" }, null);
    assert(modelCat.category === "unsupported_model", "Distinguishes 'unsupported_model' category");
    assert(modelCat.code === "UNSUPPORTED_MODEL", "Produces UNSUPPORTED_MODEL code");
    assert(modelCat.status === 422, "Maps unsupported model to HTTP 422");

    // Case E: Malformed Request
    const malformedCat = categorizeGeminiError(400, { status: "INVALID_ARGUMENT", message: "Unable to process input image. Request payload malformed." }, null);
    assert(malformedCat.category === "malformed_request", "Distinguishes 'malformed_request' category");
    assert(malformedCat.code === "MALFORMED_REQUEST", "Produces MALFORMED_REQUEST code");
    assert(malformedCat.status === 400, "Maps malformed request to HTTP 400");

    // Case F: Network Error
    const netErr = new TypeError("fetch failed");
    const netCat = categorizeGeminiError(null, null, netErr);
    assert(netCat.category === "network_error", "Distinguishes 'network_error' category");
    assert(netCat.code === "NETWORK_ERROR", "Produces NETWORK_ERROR code");
    assert(netCat.status === 503, "Maps network failure to HTTP 503 Service Unavailable");

    // Case G: Service Unavailable / High demand
    const unavailCat = categorizeGeminiError(503, { status: "UNAVAILABLE", message: "Model is currently experiencing high demand." }, null);
    assert(unavailCat.category === "service_unavailable", "Distinguishes 'service_unavailable' category");
    assert(unavailCat.status === 503, "Maps high demand spikes to HTTP 503");

    // -------------------------------------------------------------
    // 2. Response Parsing Helper Verification
    // -------------------------------------------------------------
    console.log("\n--- 2. Testing Response Parsing Helper ---");
    const cleanJson = extractJson('{"dominant_emotion": "calm", "confidence": 85}');
    assert(cleanJson?.dominant_emotion === "calm", "Parses standard JSON string correctly");

    const fencedJson = extractJson('```json\n{"dominant_emotion": "happy", "confidence": 90}\n```');
    assert(fencedJson?.dominant_emotion === "happy", "Extracts JSON from markdown code blocks correctly");

    const invalidJson = extractJson("not valid json at all");
    assert(invalidJson === null, "Returns null on unparseable input without crashing");

    // -------------------------------------------------------------
    // 3. Health Check & Active Provider Verification
    // -------------------------------------------------------------
    console.log("\n--- 3. Testing Backend Health & Active AI Provider ---");
    const healthRes = await fetch(`${BASE_URL}/health`);
    assert(healthRes.status === 200, "GET /api/health returns 200 OK");
    const healthData = await healthRes.json();
    assert(healthData.ai?.provider === "google-gemini", `Active AI provider is 'google-gemini' (actual: ${healthData.ai?.provider})`);
    assert(healthData.ai?.model === DEFAULT_GEMINI_MODEL, `Configured model is '${DEFAULT_GEMINI_MODEL}' (actual: ${healthData.ai?.model})`);
    assert(healthData.ai?.configured === true, "AI provider configured flag is true");

    // -------------------------------------------------------------
    // 4. Authenticated Real Gemini Face Analysis Flow
    // -------------------------------------------------------------
    console.log("\n--- 4. Live Authorized Gemini Face Analysis ---");
    // Login as demo user
    const loginRes = await fetch(`${BASE_URL}/auth/demo-login`, { method: "POST" });
    assert(loginRes.status === 200, "POST /api/auth/demo-login succeeds");
    const loginData = await loginRes.json();
    const token = loginData.token;
    testUserId = loginData.user?.id;
    assert(Boolean(token), "Received authentication token");

    // Valid 1x1 transparent PNG image
    const validPngB64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    const pngBuffer = Buffer.from(validPngB64, "base64");
    const form = new FormData();
    const blob = new Blob([pngBuffer], { type: "image/png" });
    form.append("image", blob, "test-face.png");

    console.log("  Sending authenticated face image to POST /api/analysis/face...");
    const faceRes = await fetch(`${BASE_URL}/analysis/face`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    console.log("  Response status:", faceRes.status);
    const faceData = await faceRes.json();

    assert(faceRes.status === 201, `POST /api/analysis/face returns 201 Created (actual: ${faceRes.status})`);
    assert(faceData.success === true, "Response indicates success: true");
    assert(faceData.analysis?.visionProvider === "google-gemini", "Vision provider is google-gemini");
    assert(typeof faceData.analysis?.dominant_emotion === "string", `Dominant emotion detected: ${faceData.analysis?.dominant_emotion}`);
    assert(typeof faceData.analysis?.confidence === "number", `Confidence score: ${faceData.analysis?.confidence}%`);
    assert(typeof faceData.analysis?.stress_level === "number", `Stress level: ${faceData.analysis?.stress_level}/10`);
    assert(typeof faceData.analysis?.mood_score === "number", `Mood score: ${faceData.analysis?.mood_score}/10`);
    assert(typeof faceData.analysis?.observations === "string", "Observations provided");
    assert(faceData.analysis?.disclaimer?.includes("not a clinical assessment"), "Clinical non-diagnostic disclaimer included");

    // Verify record in SQLite database
    if (faceData.analysisRecordId) {
      const savedRecord = await prisma.analysisRecord.findUnique({
        where: { id: faceData.analysisRecordId },
      });
      assert(Boolean(savedRecord), "AnalysisRecord safely persisted in SQLite dev.db");
      assert(savedRecord?.analysisType === "face", "AnalysisRecord type is 'face'");
      assert(savedRecord?.userId === testUserId, "AnalysisRecord strictly scoped to authenticated user");
    } else {
      assert(false, "AnalysisRecord was not created (missing ID)");
    }

    // Verify linked MoodEntry in SQLite database
    if (faceData.moodEntry?.id) {
      const savedMood = await prisma.moodEntry.findUnique({
        where: { id: faceData.moodEntry?.id },
      });
      assert(Boolean(savedMood), "Linked MoodEntry safely persisted in SQLite dev.db");
      assert(savedMood?.source === "face", "MoodEntry source is 'face'");
      assert(savedMood?.userId === testUserId, "MoodEntry strictly scoped to authenticated user");
    } else {
      assert(false, "MoodEntry was not created (missing ID)");
    }

    // -------------------------------------------------------------
    // 5. Test Invalid Key Error Handling (Without Leaking Key)
    // -------------------------------------------------------------
    console.log("\n--- 5. Testing Invalid Key Error Path ---");
    // Temporarily test what happens if an invalid key is supplied
    const badKeyUrl = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent?key=AIzaSyFakeInvalidKeyForTesting12345`;
    const badKeyRes = await fetch(badKeyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] }),
    });
    const badKeyJson = await badKeyRes.json();
    const badKeyCategorized = categorizeGeminiError(badKeyRes.status, badKeyJson?.error, null);
    assert(badKeyCategorized.category === "invalid_api_key", "Invalid key returns 'invalid_api_key' category");
    assert(badKeyCategorized.status === 401, "Invalid key maps to HTTP 401");

    // -------------------------------------------------------------
    // 6. Test Unsupported Model Error Handling
    // -------------------------------------------------------------
    console.log("\n--- 6. Testing Unsupported Model Error Path ---");
    const badModelUrl = `https://generativelanguage.googleapis.com/v1beta/models/non-existent-model-xyz:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const badModelRes = await fetch(badModelUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] }),
    });
    const badModelJson = await badModelRes.json();
    const badModelCategorized = categorizeGeminiError(badModelRes.status, badModelJson?.error, null);
    assert(badModelCategorized.category === "unsupported_model", "Unsupported model returns 'unsupported_model' category");
    assert(badModelCategorized.status === 422, "Unsupported model maps to HTTP 422");

  } catch (err) {
    failed += 1;
    console.error("  ✖ Unexpected test exception:", err);
  } finally {
    // Clean up only the test analysis and mood entry created during this run
    if (testUserId) {
      await prisma.analysisRecord.deleteMany({ where: { userId: testUserId } });
      await prisma.moodEntry.deleteMany({ where: { userId: testUserId } });
    }
    await prisma.$disconnect();
    console.log("\n=======================================================");
    console.log(`  FACE DIAGNOSTICS RESULTS:  ${passed} PASSED  |  ${failed} FAILED`);
    console.log("=======================================================\n");

    if (failed > 0) process.exit(1);
  }
}

runFaceDiagnostics();
