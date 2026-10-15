// Comprehensive Stage 6 End-to-End Verification Test
// Tests the full flow through Vite proxy (:5173) to Express backend (:5000) and SQLite database.
// Verifies:
// 1. Health check & provider configuration
// 2. Guest access control on private endpoints
// 3. User registration, login, session cookie, and profile
// 4. Mood check-in creation, history retrieval, and analytics calculation
// 5. Public doctor directory, search/filtering, and authenticated appointment booking
// 6. Chat messaging, session management, and text emotion analysis
// 7. Voice upload, transcript fallback, and error handling
// 8. Face upload, MIME validation, and honest unavailable state handling
// 9. Multi-user data privacy, cross-user access denial, and authorization boundaries
// 10. Logout and session termination
// 11. Database integrity preservation

import prisma from "./db.js";

const BASE_URL = "http://localhost:5173/api";

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

// Cookie jar helper for Node.js fetch
function extractCookie(response) {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return null;
  const match = setCookie.match(/emosense_token=([^;]+)/);
  return match ? match[1] : null;
}

async function runStage6Verification() {
  console.log("\n=======================================================");
  console.log("  EMOSENSE AI — STAGE 6 END-TO-END VERIFICATION SUITE   ");
  console.log("=======================================================");

  const timestamp = Date.now();
  const userAEmail = `stage6_user_a_${timestamp}@emosense.test`;
  const userBEmail = `stage6_user_b_${timestamp}@emosense.test`;
  let userAToken = null;
  let userBToken = null;
  let userAId = null;
  let userBId = null;
  let doctorId = null;
  let appointmentId = null;
  let moodEntryId = null;
  let chatSessionId = null;

  try {
    // ------------------------------------------------------------------
    // SECTION 1: Health Check & System Baseline
    // ------------------------------------------------------------------
    console.log("\n--- 1. Health Check & AI Provider Baseline ---");
    const healthRes = await fetch(`${BASE_URL}/health`);
    assert(healthRes.status === 200, "GET /api/health through Vite proxy returns 200 OK");
    const healthData = await healthRes.json();
    assert(healthData.service === "EmoSense AI Backend", "Service identifies as EmoSense AI Backend");
    assert(healthData.database?.status === "connected", "SQLite database connection is healthy");
    assert(healthData.database?.demoDoctorsLoaded > 0, `Database has seeded doctors (${healthData.database?.demoDoctorsLoaded} loaded)`);
    assert(healthData.ai?.provider !== undefined, `Active AI provider reported: ${healthData.ai?.provider} (${healthData.ai?.mode})`);

    // ------------------------------------------------------------------
    // SECTION 2: Guest Access Control & Security Boundaries
    // ------------------------------------------------------------------
    console.log("\n--- 2. Guest Access Control & Security Boundaries ---");
    const guestMoodsRes = await fetch(`${BASE_URL}/moods`);
    assert(guestMoodsRes.status === 401, "Unauthenticated GET /api/moods returns 401 Unauthorized");

    const guestApptsRes = await fetch(`${BASE_URL}/appointments`);
    assert(guestApptsRes.status === 401, "Unauthenticated GET /api/appointments returns 401 Unauthorized");

    const guestChatRes = await fetch(`${BASE_URL}/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Hello" }),
    });
    assert(guestChatRes.status === 401, "Unauthenticated POST /api/chat/message returns 401 Unauthorized");

    const guestMeRes = await fetch(`${BASE_URL}/auth/me`);
    assert(guestMeRes.status === 401, "Unauthenticated GET /api/auth/me returns 401 Unauthorized");

    // Public doctor directory accessible to guests
    const guestDoctorsRes = await fetch(`${BASE_URL}/doctors`);
    assert(guestDoctorsRes.status === 200, "Unauthenticated GET /api/doctors returns 200 OK (Public Directory)");
    const doctorsData = await guestDoctorsRes.json();
    assert(Array.isArray(doctorsData.doctors) && doctorsData.doctors.length > 0, "Public doctor directory returns doctor list");
    doctorId = doctorsData.doctors[0].id;
    const doctorName = doctorsData.doctors[0].name;

    // Doctor directory search and filtering
    const filteredDocsRes = await fetch(`${BASE_URL}/doctors?search=${encodeURIComponent(doctorName.split(" ")[0])}`);
    const filteredDocsData = await filteredDocsRes.json();
    assert(filteredDocsData.doctors?.some((d) => d.id === doctorId), "Doctor directory search filters correctly by name");

    // ------------------------------------------------------------------
    // SECTION 3: User Registration, Session Cookie & Profile
    // ------------------------------------------------------------------
    console.log("\n--- 3. Registration, Session Persistence & Profile ---");
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Stage 6 Tester A",
        email: userAEmail,
        password: "SecurePassword123!",
      }),
    });
    assert(regRes.status === 201, "POST /api/auth/register returns 201 Created");
    const regData = await regRes.json();
    userAId = regData.user?.id;
    userAToken = regData.token;
    assert(userAId !== undefined, "Registered User A has valid ID");
    assert(regData.user?.passwordHash === undefined, "Security: passwordHash is stripped from response");

    const cookieToken = extractCookie(regRes);
    assert(cookieToken !== null || userAToken !== null, "Authentication token issued (HTTP-only cookie or bearer)");

    // Verify session persistence via /api/auth/me
    const meRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${userAToken}`,
        Cookie: `emosense_token=${userAToken}`,
      },
    });
    assert(meRes.status === 200, "GET /api/auth/me returns 200 OK with session credentials");
    const meData = await meRes.json();
    assert(meData.user?.email === userAEmail, "Session correctly identifies authenticated User A");

    // Profile update
    const updateProfileRes = await fetch(`${BASE_URL}/auth/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ name: "Stage 6 Verified User A" }),
    });
    assert(updateProfileRes.status === 200, "PUT /api/auth/profile updates user display name");

    // Register User B for isolation checks
    const regBRes = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Stage 6 Tester B",
        email: userBEmail,
        password: "SecurePassword456!",
      }),
    });
    const regBData = await regBRes.json();
    userBId = regBData.user?.id;
    userBToken = regBData.token;
    assert(regBRes.status === 201 && userBId !== undefined, "Registered User B for data isolation verification");

    // ------------------------------------------------------------------
    // SECTION 4: Mood Check-in, History & Analytics
    // ------------------------------------------------------------------
    console.log("\n--- 4. Mood Check-in, History & Analytics ---");
    const moodCreateRes = await fetch(`${BASE_URL}/moods`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        mood: "happy",
        stressLevel: 3,
        moodScore: 8,
        source: "manual",
        notes: "Stage 6 end-to-end verification feeling great!",
      }),
    });
    assert(moodCreateRes.status === 201, "POST /api/moods creates mood check-in (201 Created)");
    const moodCreateData = await moodCreateRes.json();
    moodEntryId = moodCreateData.entry?.id;
    assert(moodEntryId !== undefined, "Mood check-in assigned valid ID");
    assert(moodCreateData.entry?.mood === "happy", "Mood recorded as happy");
    assert(moodCreateData.entry?.stressLevel === 3, "Stress level recorded as 3");

    // Retrieve mood history
    const moodListRes = await fetch(`${BASE_URL}/moods`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert(moodListRes.status === 200, "GET /api/moods returns 200 OK");
    const moodListData = await moodListRes.json();
    assert(moodListData.entries?.some((m) => m.id === moodEntryId), "User A sees their created mood entry in history");

    // Calculate analytics
    const analyticsRes = await fetch(`${BASE_URL}/analytics`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert(analyticsRes.status === 200, "GET /api/analytics returns 200 OK");
    const analyticsData = await analyticsRes.json();
    assert(analyticsData.analytics?.totalEntries >= 1, "Analytics reflects at least 1 total entry");
    assert(typeof analyticsData.analytics?.wellnessScore === "number", `Wellness score calculated: ${analyticsData.analytics?.wellnessScore}`);
    assert(analyticsData.analytics?.stressClassification !== "No Data", `Stress classification: ${analyticsData.analytics?.stressClassification}`);

    // ------------------------------------------------------------------
    // SECTION 5: Authenticated Appointment Booking & Management
    // ------------------------------------------------------------------
    console.log("\n--- 5. Appointment Booking & Management ---");
    const bookRes = await fetch(`${BASE_URL}/appointments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        doctorId,
        date: "2026-11-01",
        time: "10:00",
        consultationType: "video",
        notes: "Initial consultation for Stage 6 verification.",
      }),
    });
    assert(bookRes.status === 201, "POST /api/appointments creates appointment (201 Created)");
    const bookData = await bookRes.json();
    appointmentId = bookData.appointment?.id;
    assert(appointmentId !== undefined, "Appointment assigned valid ID");
    assert(bookData.appointment?.status === "scheduled", "Appointment status is 'scheduled'");

    // List appointments
    const apptsRes = await fetch(`${BASE_URL}/appointments`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert(apptsRes.status === 200, "GET /api/appointments returns 200 OK");
    const apptsData = await apptsRes.json();
    assert(apptsData.appointments?.some((a) => a.id === appointmentId), "User A retrieves their booked appointment");

    // Update appointment notes/time
    const patchRes = await fetch(`${BASE_URL}/appointments/${appointmentId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ time: "11:00", notes: "Updated consultation time." }),
    });
    assert(patchRes.status === 200, "PATCH /api/appointments/:id updates appointment details");

    // ------------------------------------------------------------------
    // SECTION 6: Chat Messaging & Text Emotion Analysis
    // ------------------------------------------------------------------
    console.log("\n--- 6. Chat Messaging & Text Emotion Analysis ---");
    // Create chat session
    const chatSessionRes = await fetch(`${BASE_URL}/chat/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ title: "Stage 6 Verification Chat" }),
    });
    assert(chatSessionRes.status === 201, "POST /api/chat/sessions initializes session (201 Created)");
    const sessionData = await chatSessionRes.json();
    chatSessionId = sessionData.session?.id;

    // Send chat message
    const chatMsgRes = await fetch(`${BASE_URL}/chat/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        message: "I am feeling optimistic and excited about finishing the verification today!",
        sessionId: chatSessionId,
      }),
    });
    assert(chatMsgRes.status === 200, "POST /api/chat/message returns 200 OK");
    assert(chatMsgRes.headers.get("x-backend-service") === "EmoSense-Express-Local", "Header confirms local Express handling");
    const chatMsgData = await chatMsgRes.json();
    assert(chatMsgData._handledBy === "emosense-local-express", "Dual confirmation: _handledBy emosense-local-express");
    assert(typeof chatMsgData.reply === "string" && chatMsgData.reply.length > 0, "Assistant returned empathetic reply");
    assert(chatMsgData.detectedMood !== undefined, `Detected mood in chat: ${chatMsgData.detectedMood}`);

    // Freeform text analysis
    const textAnalysisRes = await fetch(`${BASE_URL}/analysis/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        text: "Today was a productive day. I felt very calm and focused throughout my afternoon work.",
        saveMood: true,
      }),
    });
    assert(textAnalysisRes.status === 201, "POST /api/analysis/text returns 201 Created");
    const textAnalysisData = await textAnalysisRes.json();
    assert(textAnalysisData.analysis?.dominant_mood !== undefined, `Text analysis dominant mood: ${textAnalysisData.analysis?.dominant_mood}`);
    assert(Array.isArray(textAnalysisData.analysis?.recommendations), "Analysis provides actionable wellness recommendations");
    assert(textAnalysisData.analysis?.disclaimer?.includes("not a clinical assessment"), "Framed as wellness information with clinical disclaimer");

    // ------------------------------------------------------------------
    // SECTION 7: Voice Upload, Transcription & Error Handling
    // ------------------------------------------------------------------
    console.log("\n--- 7. Voice Upload, Transcription & Error Handling ---");
    // Missing file check
    const emptyVoiceRes = await fetch(`${BASE_URL}/analysis/voice`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userAToken}` },
      body: new FormData(),
    });
    assert(emptyVoiceRes.status === 400, "POST /api/analysis/voice without audio returns 400 Bad Request");

    // Voice with Web Speech transcript provided by client
    const voiceFormData = new FormData();
    const fakeAudioBlob = new Blob([Buffer.from("RIFF....WAVEfmt ....data....")], { type: "audio/webm" });
    voiceFormData.append("audio", fakeAudioBlob, "voice-test.webm");
    voiceFormData.append("transcript", "I have been feeling quite peaceful and grounded today.");
    voiceFormData.append("pitch", "130");
    voiceFormData.append("energy", "55");
    voiceFormData.append("tempo", "90");

    const voiceSuccessRes = await fetch(`${BASE_URL}/analysis/voice`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userAToken}` },
      body: voiceFormData,
    });
    assert(voiceSuccessRes.status === 201, "POST /api/analysis/voice with transcript returns 201 Created");
    const voiceSuccessData = await voiceSuccessRes.json();
    assert(voiceSuccessData.analysis?.dominant_mood === "calm", "Voice analysis correctly identified 'calm' tone from transcript");
    assert(voiceSuccessData.analysis?.transcriptionProvider === "browser-speech-recognition", "Transcription provider accurately attributed to browser speech recognition");
    assert(voiceSuccessData.moodEntry?.source === "voice", "Atomically recorded MoodEntry with source='voice'");

    // Voice without transcript and without server API key -> Honest 422
    const voiceNoKeyFormData = new FormData();
    voiceNoKeyFormData.append("audio", fakeAudioBlob, "voice-test2.webm");

    const voiceNoKeyRes = await fetch(`${BASE_URL}/analysis/voice`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userAToken}` },
      body: voiceNoKeyFormData,
    });
    assert(voiceNoKeyRes.status === 422, "POST /api/analysis/voice without transcript & server key returns honest 422 TRANSCRIPTION_UNAVAILABLE");
    const voiceNoKeyData = await voiceNoKeyRes.json();
    assert(voiceNoKeyData.error?.code === "TRANSCRIPTION_UNAVAILABLE", "Error code accurately communicates TRANSCRIPTION_UNAVAILABLE");

    // ------------------------------------------------------------------
    // SECTION 8: Face Upload, MIME Validation & Error Handling
    // ------------------------------------------------------------------
    console.log("\n--- 8. Face Upload, MIME Validation & Error Handling ---");
    // Missing image check
    const emptyFaceRes = await fetch(`${BASE_URL}/analysis/face`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userAToken}` },
      body: new FormData(),
    });
    assert(emptyFaceRes.status === 400, "POST /api/analysis/face without image returns 400 Bad Request");

    // Invalid MIME check
    const invalidMimeForm = new FormData();
    const badBlob = new Blob(["not an image"], { type: "text/plain" });
    invalidMimeForm.append("image", badBlob, "test.txt");
    const badMimeRes = await fetch(`${BASE_URL}/analysis/face`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userAToken}` },
      body: invalidMimeForm,
    });
    assert(badMimeRes.status === 400, "POST /api/analysis/face with text/plain returns 400 Bad Request (MIME rejected)");

    // Face upload verification:
    // If Gemini/OpenAI key is configured, live vision analysis succeeds (201 Created).
    // If absent, it returns honest 422 error.
    const faceForm = new FormData();
    const validPngB64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    const pngBuffer = Buffer.from(validPngB64, "base64");
    const pngBlob = new Blob([pngBuffer], { type: "image/png" });
    faceForm.append("image", pngBlob, "face.png");

    const faceRes = await fetch(`${BASE_URL}/analysis/face`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userAToken}` },
      body: faceForm,
    });

    const faceData = await faceRes.json();
    if (process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY) {
      assert(faceRes.status === 201, `POST /api/analysis/face with valid key returns 201 Created (status: ${faceRes.status})`);
      assert(faceData.success === true, "Live face analysis succeeded with active provider");
      assert(typeof faceData.analysis?.dominant_emotion === "string", `Dominant emotion returned: ${faceData.analysis?.dominant_emotion}`);
    } else {
      assert(faceRes.status === 422, "POST /api/analysis/face without key returns honest 422 VISION_UNAVAILABLE");
      assert(faceData.error?.code === "VISION_UNAVAILABLE" || faceData.error?.code === "MISSING_API_KEY", "Error accurately communicates vision unavailable");
    }

    // ------------------------------------------------------------------
    // SECTION 9: Multi-User Data Isolation & Security Boundaries
    // ------------------------------------------------------------------
    console.log("\n--- 9. Multi-User Data Isolation & Security Boundaries ---");
    // User B mood history
    const userBMoodsRes = await fetch(`${BASE_URL}/moods`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    const userBMoodsData = await userBMoodsRes.json();
    assert(userBMoodsData.entries?.length === 0, "User B sees ZERO of User A's mood entries");

    // User B appointments
    const userBApptsRes = await fetch(`${BASE_URL}/appointments`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    const userBApptsData = await userBApptsRes.json();
    assert(userBApptsData.appointments?.length === 0, "User B sees ZERO of User A's appointments");

    // User B attempts to access User A's appointment by ID
    const userBAccessApptRes = await fetch(`${BASE_URL}/appointments/${appointmentId}`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert(userBAccessApptRes.status === 404, "User B receives 404 attempting to view User A's appointment");

    // User B attempts to update User A's appointment
    const userBUpdateApptRes = await fetch(`${BASE_URL}/appointments/${appointmentId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({ status: "cancelled" }),
    });
    assert(userBUpdateApptRes.status === 404, "User B receives 404 attempting to update User A's appointment");

    // User B attempts to access User A's mood entry by ID
    const userBAccessMoodRes = await fetch(`${BASE_URL}/moods/${moodEntryId}`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert(userBAccessMoodRes.status === 404, "User B receives 404 attempting to view User A's mood entry");

    // User B attempts to delete User A's mood entry
    const userBDeleteMoodRes = await fetch(`${BASE_URL}/moods/${moodEntryId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert(userBDeleteMoodRes.status === 404, "User B receives 404 attempting to delete User A's mood entry");

    // User B attempts to access User A's chat session
    const userBAccessChatRes = await fetch(`${BASE_URL}/chat/sessions/${chatSessionId}`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert(userBAccessChatRes.status === 404, "User B receives 404 attempting to view User A's chat session");

    // ------------------------------------------------------------------
    // SECTION 10: Logout & Session Termination
    // ------------------------------------------------------------------
    console.log("\n--- 10. Logout & Session Termination ---");
    const logoutRes = await fetch(`${BASE_URL}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert(logoutRes.status === 200, "POST /api/auth/logout returns 200 OK");
    const cookies = logoutRes.headers.getSetCookie ? logoutRes.headers.getSetCookie() : [logoutRes.headers.get("set-cookie") || ""];
    const cookieStr = cookies.join("; ");
    assert(
      /expires=thu, 01 jan 1970/i.test(cookieStr) || /max-age=0/i.test(cookieStr) || cookieStr.includes("emosense_token=;"),
      "Logout clears authentication cookie (sets expiration in past)"
    );

    // ------------------------------------------------------------------
    // SECTION 11: Cleanup & Database Integrity Preservation
    // ------------------------------------------------------------------
    console.log("\n--- 11. Cleanup & Persistent Data Preservation ---");
    // Clean up ONLY the two test users created in this specific test run
    if (userAId || userBId) {
      const ids = [userAId, userBId].filter(Boolean);
      await prisma.appointment.deleteMany({ where: { userId: { in: ids } } });
      await prisma.moodEntry.deleteMany({ where: { userId: { in: ids } } });
      await prisma.chatMessage.deleteMany({ where: { session: { userId: { in: ids } } } });
      await prisma.chatSession.deleteMany({ where: { userId: { in: ids } } });
      await prisma.analysisRecord.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
      console.log("  ✔ Test users and associated test records safely cleaned up from SQLite.");
    }

    const remainingDoctors = await prisma.doctor.count();
    assert(remainingDoctors > 0, `Database integrity preserved: ${remainingDoctors} genuine doctor records intact`);
  } catch (err) {
    failed += 1;
    console.error("  ✖ Unexpected test exception:", err);
  } finally {
    await prisma.$disconnect();
    console.log("\n=======================================================");
    console.log(`  STAGE 6 TEST RESULTS:  ${passed} PASSED  |  ${failed} FAILED`);
    console.log("=======================================================\n");

    if (failed > 0) {
      process.exit(1);
    }
  }
}

runStage6Verification();
