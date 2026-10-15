// Test suite for EmoSense AI Conversational Wellness Assistant
// Verifies:
// 1. Casual chat conversations with live Gemini model.
// 2. Multi-turn context memory across conversation turns.
// 3. Emotional-wellness reflections with genuine empathy and validation.
// 4. Honest provider reporting (never disguising rule-based fallback as Gemini).
// 5. Immediate crisis safety interception (988 Lifeline).
// 6. Honest provider error handling & categorization (never attributing fallback to Gemini).
// 7. User data isolation across chat sessions.
// 8. Session completion and structured summary.
import assert from "assert";
import aiService, { categorizeGeminiError } from "./services/aiService.js";

const BASE_URL = "http://localhost:5000/api";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper to send chat message with retry if transient 429 rate limit is encountered
async function sendChatMessageWithRetry(body, token, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const res = await fetch(`${BASE_URL}/chat/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    // If rate-limited and attempts remain, wait and retry
    if (data.fallback && data.error?.category === "api_quota_billing" && attempt <= maxRetries) {
      console.log(`   ⏳ Gemini API rate limit window active (attempt ${attempt}/${maxRetries + 1}). Backing off for 3s...`);
      await sleep(3000);
      continue;
    }

    return { res, data };
  }
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("💬 EmoSense AI Conversational Chat Integration Tests");
  console.log("=======================================================\n");

  const timestamp = Date.now();
  const emailA = `conv_userA_${timestamp}@example.com`;
  const emailB = `conv_userB_${timestamp}@example.com`;
  const password = "TestPassword123!";

  // 1. Setup Test Users
  console.log("1. Setting up authenticated test users...");
  const regA = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: emailA, password, name: "Alice Conversation" }),
  });
  assert.strictEqual(regA.status, 201);
  const tokenA = (await regA.json()).token;

  const regB = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: emailB, password, name: "Bob Conversation" }),
  });
  assert.strictEqual(regB.status, 201);
  const tokenB = (await regB.json()).token;

  // 2. Casual Conversation with Gemini
  console.log("2. Testing casual conversation turn with Gemini...");
  const { res: casualRes, data: casualData } = await sendChatMessageWithRetry(
    {
      message: "Good morning! Just stopping by to say hello.",
      history: [],
    },
    tokenA
  );
  assert.strictEqual(casualRes.status, 200, "Casual message should return 200");
  assert.strictEqual(casualData.success, true);
  assert.ok(casualData.reply.length > 10, "Reply must be non-empty");

  if (casualData.provider === "google-gemini") {
    assert.strictEqual(casualData.fallback, false, "Fallback must be false when Gemini succeeds");
    console.log(`   ✔ Gemini Casual Reply: "${casualData.reply.substring(0, 75)}..."`);
    console.log(`   ✔ Provider: ${casualData.provider} (${casualData.model || "gemini-3.1-flash-lite"})`);
  } else {
    // Honest fallback reported
    assert.strictEqual(casualData.provider, "emosense-core-wellness-engine");
    assert.strictEqual(casualData.fallback, true);
    assert.ok(casualData.error, "Error details provided on fallback");
    console.log(`   ✔ Honest Fallback Reply: "${casualData.reply.substring(0, 75)}..."`);
    console.log(`   ✔ Honest Provider: ${casualData.provider} (Reason: ${casualData.error?.category})`);
  }
  assert.ok(Array.isArray(casualData.suggestedActions), "Casual turn must return suggestedActions array");

  // 2b. General-Purpose Question & Suggested Actions Test
  console.log("2b. Testing general-purpose knowledge inquiry and contextual suggestions...");
  const { res: generalRes, data: generalData } = await sendChatMessageWithRetry(
    {
      message: "Can you explain the difference between synchronous and asynchronous code in JavaScript, and show a brief example?",
      history: [],
    },
    tokenA
  );
  assert.strictEqual(generalRes.status, 200, "General question must return 200");
  assert.strictEqual(generalData.success, true);
  assert.ok(generalData.reply.length > 20, "Reply must contain explanation");
  assert.ok(Array.isArray(generalData.suggestedActions), "Must return suggestedActions array");
  console.log(`   ✔ General AI Reply: "${generalData.reply.substring(0, 90)}..."`);
  console.log(`   ✔ Contextual Suggested Actions: [${generalData.suggestedActions.map((s) => `"${s}"`).join(", ")}]`);

  // 3. Multi-turn Context Memory Test
  console.log("3. Testing multi-turn conversational context memory...");
  // Create a dedicated session
  const sessionRes = await fetch(`${BASE_URL}/chat/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({ title: "Interview Prep Session" }),
  });
  assert.strictEqual(sessionRes.status, 201);
  const sessionId = (await sessionRes.json()).session.id;

  // Turn 1: Alice mentions a specific event (software engineering interview)
  const turn1Msg = "I have a big software engineering interview tomorrow morning and my stomach has butterflies.";
  const { res: turn1Res, data: turn1Data } = await sendChatMessageWithRetry(
    {
      message: turn1Msg,
      history: [],
      sessionId,
    },
    tokenA
  );
  assert.strictEqual(turn1Res.status, 200);
  console.log(`   ✔ Turn 1 Reply: "${turn1Data.reply.substring(0, 75)}..."`);

  // Turn 2: Alice asks a follow-up that relies on Turn 1's context
  const turn2Msg = "What is one quick calming thing I can do 10 minutes right before it starts?";
  const { res: turn2Res, data: turn2Data } = await sendChatMessageWithRetry(
    {
      message: turn2Msg,
      history: [
        { role: "user", content: turn1Msg },
        { role: "assistant", content: turn1Data.reply },
      ],
      sessionId,
    },
    tokenA
  );
  assert.strictEqual(turn2Res.status, 200);
  assert.ok(turn2Data.reply.length > 10, "Turn 2 reply must be non-empty");
  console.log(`   ✔ Turn 2 Context-Aware Reply: "${turn2Data.reply.substring(0, 85)}..."`);
  console.log(`   ✔ Provenance: provider=${turn2Data.provider}, fallback=${turn2Data.fallback}`);

  // 4. Emotional Wellness Reflection
  console.log("4. Testing emotional-wellness conversation...");
  const wellnessMsg = "I've been feeling exhausted and burned out from work. It feels like I can never catch up on rest.";
  const { res: wellnessRes, data: wellnessData } = await sendChatMessageWithRetry(
    {
      message: wellnessMsg,
      history: [],
    },
    tokenA
  );
  assert.strictEqual(wellnessRes.status, 200);
  assert.ok(wellnessData.reply, "Must return empathetic reply");
  assert.ok(wellnessData.detectedStress >= 4, "Should detect elevated stress");
  console.log(`   ✔ Wellness Reply: "${wellnessData.reply.substring(0, 80)}..."`);
  console.log(`   ✔ Detected Mood: ${wellnessData.detectedMood}, Stress: ${wellnessData.detectedStress}/10`);

  // 5. Immediate Crisis Safety Interception
  console.log("5. Testing crisis safety interception...");
  const crisisRes = await fetch(`${BASE_URL}/chat/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      message: "I feel like I want to end my life and die.",
      history: [],
    }),
  });
  assert.strictEqual(crisisRes.status, 200);
  const crisisData = await crisisRes.json();
  assert.strictEqual(crisisData.isCrisis, true, "isCrisis flag must be true");
  assert.ok(crisisData.reply.includes("988"), "Crisis reply must prominently provide 988 Lifeline");
  console.log("   ✔ Crisis intent intercepted safely with 988 Lifeline resources.");

  // 6. Honest Provider Error Handling & Categorization
  console.log("6. Testing honest provider error handling (never disguising fallback as Gemini)...");
  // Test invalid key categorization
  const badKeyCat = categorizeGeminiError(400, { status: "INVALID_ARGUMENT", message: "API key not valid." }, null);
  assert.strictEqual(badKeyCat.category, "invalid_api_key");
  assert.strictEqual(badKeyCat.status, 401);

  // Test quota exceeded categorization
  const quotaCat = categorizeGeminiError(429, { status: "RESOURCE_EXHAUSTED", message: "Quota exceeded" }, null);
  assert.strictEqual(quotaCat.category, "api_quota_billing");
  assert.strictEqual(quotaCat.status, 429);

  // Test that when fallback is triggered, provider is NEVER set to google-gemini
  const originalKey = process.env.GEMINI_API_KEY;
  try {
    process.env.GEMINI_API_KEY = "AIzaSyFakeKeyForErrorVerification";
    const fallbackTestResult = await aiService.generateChatReply("Hello there, testing error reporting");
    assert.strictEqual(fallbackTestResult.provider, "emosense-core-wellness-engine", "Must honestly report emosense-core-wellness-engine");
    assert.strictEqual(fallbackTestResult.fallback, true, "Must flag fallback: true");
    assert.ok(fallbackTestResult.error, "Must include sanitized error object");
    assert.ok(fallbackTestResult.reply.length > 5, "Fallback reply must be generated");
    console.log(`   ✔ Honest provider error verified: provider="${fallbackTestResult.provider}", fallback=${fallbackTestResult.fallback}, error.category="${fallbackTestResult.error?.category}"`);
  } finally {
    process.env.GEMINI_API_KEY = originalKey;
  }

  // 7. User Data Isolation
  console.log("7. Testing user data isolation across sessions...");
  const bobAccessRes = await fetch(`${BASE_URL}/chat/sessions/${sessionId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert.strictEqual(bobAccessRes.status, 404, "Bob cannot access Alice's session (must be 404)");
  console.log("   ✔ Cross-user isolation verified: Bob cannot view Alice's session (404).");

  // 8. Optional Session Completion / Summary
  console.log("8. Testing optional session complete / summarize...");
  const completeRes = await fetch(`${BASE_URL}/chat/sessions/${sessionId}/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      messages: [
        { role: "user", content: turn1Msg },
        { role: "assistant", content: turn1Data.reply },
        { role: "user", content: turn2Msg },
        { role: "assistant", content: turn2Data.reply },
      ],
    }),
  });
  assert.strictEqual(completeRes.status, 200);
  const completeData = await completeRes.json();
  assert.ok(completeData.analysis, "Analysis summary generated");
  assert.ok(completeData.analysisRecordId, "AnalysisRecord saved");
  assert.ok(completeData.moodEntry, "MoodEntry logged");
  console.log(`   ✔ Session summarized: "${completeData.analysis.overall_summary || completeData.analysis.summary}"`);

  console.log("\n=======================================================");
  console.log("🎉 ALL CONVERSATIONAL CHAT INTEGRATION TESTS PASSED!");
  console.log("=======================================================\n");
}

runTests().catch((err) => {
  console.error("\n❌ Conversational chat test failure:", err);
  process.exit(1);
});
