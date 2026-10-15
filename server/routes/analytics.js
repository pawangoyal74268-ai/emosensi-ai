// Analytics Calculation and Routes for EmoSense AI
import express from "express";
import prisma from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { formatMoodEntry } from "./moods.js";

const router = express.Router();

/**
 * Calculates comprehensive mood and stress statistics for a user from actual saved database records.
 * Gracefully handles 0 records without throwing divide-by-zero or undefined errors.
 */
export async function calculateMoodAnalytics(userId, days = 30) {
  const where = {
    userId,
  };

  if (days && days > 0) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    where.createdAt = { gte: cutoffDate };
  }

  const entries = await prisma.moodEntry.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  const totalEntries = entries.length;

  if (totalEntries === 0) {
    return {
      periodDays: days,
      totalEntries: 0,
      averageStress: null,
      averageMoodScore: null,
      wellnessScore: null,
      stressClassification: "No Data",
      latestMood: null,
      moodDistribution: {
        happy: 0,
        calm: 0,
        neutral: 0,
        anxious: 0,
        sad: 0,
        stressed: 0,
        angry: 0,
      },
      sourceDistribution: {
        manual: 0,
        chat: 0,
        voice: 0,
        face: 0,
      },
      stressDistribution: {
        low: 0,
        moderate: 0,
        elevated: 0,
        high: 0,
      },
      dailyTrends: [],
    };
  }

  // Calculate stress and mood score statistics
  let totalStress = 0;
  let totalMoodScore = 0;
  let validStressCount = 0;
  let validMoodScoreCount = 0;

  const moodDistribution = {
    happy: 0,
    calm: 0,
    neutral: 0,
    anxious: 0,
    sad: 0,
    stressed: 0,
    angry: 0,
  };

  const sourceDistribution = {
    manual: 0,
    chat: 0,
    voice: 0,
    face: 0,
  };

  const stressDistribution = {
    low: 0,
    moderate: 0,
    elevated: 0,
    high: 0,
  };

  // Group by date for daily trends
  const dailyGroups = {};

  for (const entry of entries) {
    // Mood counts
    const normalizedMood = entry.mood?.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(moodDistribution, normalizedMood)) {
      moodDistribution[normalizedMood] += 1;
    }

    // Source counts
    const normalizedSource = entry.source?.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(sourceDistribution, normalizedSource)) {
      sourceDistribution[normalizedSource] += 1;
    }

    // Stress tracking
    if (typeof entry.stressLevel === "number") {
      totalStress += entry.stressLevel;
      validStressCount += 1;

      if (entry.stressLevel <= 3) stressDistribution.low += 1;
      else if (entry.stressLevel <= 5) stressDistribution.moderate += 1;
      else if (entry.stressLevel <= 7) stressDistribution.elevated += 1;
      else stressDistribution.high += 1;
    }

    // Mood score tracking
    if (typeof entry.moodScore === "number") {
      totalMoodScore += entry.moodScore;
      validMoodScoreCount += 1;
    }

    // Daily grouping
    const dateKey = entry.createdAt.toISOString().split("T")[0];
    if (!dailyGroups[dateKey]) {
      dailyGroups[dateKey] = {
        date: dateKey,
        stressSum: 0,
        moodSum: 0,
        count: 0,
      };
    }
    dailyGroups[dateKey].stressSum += entry.stressLevel || 5;
    dailyGroups[dateKey].moodSum += entry.moodScore || 5;
    dailyGroups[dateKey].count += 1;
  }

  const averageStress = validStressCount > 0 ? Math.round((totalStress / validStressCount) * 10) / 10 : null;
  const averageMoodScore = validMoodScoreCount > 0 ? Math.round((totalMoodScore / validMoodScoreCount) * 10) / 10 : null;

  // Stress classification label
  let stressClassification = "Moderate";
  if (averageStress !== null) {
    if (averageStress <= 3) stressClassification = "Low";
    else if (averageStress <= 5) stressClassification = "Moderate";
    else if (averageStress <= 7) stressClassification = "Elevated";
    else stressClassification = "High";
  }

  const latestMood = formatMoodEntry(entries[0]);

  // Wellness score formula aligned with dashboard: clamped between 15 and 100
  let wellnessScore = null;
  if (averageStress !== null) {
    const moodBonus = latestMood?.moodScore ? (latestMood.moodScore - 5) * 3 : 0;
    const rawScore = Math.round(100 - averageStress * 7 + moodBonus);
    wellnessScore = Math.max(15, Math.min(100, rawScore));
  }

  // Generate daily trends in chronological order
  const dailyTrends = Object.keys(dailyGroups)
    .sort()
    .map((dateKey) => {
      const g = dailyGroups[dateKey];
      return {
        date: g.date,
        averageStress: Math.round((g.stressSum / g.count) * 10) / 10,
        averageMoodScore: Math.round((g.moodSum / g.count) * 10) / 10,
        count: g.count,
      };
    });

  return {
    periodDays: days,
    totalEntries,
    averageStress,
    averageMoodScore,
    wellnessScore,
    stressClassification,
    latestMood,
    moodDistribution,
    sourceDistribution,
    stressDistribution,
    dailyTrends,
  };
}

/**
 * GET /api/analytics
 * Retrieves aggregated stress and mood analytics for the authenticated user.
 */
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const analytics = await calculateMoodAnalytics(req.userId, days);
    res.json({
      success: true,
      analytics,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
