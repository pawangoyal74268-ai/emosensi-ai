// Comprehensive Stage 3 Automated Test Suite
// Validates:
// 1. Health check
// 2. Authentication isolation for multiple users
// 3. Mood check-in API (validations, persistence, timestamps)
// 4. Mood history retrieval (private record isolation)
// 5. Stress and mood analytics calculation from actual DB records
// 6. Doctor directory listing, filtering, search, and details
// 7. Appointment booking, listing, ownership security, update, and cancellation
// 8. Cross-user access denial tests

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
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const TEST_PORT = 5055;
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

async function runTests() {
  console.log("\n=======================================================");
  console.log("  EMOSENSE AI — STAGE 3 CORE APPLICATION APIS TEST SUITE");
  console.log("=======================================================\n");

  const app = createTestApp();
  const server = app.listen(TEST_PORT);

  try {
    // -----------------------------------------------------------
    // TEST GROUP 1: Health & System Connectivity
    // -----------------------------------------------------------
    console.log("--- Test Group 1: Backend System Health ---");
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, "Health endpoint returns 200");
    assert(healthData.status === "ok", "Health status is ok");
    assert(healthData.database?.status === "connected", "Database status is connected");

    // -----------------------------------------------------------
    // TEST GROUP 2: Authentication & Multi-user Setup
    // -----------------------------------------------------------
    console.log("\n--- Test Group 2: User Creation & Authentication ---");
    const timestamp = Date.now();
    const userAEmail = `testerA_${timestamp}@emosense.test`;
    const userBEmail = `testerB_${timestamp}@emosense.test`;

    const regARes = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userAEmail, password: "Password123!", name: "Alice Tester" }),
    });
    const regAData = await regARes.json();
    assert(regARes.status === 201, "User A registered successfully", JSON.stringify(regAData));
    const tokenA = regAData.token;
    const userAId = regAData.user.id;

    const regBRes = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userBEmail, password: "Password123!", name: "Bob Tester" }),
    });
    const regBData = await regBRes.json();
    assert(regBRes.status === 201, "User B registered successfully");
    const tokenB = regBData.token;
    const userBId = regBData.user.id;

    // -----------------------------------------------------------
    // TEST GROUP 3: Mood Check-in API (POST /api/moods)
    // -----------------------------------------------------------
    console.log("\n--- Test Group 3: Mood Check-in API ---");

    // Unauthenticated rejection
    const unauthMoodRes = await fetch(`${BASE_URL}/moods`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mood: "calm", stressLevel: 3 }),
    });
    assert(unauthMoodRes.status === 401, "Unauthenticated mood check-in is rejected (401)");

    // Invalid payload rejection (invalid mood value)
    const invalidMoodRes = await fetch(`${BASE_URL}/moods`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ mood: "super_ecstatic", stressLevel: 4 }),
    });
    assert(invalidMoodRes.status === 400, "Invalid mood enum is rejected with 400 Validation Error");

    // Valid Mood 1 for Alice
    const mood1Res = await fetch(`${BASE_URL}/moods`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        mood: "happy",
        mood_score: 8,
        stress_level: 3,
        source: "manual",
        notes: "Had a productive and peaceful morning.",
      }),
    });
    const mood1Data = await mood1Res.json();
    assert(mood1Res.status === 201, "Alice creates mood check-in #1 (happy)", JSON.stringify(mood1Data));
    assert(mood1Data.entry?.mood === "happy", "Entry mood saved correctly as happy");
    assert(mood1Data.entry?.stressLevel === 3, "Entry stress level saved correctly as 3");
    assert(mood1Data.entry?.stress_level === 3, "Snake_case alias stress_level present");
    assert(mood1Data.entry?.moodScore === 8, "Mood score saved as 8");
    assert(mood1Data.entry?.notes === "Had a productive and peaceful morning.", "Notes persisted correctly");
    assert(Boolean(mood1Data.entry?.createdAt), "Timestamp createdAt is recorded");
    const aliceMood1Id = mood1Data.entry.id;

    // Valid Mood 2 for Alice
    const mood2Res = await fetch(`${BASE_URL}/moods`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        mood: "anxious",
        moodScore: 4,
        stressLevel: 7,
        source: "chat",
        notes: "Work deadline approaching soon.",
      }),
    });
    const mood2Data = await mood2Res.json();
    assert(mood2Res.status === 201, "Alice creates mood check-in #2 (anxious)");
    const aliceMood2Id = mood2Data.entry.id;

    // Valid Mood 3 for Alice
    const mood3Res = await fetch(`${BASE_URL}/moods`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        mood: "calm",
        moodScore: 7,
        stressLevel: 2,
        source: "voice",
        notes: "Evening meditation session completed.",
      }),
    });
    assert(mood3Res.status === 201, "Alice creates mood check-in #3 (calm)");

    // -----------------------------------------------------------
    // TEST GROUP 4: Mood History Retrieval & Privacy Isolation
    // -----------------------------------------------------------
    console.log("\n--- Test Group 4: Mood History & Privacy Isolation ---");

    // Alice views her history
    const aliceHistoryRes = await fetch(`${BASE_URL}/moods`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const aliceHistory = await aliceHistoryRes.json();
    assert(aliceHistoryRes.status === 200, "Alice retrieves her mood history (200)");
    assert(aliceHistory.count === 3, "Alice retrieves exactly her 3 entries", `Found ${aliceHistory.count}`);

    // Bob views his history (should be 0, totally isolated!)
    const bobHistoryRes = await fetch(`${BASE_URL}/moods`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const bobHistory = await bobHistoryRes.json();
    assert(bobHistoryRes.status === 200, "Bob retrieves his mood history (200)");
    assert(bobHistory.count === 0, "Bob cannot see Alice's records (count is 0)");

    // Filter by source=manual
    const manualHistoryRes = await fetch(`${BASE_URL}/moods?source=manual`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const manualHistory = await manualHistoryRes.json();
    assert(manualHistory.count === 1, "Filter by source=manual returns 1 entry");

    // Alice retrieves her single mood entry by ID
    const singleMoodRes = await fetch(`${BASE_URL}/moods/${aliceMood1Id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const singleMood = await singleMoodRes.json();
    assert(singleMoodRes.status === 200, "Alice retrieves her entry by ID");
    assert(singleMood.entry?.id === aliceMood1Id, "Correct entry ID returned");

    // Bob attempts to view Alice's mood entry by ID (must be denied!)
    const bobSpyRes = await fetch(`${BASE_URL}/moods/${aliceMood1Id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(bobSpyRes.status === 404, "Bob cannot access Alice's private mood entry (404 Not Found)");

    // -----------------------------------------------------------
    // TEST GROUP 5: Analytics Endpoints
    // -----------------------------------------------------------
    console.log("\n--- Test Group 5: Mood & Stress Analytics ---");

    const analyticsRes = await fetch(`${BASE_URL}/analytics`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const analyticsData = await analyticsRes.json();
    assert(analyticsRes.status === 200, "Analytics endpoint returns 200");
    const a = analyticsData.analytics;
    assert(a.totalEntries === 3, "Analytics totalEntries calculated correctly as 3");
    // Average stress: (3 + 7 + 2) / 3 = 4.0
    assert(a.averageStress === 4, `Analytics averageStress is 4.0 (got ${a.averageStress})`);
    // Average mood score: (8 + 4 + 7) / 3 = 6.3
    assert(a.averageMoodScore === 6.3, `Analytics averageMoodScore is 6.3 (got ${a.averageMoodScore})`);
    assert(a.wellnessScore >= 15 && a.wellnessScore <= 100, `WellnessScore is clamped (got ${a.wellnessScore})`);
    assert(a.stressClassification === "Moderate", `StressClassification is Moderate (got ${a.stressClassification})`);
    assert(a.moodDistribution.happy === 1, "MoodDistribution happy count is 1");
    assert(a.moodDistribution.anxious === 1, "MoodDistribution anxious count is 1");
    assert(a.moodDistribution.calm === 1, "MoodDistribution calm count is 1");
    assert(a.sourceDistribution.manual === 1, "Source manual count is 1");
    assert(a.sourceDistribution.chat === 1, "Source chat count is 1");
    assert(a.sourceDistribution.voice === 1, "Source voice count is 1");
    assert(Array.isArray(a.dailyTrends) && a.dailyTrends.length > 0, "Daily trends timeline is populated");

    // Test alias route /api/moods/analytics
    const aliasAnalyticsRes = await fetch(`${BASE_URL}/moods/analytics`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(aliasAnalyticsRes.status === 200, "Alias route /api/moods/analytics returns 200");

    // Bob has 0 records — verify analytics handles 0 records gracefully without error
    const bobAnalyticsRes = await fetch(`${BASE_URL}/analytics`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const bobAnalytics = await bobAnalyticsRes.json();
    assert(bobAnalyticsRes.status === 200, "Empty user analytics returns 200 without error");
    assert(bobAnalytics.analytics?.totalEntries === 0, "Empty user has totalEntries = 0");
    assert(bobAnalytics.analytics?.averageStress === null, "Empty user has averageStress = null");

    // -----------------------------------------------------------
    // TEST GROUP 6: Doctors Directory Listing & Details
    // -----------------------------------------------------------
    console.log("\n--- Test Group 6: Doctors Directory APIs ---");

    const doctorsRes = await fetch(`${BASE_URL}/doctors`);
    const doctorsData = await doctorsRes.json();
    assert(doctorsRes.status === 200, "Doctors list endpoint returns 200");
    assert(doctorsData.count >= 5, `Doctors count is at least 5 (got ${doctorsData.count})`);

    const doc1 = doctorsData.doctors[0];
    assert(Boolean(doc1.id && doc1.name && doc1.specialization), "Doctor record contains required core fields");
    assert(Array.isArray(doc1.languages), "Doctor languages formatted as array");
    assert(Array.isArray(doc1.availableSlots || doc1.available_slots), "Doctor availableSlots formatted as array");
    assert(Boolean(doc1.consultationFee || doc1.consultation_fee), "Doctor consultationFee is present");

    // Specialization filter
    const psychRes = await fetch(`${BASE_URL}/doctors?specialization=Psychiatrist`);
    const psychData = await psychRes.json();
    assert(psychRes.status === 200, "Filter doctors by specialization Psychiatrist returns 200");
    assert(psychData.doctors.every((d) => d.specialization === "Psychiatrist"), "All returned doctors are Psychiatrists");

    // Search query
    const searchRes = await fetch(`${BASE_URL}/doctors?search=Jenkins`);
    const searchData = await searchRes.json();
    assert(searchRes.status === 200, "Search doctors by 'Jenkins' returns 200");
    assert(searchData.doctors.some((d) => d.name.includes("Jenkins")), "Dr. Jenkins returned in search");

    // Single doctor by ID
    const singleDocRes = await fetch(`${BASE_URL}/doctors/${doc1.id}`);
    const singleDocData = await singleDocRes.json();
    assert(singleDocRes.status === 200, "Retrieve single doctor by ID returns 200");
    assert(singleDocData.doctor.id === doc1.id, "Correct doctor ID returned");

    // Non-existent doctor
    const missingDocRes = await fetch(`${BASE_URL}/doctors/non-existent-doc-id`);
    assert(missingDocRes.status === 404, "Non-existent doctor ID returns 404");

    // -----------------------------------------------------------
    // TEST GROUP 7: Appointments Booking & Management
    // -----------------------------------------------------------
    console.log("\n--- Test Group 7: Appointment APIs & Security ---");

    // Unauthenticated booking rejection
    const unauthAptRes = await fetch(`${BASE_URL}/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doctorId: doc1.id,
        date: "2026-11-01",
        time: "10:00",
      }),
    });
    assert(unauthAptRes.status === 401, "Unauthenticated appointment booking rejected (401)");

    // Booking with invalid doctor ID
    const invalidDocAptRes = await fetch(`${BASE_URL}/appointments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        doctorId: "fake-doctor-id",
        date: "2026-11-01",
        time: "10:00",
      }),
    });
    assert(invalidDocAptRes.status === 404, "Booking with non-existent doctor rejected with 404 DOCTOR_NOT_FOUND");

    // Booking with invalid date format
    const invalidDateAptRes = await fetch(`${BASE_URL}/appointments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        doctorId: doc1.id,
        date: "tomorrow",
        time: "10:00",
      }),
    });
    assert(invalidDateAptRes.status === 400, "Booking with invalid date format rejected with 400");

    // Valid booking for Alice
    const aliceAptRes = await fetch(`${BASE_URL}/appointments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        doctorId: doc1.id,
        doctorName: doc1.name,
        date: "2026-11-05",
        time: "14:00",
        consultationType: "video",
        notes: "Initial consultation on stress management.",
      }),
    });
    const aliceAptData = await aliceAptRes.json();
    assert(aliceAptRes.status === 201, "Alice successfully books appointment (201)");
    assert(aliceAptData.appointment?.status === "scheduled", "Appointment status is 'scheduled'");
    assert(aliceAptData.appointment?.doctorName === doc1.name, "Doctor name persisted correctly");
    assert(aliceAptData.appointment?.type === "video", "Consultation type persisted correctly");
    const aliceAptId = aliceAptData.appointment.id;

    // Alice views her appointments
    const aliceAptsRes = await fetch(`${BASE_URL}/appointments`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const aliceApts = await aliceAptsRes.json();
    assert(aliceAptsRes.status === 200, "Alice retrieves her appointments list");
    assert(aliceApts.count === 1, "Alice has exactly 1 appointment");

    // Bob views his appointments (must be 0!)
    const bobAptsRes = await fetch(`${BASE_URL}/appointments`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const bobApts = await bobAptsRes.json();
    assert(bobApts.count === 0, "Bob cannot see Alice's appointments (count is 0)");

    // Bob attempts to view Alice's appointment by ID (must be 404!)
    const bobAptSpyRes = await fetch(`${BASE_URL}/appointments/${aliceAptId}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(bobAptSpyRes.status === 404, "Bob cannot access Alice's private appointment by ID (404)");

    // Bob attempts to cancel/patch Alice's appointment (must be 404!)
    const bobAptPatchSpy = await fetch(`${BASE_URL}/appointments/${aliceAptId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ status: "cancelled" }),
    });
    assert(bobAptPatchSpy.status === 404, "Bob cannot modify Alice's appointment (404)");

    // Alice updates appointment status to cancelled
    const aliceCancelRes = await fetch(`${BASE_URL}/appointments/${aliceAptId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ status: "cancelled", notes: "Rescheduling needed" }),
    });
    const aliceCancelData = await aliceCancelRes.json();
    assert(aliceCancelRes.status === 200, "Alice cancels her appointment (200)");
    assert(aliceCancelData.appointment?.status === "cancelled", "Appointment status updated to 'cancelled'");

    // Alice deletes mood entry #2
    const deleteMoodRes = await fetch(`${BASE_URL}/moods/${aliceMood2Id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(deleteMoodRes.status === 200, "Alice deletes mood entry #2 (200)");

    // Verify Alice now has 2 mood entries
    const aliceFinalHistory = await (
      await fetch(`${BASE_URL}/moods`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      })
    ).json();
    assert(aliceFinalHistory.count === 2, "Alice mood entries count is now 2 after deletion");

    // -----------------------------------------------------------
    // Cleanup test users from DB
    // -----------------------------------------------------------
    await prisma.user.deleteMany({
      where: { id: { in: [userAId, userBId] } },
    });
    console.log("\nTest artifacts cleaned up from SQLite database.");
  } finally {
    server.close();
    await prisma.$disconnect();
  }

  console.log("\n=======================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Unhandled test execution error:", err);
  process.exit(1);
});
