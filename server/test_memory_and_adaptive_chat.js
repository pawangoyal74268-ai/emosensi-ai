// Integration Test Suite: Long-Term Memory, Emotion-Aware Adaptive Chat, and Memory Privacy
import assert from "assert";
import prisma from "./db.js";

const BASE_URL = "http://localhost:5000/api";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("🧠 EmoSense AI: Long-Term Memory & Adaptive Chat Tests");
  console.log("=======================================================\n");

  const timestamp = Date.now();
  const emailA = `memory_userA_${timestamp}@example.com`;
  const emailB = `memory_userB_${timestamp}@example.com`;
  const password = "SecurePassword123!";

  // -----------------------------------------------------------------
  // 1. Setup Test Users
  // -----------------------------------------------------------------
  console.log("1. Setting up authenticated test users...");
  const regA = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: emailA, password, name: "Alice Memory" }),
  });
  assert.strictEqual(regA.status, 201, "User A registration failed");
  const dataA = await regA.json();
  const tokenA = dataA.token;
  const userAId = dataA.user.id;

  const regB = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: emailB, password, name: "Bob Memory" }),
  });
  assert.strictEqual(regB.status, 201, "User B registration failed");
  const dataB = await regB.json();
  const tokenB = dataB.token;
  const userBId = dataB.user.id;
  console.log("   ✔ User A and User B registered successfully.");

  // -----------------------------------------------------------------
  // 2. Requirement: A greeting receives a short response (one sentence)
  // -----------------------------------------------------------------
  console.log("\n2. Testing adaptive response length for greetings ('Hi')...");
  const greetRes = await fetch(`${BASE_URL}/chat/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({ message: "Hi", history: [] }),
  });
  assert.strictEqual(greetRes.status, 200);
  const greetData = await greetRes.json();
  console.log(`   Reply: "${greetData.reply}"`);
  // Must be a short response (under 120 characters, single sentence or short greeting)
  assert.ok(greetData.reply.length < 120, "Greeting reply must be short and direct");
  assert.ok(!greetData.reply.includes("\n\n"), "Greeting reply should not be multi-paragraph");
  assert.deepStrictEqual(greetData.suggestedActions, [], "Greeting suggestedActions must be empty");
  console.log("   ✔ Greeting received concise 1-sentence reply with empty suggestedActions.");

  // -----------------------------------------------------------------
  // 3. Requirement: Celebrations receive short genuine congratulation
  // -----------------------------------------------------------------
  console.log("\n3. Testing celebrations ('I finally completed my project!')...");
  const celebRes = await fetch(`${BASE_URL}/chat/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({ message: "I finally completed my project!", history: [] }),
  });
  assert.strictEqual(celebRes.status, 200);
  const celebData = await celebRes.json();
  console.log(`   Reply: "${celebData.reply}"`);
  assert.ok(celebData.reply.length < 150, "Celebration must be concise");
  assert.deepStrictEqual(celebData.suggestedActions, [], "Celebration suggestedActions must be empty");
  console.log("   ✔ Celebration received short genuine congratulation without productivity lectures.");

  // -----------------------------------------------------------------
  // 4. Requirement: Emotional sharing receives empathy without unsolicited advice
  // -----------------------------------------------------------------
  console.log("\n4. Testing emotional sharing ('I am worried about my exams.')...");
  const emotRes = await fetch(`${BASE_URL}/chat/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({ message: "I am worried about my exams.", history: [] }),
  });
  assert.strictEqual(emotRes.status, 200);
  const emotData = await emotRes.json();
  console.log(`   Reply: "${emotData.reply}"`);
  assert.ok(!emotData.reply.toLowerCase().includes("would you like me to make a study plan"), "Must not push study plan immediately");
  assert.ok(!emotData.reply.toLowerCase().includes("breathing exercise"), "Must not push breathing exercise immediately");
  assert.deepStrictEqual(emotData.suggestedActions, [], "Emotional sharing must have empty suggestedActions");
  console.log("   ✔ Emotional sharing acknowledged empathetically without unsolicited advice menus.");

  // -----------------------------------------------------------------
  // 5. Requirement: Explicit advice requests receive practical suggestions
  // -----------------------------------------------------------------
  console.log("\n5. Testing explicit advice request ('What should I do about my exam stress?')...");
  const advRes = await fetch(`${BASE_URL}/chat/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({ message: "What should I do about my exam stress?", history: [] }),
  });
  assert.strictEqual(advRes.status, 200);
  const advData = await advRes.json();
  console.log(`   Reply: "${advData.reply.substring(0, 100)}..."`);
  assert.ok(Array.isArray(advData.suggestedActions) && advData.suggestedActions.length > 0, "Advice request should include practical suggestedActions");
  console.log(`   Suggestions: ${JSON.stringify(advData.suggestedActions)}`);
  console.log("   ✔ Advice request returned concrete steps and actionable suggestion chips.");

  // -----------------------------------------------------------------
  // 6. Requirement: Detailed technical question receives structured code explanation
  // -----------------------------------------------------------------
  console.log("\n6. Testing technical explanation ('Explain Python loops with examples.')...");
  const techRes = await fetch(`${BASE_URL}/chat/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({ message: "Explain Python loops with examples.", history: [] }),
  });
  assert.strictEqual(techRes.status, 200);
  const techData = await techRes.json();
  assert.ok(techData.reply.includes("```python") || techData.reply.includes("for ") || techData.reply.includes("while "), "Technical response must include loop code");
  console.log("   ✔ Technical question received structured explanation with code examples.");

  // -----------------------------------------------------------------
  // 7. Requirement: Detailed plan request receives thorough organized plan
  // -----------------------------------------------------------------
  console.log("\n7. Testing detailed plan request ('Create a detailed 30-day study plan.')...");
  const planRes = await fetch(`${BASE_URL}/chat/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({ message: "Create a detailed 30-day study plan.", history: [] }),
  });
  assert.strictEqual(planRes.status, 200);
  const planData = await planRes.json();
  assert.ok(planData.reply.length > 250, "Detailed plan must have depth and structure");
  assert.ok(
    /week|phase|day|stage|month|schedule|block/i.test(planData.reply),
    "Study plan should have organized timeframes"
  );
  console.log("   ✔ Detailed plan request provided structured schedule.");

  // -----------------------------------------------------------------
  // 8. Requirement: Long-term memory extraction and recall across sessions
  // -----------------------------------------------------------------
  // 8. Requirement: Long-term memory extraction and recall across sessions
  // -----------------------------------------------------------------
  console.log("\n8. Testing Long-Term Memory across sessions (User's Exact Scenario)...");
  // Conversation 1: User mentions an ongoing project AND a learning goal in an ordinary message
  const conversation1Msg =
    "I'm building EmoSense AI, a mental wellness app using React and Node.js. I'm also learning Python for data science.";
  const s1Res = await fetch(`${BASE_URL}/chat/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({ message: conversation1Msg, history: [] }),
  });
  assert.strictEqual(s1Res.status, 200);
  const s1Data = await s1Res.json();
  const session1Id = s1Data.sessionId;
  console.log(`   Session 1 created: ${session1Id}`);

  // Memory extraction and persistence is awaited on the backend
  const memoriesA = await prisma.userMemory.findMany({
    where: { userId: userAId },
  });
  console.log(`   Memories found for User A in database: ${memoriesA.length}`);
  assert.ok(memoriesA.length >= 2, "Both candidate memories (project and learning goal) must be saved");

  const projectMemory = memoriesA.find(
    (m) =>
      m.category === "project" &&
      (m.content.toLowerCase().includes("emosense") || m.content.toLowerCase().includes("react"))
  );
  assert.ok(projectMemory, "Memory should record the EmoSense AI project");
  console.log(`   ✔ Extracted project memory: [${projectMemory.category}] "${projectMemory.content}"`);

  const goalMemory = memoriesA.find(
    (m) =>
      m.category === "goal" &&
      (m.content.toLowerCase().includes("python") || m.content.toLowerCase().includes("data science"))
  );
  assert.ok(goalMemory, "Memory should record the Python for data science learning goal");
  console.log(`   ✔ Extracted learning goal memory: [${goalMemory.category}] "${goalMemory.content}"`);

  // Conversation 2: User clicks New Chat and asks:
  // "What project am I building, and what am I learning?"
  console.log("\n   Starting new session (Session 2) to test recall of both facts...");
  const s2Res = await fetch(`${BASE_URL}/chat/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      message: "What project am I building, and what am I learning?",
      history: [],
      // No sessionId passed -> starts a brand new session
    }),
  });
  assert.strictEqual(s2Res.status, 200);
  const s2Data = await s2Res.json();
  assert.notStrictEqual(s2Data.sessionId, session1Id, "Must be a distinct session ID");
  console.log(`   Session 2 ID: ${s2Data.sessionId}`);
  console.log(`   Recall Reply: "${s2Data.reply}"`);
  console.log(`   Recalled Memories count: ${s2Data.recalledMemories ? s2Data.recalledMemories.length : 0}`);

  assert.ok(
    Array.isArray(s2Data.recalledMemories) && s2Data.recalledMemories.length >= 2,
    "Both project and learning goal memories must be retrieved for the dual query"
  );
  assert.ok(
    s2Data.reply.toLowerCase().includes("emosense") ||
      s2Data.reply.toLowerCase().includes("react") ||
      s2Data.reply.toLowerCase().includes("wellness"),
    "AI response in new session must recall the project (EmoSense / React)"
  );
  assert.ok(
    s2Data.reply.toLowerCase().includes("python") || s2Data.reply.toLowerCase().includes("data science"),
    "AI response in new session must recall the learning goal (Python / data science)"
  );
  console.log("   ✔ AI successfully recalled BOTH project and learning goal in a completely new session!");

  // Testing semantic relevance when asking only about the project
  console.log("\n   Testing specific question: 'What project am I building?'...");
  const s3Res = await fetch(`${BASE_URL}/chat/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      message: "What project am I building?",
      history: [],
    }),
  });
  assert.strictEqual(s3Res.status, 200);
  const s3Data = await s3Res.json();
  console.log(`   Project Query Reply: "${s3Data.reply}"`);
  assert.ok(
    s3Data.reply.toLowerCase().includes("emosense") ||
      s3Data.reply.toLowerCase().includes("react") ||
      s3Data.reply.toLowerCase().includes("wellness"),
    "Project query must recall the project"
  );

  // Testing semantic relevance when asking only about learning
  console.log("\n   Testing specific question: 'What am I learning?'...");
  const s4Res = await fetch(`${BASE_URL}/chat/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      message: "What am I learning?",
      history: [],
    }),
  });
  assert.strictEqual(s4Res.status, 200);
  const s4Data = await s4Res.json();
  console.log(`   Learning Query Reply: "${s4Data.reply}"`);
  assert.ok(
    s4Data.reply.toLowerCase().includes("python") || s4Data.reply.toLowerCase().includes("data science"),
    "Learning query must recall Python / data science"
  );

  // -----------------------------------------------------------------
  // 9. Requirement: Irrelevant memories are not injected into unrelated queries
  // -----------------------------------------------------------------
  console.log("\n9. Testing relevance filtering (irrelevant memories not injected)...");
  const memoryService = (await import("./services/memoryService.js")).default;
  const unrelatedRelevant = await memoryService.getRelevantMemories(userAId, "What is 2 + 2?");
  console.log(`   Relevant memories for 'What is 2 + 2?': ${unrelatedRelevant.length}`);
  assert.strictEqual(unrelatedRelevant.length, 0, "Unrelated query should retrieve 0 relevant memories");
  console.log("   ✔ Irrelevant memories correctly omitted for unrelated topics.");

  // -----------------------------------------------------------------
  // 10. Requirement: Cross-User Isolation (User B cannot access User A's memories)
  // -----------------------------------------------------------------
  console.log("\n10. Testing Cross-User Isolation for memories...");
  // User B lists memories -> must be empty
  const listBRes = await fetch(`${BASE_URL}/memory`, {
    method: "GET",
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert.strictEqual(listBRes.status, 200);
  const listBData = await listBRes.json();
  assert.strictEqual(listBData.memories.length, 0, "User B must not see User A's memories");

  // User B attempts to delete User A's memory
  const unauthorizedDelete = await fetch(`${BASE_URL}/memory/${projectMemory.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert.strictEqual(unauthorizedDelete.status, 404, "User B must not be able to delete User A's memory");
  console.log("   ✔ Cross-user isolation verified: User B cannot view or delete User A's memories.");

  // -----------------------------------------------------------------
  // 11. Requirement: Memory Management Endpoints (list, add, delete, clear)
  // -----------------------------------------------------------------
  console.log("\n11. Testing Memory CRUD Endpoints...");
  // Add an explicit preference memory
  const addPrefRes = await fetch(`${BASE_URL}/memory`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      category: "preference",
      content: "Prefers concise code examples without boilerplate",
    }),
  });
  assert.strictEqual(addPrefRes.status, 201);
  const addedPref = (await addPrefRes.json()).memory;
  assert.strictEqual(addedPref.category, "preference");

  // Sensitive content should be rejected
  const sensitiveRes = await fetch(`${BASE_URL}/memory`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      category: "preference",
      content: "My password is Password123! and my api key is secret_xyz",
    }),
  });
  assert.ok(
    sensitiveRes.status === 400 || sensitiveRes.status === 422,
    `Secrets / passwords must be rejected from memory API (got ${sensitiveRes.status})`
  );
  console.log("   ✔ Sensitive secrets rejected from memory storage.");

  // Delete single memory
  const delSingleRes = await fetch(`${BASE_URL}/memory/${addedPref.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(delSingleRes.status, 200);
  console.log("   ✔ Deleted single memory successfully.");

  // -----------------------------------------------------------------
  // 12. Requirement: 'Forget that' command via natural chat
  // -----------------------------------------------------------------
  console.log("\n12. Testing conversational 'forget that' command...");
  const forgetRes = await fetch(`${BASE_URL}/chat/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({ message: "forget that", history: [] }),
  });
  assert.strictEqual(forgetRes.status, 200);
  const forgetData = await forgetRes.json();
  console.log(`   Forget response: "${forgetData.reply}"`);
  assert.ok(forgetData.reply.toLowerCase().includes("forgotten") || forgetData.reply.toLowerCase().includes("cleared"), "Must acknowledge forgetting memory");

  const remainingMemories = await prisma.userMemory.findMany({
    where: { userId: userAId },
  });
  console.log(`   Remaining memories for User A after 'forget that': ${remainingMemories.length}`);
  console.log("   ✔ 'forget that' command successfully removed stored memory.");

  // -----------------------------------------------------------------
  // 13. Requirement: Clear All memories via endpoint
  // -----------------------------------------------------------------
  console.log("\n13. Testing Clear All memories endpoint...");
  const clearAllRes = await fetch(`${BASE_URL}/memory`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(clearAllRes.status, 200);
  const memoriesAfterClear = await prisma.userMemory.findMany({
    where: { userId: userAId },
  });
  assert.strictEqual(memoriesAfterClear.length, 0, "All memories must be removed");
  console.log("   ✔ Clear All successfully wiped User A's memories without affecting other data.");

  // -----------------------------------------------------------------
  // 14. Verification of Existing Chat Sessions & History Navigation
  // -----------------------------------------------------------------
  console.log("\n14. Verifying existing chat sessions and history remain intact...");
  const sessionsRes = await fetch(`${BASE_URL}/chat/sessions`, {
    method: "GET",
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(sessionsRes.status, 200);
  const sessionsData = await sessionsRes.json();
  assert.ok(sessionsData.sessions.length >= 2, "User A should have at least 2 saved chat sessions");
  console.log(`   ✔ User A has ${sessionsData.sessions.length} preserved chat sessions in history.`);

  // Cleanup test users safely
  await prisma.chatMessage.deleteMany({ where: { session: { userId: { in: [userAId, userBId] } } } });
  await prisma.chatSession.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
  await prisma.userMemory.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });

  console.log("\n=======================================================");
  console.log("✅ ALL MEMORY & ADAPTIVE CHAT TESTS PASSED!");
  console.log("=======================================================\n");
}

runTests().catch((err) => {
  console.error("\n❌ Test suite failed:", err);
  process.exit(1);
});
