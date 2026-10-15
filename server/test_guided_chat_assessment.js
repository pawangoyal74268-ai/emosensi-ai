// Integration Test Suite for Guided Emotional Wellness Assessment in EmoSense AI
// Tests full multi-turn assessment flow, live Gemini model integration,
// adaptive questions, skip, early finish, crisis safety, cross-user isolation,
// and duplicate submission protection.
import assert from "assert";

const BASE_URL = "http://localhost:5000/api";

async function runTests() {
  console.log("\n=======================================================");
  console.log("🧪 EmoSense AI Guided Assessment Integration Tests");
  console.log("=======================================================\n");

  const timestamp = Date.now();
  const testEmail1 = `assess_user1_${timestamp}@example.com`;
  const testEmail2 = `assess_user2_${timestamp}@example.com`;
  const password = "TestPassword123!";

  // 1. Register User 1
  console.log("1. Registering test user 1...");
  const regRes1 = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail1, password, name: "Assessment Tester 1" }),
  });
  assert.strictEqual(regRes1.status, 201, "User 1 registration should return 201");
  const user1Data = await regRes1.json();
  const token1 = user1Data.token;
  assert.ok(token1, "Token 1 must be present");

  // Register User 2 for cross-user isolation tests
  console.log("2. Registering test user 2 (for data isolation verification)...");
  const regRes2 = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail2, password, name: "Assessment Tester 2" }),
  });
  assert.strictEqual(regRes2.status, 201, "User 2 registration should return 201");
  const user2Data = await regRes2.json();
  const token2 = user2Data.token;
  assert.ok(token2, "Token 2 must be present");

  // 3. Test Unauthorized Access
  console.log("3. Testing unauthorized request protection (401)...");
  const unauthRes = await fetch(`${BASE_URL}/chat/assessment/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  assert.strictEqual(unauthRes.status, 401, "Assessment start without auth should return 401");
  console.log("   ✔ Unauthorized request rejected with 401");

  // 4. Start Guided Assessment
  console.log("4. Starting guided emotional assessment session...");
  const startRes = await fetch(`${BASE_URL}/chat/assessment/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token1}`,
    },
    body: JSON.stringify({ title: "My Reflection Check-in" }),
  });
  assert.strictEqual(startRes.status, 201, "Assessment start should return 201");
  const startData = await startRes.json();
  assert.strictEqual(startData.success, true, "Start must succeed");
  assert.ok(startData.sessionId, "Session ID must be created");
  assert.strictEqual(startData.step, 1, "Initial step must be 1");
  assert.strictEqual(startData.totalSteps, 5, "Total steps must be 5");
  assert.strictEqual(startData.topic, "recent_mood", "Topic 1 must be recent_mood");
  assert.ok(startData.question.length > 10, "Question 1 must be present");
  const sessionId = startData.sessionId;
  console.log(`   ✔ Started assessment session: ${sessionId}`);
  console.log(`   ✔ Question 1: "${startData.question.substring(0, 70)}..."`);

  // 5. Test Step 1: User provides answer on recent mood
  console.log("5. Submitting answer for Step 1 (Recent Mood)...");
  const step1Res = await fetch(`${BASE_URL}/chat/assessment/step`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token1}`,
    },
    body: JSON.stringify({
      sessionId,
      step: 1,
      answer: "I have been feeling quite drained and anxious about my college thesis deadlines.",
    }),
  });
  assert.strictEqual(step1Res.status, 200, "Step 1 should return 200");
  const step1Data = await step1Res.json();
  assert.strictEqual(step1Data.success, true);
  assert.strictEqual(step1Data.step, 2, "Should advance to step 2");
  assert.ok(step1Data.question, "Adaptive follow-up question 2 must be returned");
  assert.ok(step1Data.acknowledgment, "Empathetic acknowledgment must be returned");
  console.log(`   ✔ Acknowledgment: "${step1Data.acknowledgment}"`);
  console.log(`   ✔ Adaptive Question 2: "${step1Data.question}"`);
  console.log(`   ✔ Provider: ${step1Data.provider}`);

  // 6. Test Cross-User Isolation: User 2 attempts to advance User 1's session
  console.log("6. Testing cross-user isolation: User 2 attempts to access User 1's session...");
  const crossUserStepRes = await fetch(`${BASE_URL}/chat/assessment/step`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token2}`,
    },
    body: JSON.stringify({
      sessionId,
      step: 2,
      answer: "Malicious attempt to intervene in another user's session",
    }),
  });
  assert.strictEqual(crossUserStepRes.status, 404, "Cross-user session step must return 404 NOT_FOUND");
  console.log("   ✔ Cross-user isolation verified (User 2 blocked with 404)");

  // 7. Test Step 2: Skip Question functionality
  console.log("7. Testing Question Skip at Step 2...");
  const step2SkipRes = await fetch(`${BASE_URL}/chat/assessment/step`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token1}`,
    },
    body: JSON.stringify({
      sessionId,
      step: 2,
      skipped: true,
    }),
  });
  assert.strictEqual(step2SkipRes.status, 200, "Skip should return 200");
  const step2Data = await step2SkipRes.json();
  assert.strictEqual(step2Data.success, true);
  assert.strictEqual(step2Data.step, 3, "Skipping should advance to step 3");
  assert.ok(step2Data.question, "Question 3 must be returned");
  console.log(`   ✔ Question skipped gracefully. Advanced to Step 3: "${step2Data.question.substring(0, 60)}..."`);

  // 8. Test Step 3: Sleep & Energy
  console.log("8. Submitting answer for Step 3 (Sleep & Energy)...");
  const step3Res = await fetch(`${BASE_URL}/chat/assessment/step`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token1}`,
    },
    body: JSON.stringify({
      sessionId,
      step: 3,
      answer: "My sleep has been choppy—around 5 hours per night, but going for evening walks helps me unwind.",
    }),
  });
  assert.strictEqual(step3Res.status, 200, "Step 3 should return 200");
  const step3Data = await step3Res.json();
  assert.strictEqual(step3Data.step, 4, "Advanced to step 4");
  console.log(`   ✔ Step 3 processed. Advanced to Step 4: "${step3Data.question.substring(0, 60)}..."`);

  // 9. Test Early Finish & Full-Transcript Multi-turn Analysis
  console.log("9. Testing 'Finish & Analyze Early' multi-turn synthesis...");
  const analyzeRes = await fetch(`${BASE_URL}/chat/assessment/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token1}`,
    },
    body: JSON.stringify({ sessionId }),
  });
  assert.strictEqual(analyzeRes.status, 200, "Analysis should return 200");
  const analyzeData = await analyzeRes.json();
  assert.strictEqual(analyzeData.success, true, "Analysis must be successful");
  assert.ok(analyzeData.analysis, "Analysis report must be present");

  const report = analyzeData.analysis;
  console.log("\n   📊 Validating Structured Report Fields:");
  assert.ok(typeof report.overall_summary === "string" && report.overall_summary.length > 10, "Field: overall_summary");
  console.log(`   ✔ overall_summary: "${report.overall_summary.substring(0, 70)}..."`);

  assert.ok(report.reported_mood, "Field: reported_mood");
  console.log(`   ✔ reported_mood: "${report.reported_mood}"`);

  assert.ok(report.stress_level && typeof report.stress_level === "object", "Field: stress_level object");
  assert.ok(typeof report.stress_level.score === "number", "Field: stress_level.score");
  assert.ok(typeof report.stress_level.explanation === "string", "Field: stress_level.explanation");
  console.log(`   ✔ stress_level: rating=${report.stress_level.rating}, score=${report.stress_level.score}/10`);

  assert.ok(Array.isArray(report.key_stressors), "Field: key_stressors array");
  console.log(`   ✔ key_stressors: [${report.key_stressors.join(", ")}]`);

  assert.ok(typeof report.sleep_and_energy === "string", "Field: sleep_and_energy");
  console.log(`   ✔ sleep_and_energy: "${report.sleep_and_energy.substring(0, 60)}..."`);

  assert.ok(Array.isArray(report.coping_strengths), "Field: coping_strengths array");
  console.log(`   ✔ coping_strengths: [${report.coping_strengths.join(", ")}]`);

  assert.ok(typeof report.patterns_and_uncertainties === "string", "Field: patterns_and_uncertainties");
  console.log(`   ✔ patterns_and_uncertainties: "${report.patterns_and_uncertainties.substring(0, 60)}..."`);

  assert.ok(Array.isArray(report.personalized_next_steps) && report.personalized_next_steps.length >= 2, "Field: personalized_next_steps");
  console.log(`   ✔ personalized_next_steps: (${report.personalized_next_steps.length} recommendations)`);

  assert.ok(typeof report.follow_up_question === "string", "Field: follow_up_question");
  console.log(`   ✔ follow_up_question: "${report.follow_up_question}"`);

  assert.ok(typeof report.clinical_disclaimer === "string", "Field: clinical_disclaimer");
  console.log(`   ✔ clinical_disclaimer: present`);

  assert.ok(analyzeData.analysisRecordId, "AnalysisRecord must be saved to database");
  assert.ok(analyzeData.moodEntry, "MoodEntry must be saved to database");
  console.log(`   ✔ Saved AnalysisRecord ID: ${analyzeData.analysisRecordId}`);
  console.log(`   ✔ Saved MoodEntry ID: ${analyzeData.moodEntry.id}`);

  // 10. Test Duplicate Submission Protection
  console.log("\n10. Testing duplicate submission protection...");
  const dupRes = await fetch(`${BASE_URL}/chat/assessment/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token1}`,
    },
    body: JSON.stringify({ sessionId }),
  });
  assert.strictEqual(dupRes.status, 200, "Duplicate submission should return 200");
  const dupData = await dupRes.json();
  assert.strictEqual(dupData.duplicateAvoided, true, "Should indicate duplicate analysis was avoided");
  assert.strictEqual(dupData.analysisRecordId, analyzeData.analysisRecordId, "Must return existing AnalysisRecord ID without creating duplicate");
  console.log("   ✔ Duplicate analysis prevented. Cached AnalysisRecord returned successfully.");

  // 11. Test Crisis Safety Detection
  console.log("\n11. Testing Crisis Safety Detection...");
  const crisisStartRes = await fetch(`${BASE_URL}/chat/assessment/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token1}`,
    },
    body: JSON.stringify({ title: "Crisis Safety Test" }),
  });
  const crisisSessionId = (await crisisStartRes.json()).sessionId;

  const crisisStepRes = await fetch(`${BASE_URL}/chat/assessment/step`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token1}`,
    },
    body: JSON.stringify({
      sessionId: crisisSessionId,
      step: 1,
      answer: "I feel like I want to die and end my life right now.",
    }),
  });
  assert.strictEqual(crisisStepRes.status, 200, "Crisis step must return 200");
  const crisisData = await crisisStepRes.json();
  assert.strictEqual(crisisData.isCrisis, true, "isCrisis flag must be true");
  assert.ok(crisisData.crisisResources, "crisisResources must be returned");
  assert.ok(crisisData.crisisResources.nationalLifeline.includes("988"), "988 Lifeline must be included in crisis resources");
  console.log("   ✔ Crisis intent detected accurately.");
  console.log(`   ✔ Lifeline provided: ${crisisData.crisisResources.nationalLifeline}`);

  console.log("\n=======================================================");
  console.log("🎉 ALL GUIDED ASSESSMENT INTEGRATION TESTS PASSED!");
  console.log("=======================================================\n");
}

runTests().catch((err) => {
  console.error("\n❌ Assessment integration test failure:", err);
  process.exit(1);
});
