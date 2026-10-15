// Mood Check-in and History Routes for EmoSense AI
import express from "express";
import { z } from "zod";
import prisma from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { calculateMoodAnalytics } from "./analytics.js";

const router = express.Router();

// Helper to safely parse JSON strings
function safeJsonParse(val) {
  if (!val) return null;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}

/**
 * Formats a MoodEntry record to support both camelCase and snake_case fields
 * for complete compatibility across the entire stack.
 */
export function formatMoodEntry(entry) {
  if (!entry) return null;
  return {
    id: entry.id,
    userId: entry.userId,
    mood: entry.mood,
    moodScore: entry.moodScore,
    mood_score: entry.moodScore,
    stressLevel: entry.stressLevel,
    stress_level: entry.stressLevel,
    source: entry.source,
    notes: entry.notes || "",
    tags: entry.tags,
    voiceAnalysis: safeJsonParse(entry.voiceAnalysis),
    faceAnalysis: safeJsonParse(entry.faceAnalysis),
    createdAt: entry.createdAt,
    created_date: entry.createdAt,
  };
}

const validMoods = ["happy", "calm", "neutral", "anxious", "sad", "stressed", "angry"];
const validSources = ["manual", "chat", "voice", "face"];

// Input Validation Schema for Mood Check-in
const moodCheckInSchema = z.object({
  mood: z
    .string()
    .trim()
    .toLowerCase()
    .refine((val) => validMoods.includes(val), {
      message: `Mood must be one of: ${validMoods.join(", ")}`,
    }),
  stressLevel: z.coerce.number().min(1).max(10).optional(),
  stress_level: z.coerce.number().min(1).max(10).optional(),
  moodScore: z.coerce.number().min(1).max(10).optional(),
  mood_score: z.coerce.number().min(1).max(10).optional(),
  source: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .refine((val) => !val || validSources.includes(val), {
      message: `Source must be one of: ${validSources.join(", ")}`,
    }),
  notes: z.string().max(2000, "Notes cannot exceed 2000 characters").optional().nullable(),
  tags: z.union([z.string(), z.array(z.string())]).optional().nullable(),
  voiceAnalysis: z.any().optional().nullable(),
  voice_analysis: z.any().optional().nullable(),
  faceAnalysis: z.any().optional().nullable(),
  face_analysis: z.any().optional().nullable(),
  createdAt: z.string().datetime().optional(),
});

/**
 * POST /api/moods
 * Authenticated mood check-in: Saves mood, stress rating, notes, and timestamps.
 */
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const validated = moodCheckInSchema.parse(req.body);

    const stressLevel = validated.stressLevel ?? validated.stress_level ?? 5;
    const moodScore = validated.moodScore ?? validated.mood_score ?? Math.max(1, Math.min(10, 11 - stressLevel));
    const source = validated.source || "manual";
    const notes = validated.notes?.trim() || null;

    let tags = null;
    if (validated.tags) {
      tags = Array.isArray(validated.tags) ? validated.tags.join(",") : validated.tags;
    }

    const voiceAnalysis = validated.voiceAnalysis ?? validated.voice_analysis ?? null;
    const faceAnalysis = validated.faceAnalysis ?? validated.face_analysis ?? null;

    const newEntry = await prisma.moodEntry.create({
      data: {
        userId: req.userId,
        mood: validated.mood,
        moodScore,
        stressLevel,
        source,
        notes,
        tags,
        voiceAnalysis: voiceAnalysis ? JSON.stringify(voiceAnalysis) : null,
        faceAnalysis: faceAnalysis ? JSON.stringify(faceAnalysis) : null,
        ...(validated.createdAt ? { createdAt: new Date(validated.createdAt) } : {}),
      },
    });

    res.status(201).json({
      success: true,
      message: "Mood check-in recorded successfully.",
      entry: formatMoodEntry(newEntry),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/moods
 * Retrieves only the authenticated user's mood history with filtering and sorting.
 */
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { source, limit = 50, page = 1, startDate, endDate } = req.query;

    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const skip = (parsedPage - 1) * parsedLimit;

    const where = {
      userId: req.userId, // Strictly scopes to authenticated user
    };

    if (source && validSources.includes(source.toLowerCase())) {
      where.source = source.toLowerCase();
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const [total, entries] = await Promise.all([
      prisma.moodEntry.count({ where }),
      prisma.moodEntry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: parsedLimit,
        skip,
      }),
    ]);

    const formattedEntries = entries.map(formatMoodEntry);

    res.json({
      success: true,
      count: entries.length,
      total,
      page: parsedPage,
      limit: parsedLimit,
      entries: formattedEntries,
      data: formattedEntries, // Alias for TanStack React Query conveniences
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/moods/analytics
 * Analytics endpoint scoped to the authenticated user's records.
 */
router.get("/analytics", requireAuth, async (req, res, next) => {
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

/**
 * GET /api/moods/:id
 * Retrieves a single mood entry, strictly owned by the authenticated user.
 */
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const entry = await prisma.moodEntry.findUnique({
      where: { id: req.params.id },
    });

    if (!entry || entry.userId !== req.userId) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Mood entry not found.",
        },
      });
    }

    res.json({
      success: true,
      entry: formatMoodEntry(entry),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/moods/:id
 * Deletes a mood entry, strictly owned by the authenticated user.
 */
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const entry = await prisma.moodEntry.findUnique({
      where: { id: req.params.id },
    });

    if (!entry || entry.userId !== req.userId) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Mood entry not found.",
        },
      });
    }

    await prisma.moodEntry.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: "Mood entry deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
