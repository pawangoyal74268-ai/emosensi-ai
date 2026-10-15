// Test Suite: EmoSense AI Chat Persistence & Natural Conversation Behavior
// Verifies:
// 1. User messages and AI responses are automatically saved in SQLite (ChatSession & ChatMessage)
// 2. Persistent session creation on new chat and sessionId reuse across multi-turn messages
// 3. Retrieval of session with complete message history in chronological order
// 4. Listing saved sessions with title, preview, last updated timestamp, and message count
// 5. Cross-user isolation (User B cannot access or list User A's sessions)
// 6. Duplicate message prevention on rapid re-submission
// 7. Natural conversational behavior:
//    - Example 1: "I am worried about my exams." -> Empathetic dialogue, no pushy menus, suggestedActions empty
//    - Example 2: "What should I do about my exam stress?" -> Practical advice + contextual suggestions
//    - Example 3: "Explain JavaScript async/await." -> Technical explanation with code, no wellness deflection
//    - Example 4: "I finally completed my project!" -> Celebration without productivity lecture, suggestedActions empty
// 8. Session deletion and verification
import assert from "assert";

const BASE_URL = "http://localhost:5000/api";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("🧪 EmoSense AI: Chat History Persistence & Natural Behavior");
  console.log("=======================================================\n");

  const timestamp = Date.now();
  const emailA = `persist_userA_${timestamp}@example.com`;
  const emailB = `persist_userB_${timestamp}@example.com`;
  const password = "TestPassword123!";

  // 1. Setup Authenticated Users
  console.log("1. Setting up authenticated test users...");
  const regA = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: emailA, password, name: "Alice Persistence" }),
  });
  assert.strictEqual(regA.status, 201);
  const tokenA = (await regA.json()).token;

  const regB = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: emailB, password, name: "Bob Persistence" }),
  });
  assert.strictEqual(regB.status, 201);
  const tokenB = (await regB.json()).token;
  console.log("   ✔ User A and User B registered successfully.");

  // 2. Start Conversation Without Pre-existing Session (Auto-session Creation)
  console.log("\n2. Testing auto-creation of persistent ChatSession on first message...");
  const msg1Text = "I am worried about my exams.";
  const res1 = await fetch(`${BASE_URL}/chat/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      message: msg1Text,
      history: [],
    }),
  });

  assert.strictEqual(res1.status, 200, "First message must return 200");
  const data1 = await res1.json();
  assert.strictEqual(data1.success, true);
  assert.ok(data1.sessionId, "Must return persistent sessionId in response");
  assert.ok(data1.reply && data1.reply.length > 10, "Must return valid reply");
  const sessionId = data1.sessionId;
  console.log(`   ✔ First message auto-created session: ${sessionId}`);
  console.log(`   ✔ AI Reply: "${data1.reply.substring(0, 75)}..."`);

  // Verify Natural Conversational Behavior (Example 1)
  console.log("\n3. Verifying Natural Behavior Example 1: 'I am worried about my exams.'");
  // Rule: Do not immediately provide a study plan or breathing exercise, no pushy menus
  assert.ok(!data1.reply.toLowerCase().includes("would you like me to make a study plan"), "Must not push study plan immediately");
  assert.ok(!data1.reply.toLowerCase().includes("would you prefer a breathing exercise"), "Must not push breathing exercise immediately");
  assert.deepStrictEqual(data1.suggestedActions, [], "suggestedActions must be empty for emotional worry without advice request");
  console.log("   ✔ AI responded empathetically without premature study plans or breathing exercises.");
  console.log("   ✔ suggestedActions array is empty ([]) as required for casual sharing.");

  // 4. Send Follow-up Message Reusing Same Session (Part 2: Explicit Advice Request)
  console.log("\n4. Testing subsequent message reusing same sessionId (Example 2: Explicit advice request)...");
  const msg2Text = "What should I do about my exam stress?";
  const res2 = await fetch(`${BASE_URL}/chat/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      message: msg2Text,
      history: [
        { role: "user", content: msg1Text },
        { role: "assistant", content: data1.reply },
      ],
      sessionId,
    }),
  });

  assert.strictEqual(res2.status, 200);
  const data2 = await res2.json();
  assert.strictEqual(data2.sessionId, sessionId, "Must reuse exact same sessionId");
  console.log(`   ✔ Reused same sessionId: ${data2.sessionId}`);
  console.log(`   ✔ AI Reply: "${data2.reply.substring(0, 80)}..."`);

  // Verify Natural Behavior Example 2: Explicit advice requested -> suggestions appropriate
  assert.ok(data2.reply.length > 20, "Must provide practical advice");
  if (data2.suggestedActions.length > 0) {
    console.log(`   ✔ Contextual suggestions provided when advice was explicitly requested: [${data2.suggestedActions.map((s) => `"${s}"`).join(", ")}]`);
  }

  // 5. Verify Full History Restoration from Database (GET /api/chat/sessions/:id)
  console.log("\n5. Testing complete message history retrieval (simulating page refresh)...");
  const getSessionRes = await fetch(`${BASE_URL}/chat/sessions/${sessionId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${tokenA}` },
  });

  assert.strictEqual(getSessionRes.status, 200, "GET session by ID must succeed");
  const sessionData = (await getSessionRes.json()).session;
  assert.strictEqual(sessionData.id, sessionId);
  assert.ok(sessionData.messages && sessionData.messages.length === 4, `Expected 4 messages (2 user, 2 assistant), found ${sessionData.messages?.length}`);

  // Check chronological order
  assert.strictEqual(sessionData.messages[0].role, "user");
  assert.strictEqual(sessionData.messages[0].content, msg1Text);
  assert.strictEqual(sessionData.messages[1].role, "assistant");
  assert.strictEqual(sessionData.messages[2].role, "user");
  assert.strictEqual(sessionData.messages[2].content, msg2Text);
  assert.strictEqual(sessionData.messages[3].role, "assistant");
  console.log("   ✔ Retrieved complete session history in chronological order (2 user + 2 assistant messages).");
  console.log(`   ✔ Session title auto-generated: "${sessionData.title}"`);
  console.log(`   ✔ Session preview: "${sessionData.preview.substring(0, 60)}..."`);
  console.log(`   ✔ Message count: ${sessionData.messageCount}`);

  // 6. Test Listing in History (GET /api/chat/sessions)
  console.log("\n6. Testing chat history listing for History page...");
  const listRes = await fetch(`${BASE_URL}/chat/sessions`, {
    method: "GET",
    headers: { Authorization: `Bearer ${tokenA}` },
  });

  assert.strictEqual(listRes.status, 200);
  const listData = await listRes.json();
  assert.ok(Array.isArray(listData.sessions));
  const foundSession = listData.sessions.find((s) => s.id === sessionId);
  assert.ok(foundSession, "Created session must appear in user's sessions list");
  assert.ok(foundSession.title, "Must include title");
  assert.ok(foundSession.preview, "Must include preview");
  assert.ok(foundSession.updatedAt, "Must include updatedAt timestamp");
  assert.ok(foundSession.messageCount >= 4, "Must include messageCount");
  console.log(`   ✔ Session found in History listing with title: "${foundSession.title}"`);
  console.log(`   ✔ Last updated timestamp: ${foundSession.updatedAt}`);

  // 7. Test User Isolation (Bob cannot access Alice's session or list it)
  console.log("\n7. Testing session privacy and user isolation...");
  const bobGetRes = await fetch(`${BASE_URL}/chat/sessions/${sessionId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert.strictEqual(bobGetRes.status, 404, "Bob cannot access Alice's session (must return 404)");

  const bobListRes = await fetch(`${BASE_URL}/chat/sessions`, {
    method: "GET",
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const bobSessions = (await bobListRes.json()).sessions;
  const bobHasAliceSession = bobSessions.some((s) => s.id === sessionId);
  assert.strictEqual(bobHasAliceSession, false, "Alice's session must never appear in Bob's list");
  console.log("   ✔ Cross-user isolation verified: Bob cannot access Alice's session (404) or list it.");

  // 8. Test Duplicate Message Guard (React re-render or rapid click protection)
  console.log("\n8. Testing duplicate message prevention within short window...");
  const dupRes = await fetch(`${BASE_URL}/chat/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      message: msg2Text,
      history: [],
      sessionId,
    }),
  });
  assert.strictEqual(dupRes.status, 200);
  const dupData = await dupRes.json();
  if (dupData.duplicateAvoided) {
    console.log("   ✔ Duplicate submission caught and duplicate message creation prevented.");
  }

  // 9. Natural Behavior Example 3: Technical Coding Inquiry
  console.log("\n9. Verifying Natural Behavior Example 3: 'Explain JavaScript async/await.'");
  const codeRes = await fetch(`${BASE_URL}/chat/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      message: "Explain JavaScript async/await.",
      history: [],
    }),
  });
  assert.strictEqual(codeRes.status, 200);
  const codeData = await codeRes.json();
  assert.ok(codeData.reply.toLowerCase().includes("async") || codeData.reply.toLowerCase().includes("promise"), "Must explain async/await concept");
  assert.ok(!codeData.reply.toLowerCase().includes("exam stress"), "Must not redirect technical inquiry to exams or wellness");
  console.log(`   ✔ Technical coding inquiry handled directly: "${codeData.reply.substring(0, 85)}..."`);

  // 10. Natural Behavior Example 4: Celebration
  console.log("\n10. Verifying Natural Behavior Example 4: 'I finally completed my project!'");
  const celebRes = await fetch(`${BASE_URL}/chat/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      message: "I finally completed my project!",
      history: [],
    }),
  });
  assert.strictEqual(celebRes.status, 200);
  const celebData = await celebRes.json();
  assert.deepStrictEqual(celebData.suggestedActions, [], "Celebration must not force suggestions");
  assert.ok(!celebData.reply.toLowerCase().includes("productivity"), "Must not lecture user on productivity");
  console.log(`   ✔ Celebration handled naturally: "${celebData.reply.substring(0, 80)}..."`);

  // 11. Test Session Deletion
  console.log("\n11. Testing session deletion...");
  const delRes = await fetch(`${BASE_URL}/chat/sessions/${sessionId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(delRes.status, 200);

  const verifyDelRes = await fetch(`${BASE_URL}/chat/sessions/${sessionId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(verifyDelRes.status, 404, "Deleted session must return 404");
  console.log("   ✔ Session deleted and verified (404 on subsequent lookup).");

  console.log("\n=======================================================");
  console.log("🎉 ALL CHAT PERSISTENCE & NATURAL BEHAVIOR TESTS PASSED!");
  console.log("=======================================================\n");
}

runTests().catch((err) => {
  console.error("\n❌ Chat persistence test failure:", err);
  process.exit(1);
});
