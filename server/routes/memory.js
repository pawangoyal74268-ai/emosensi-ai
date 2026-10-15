// API Routes for Long-Term Memory Management in EmoSense AI
import express from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import memoryService from "../services/memoryService.js";
import prisma from "../db.js";

const router = express.Router();

const memoryCreateSchema = z.object({
  content: z.string().trim().min(3, "Memory content must be at least 3 characters").max(500),
  category: z
    .enum(["preference", "project", "goal", "topic", "task", "communication_style", "general"])
    .optional()
    .default("general"),
});

/**
 * GET /api/memory
 * Lists authenticated user's stored memories.
 */
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const memories = await memoryService.listUserMemories(req.userId);
    res.json({
      success: true,
      count: memories.length,
      memories: memories.map((m) => ({
        id: m.id,
        category: m.category,
        content: m.content,
        lastRecalledAt: m.lastRecalledAt,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
    });
  } catch (error) {
    console.error("[Memory API Error] GET /api/memory failed:", error);
    next(error);
  }
});

/**
 * POST /api/memory
 * Allows user to manually add or edit a personalized memory fact.
 */
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const validated = memoryCreateSchema.parse(req.body);

    if (memoryService.isSensitiveMemory(validated.content)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "SENSITIVE_CONTENT",
          message: "For your privacy, passwords, credentials, and sensitive clinical diagnoses cannot be saved to AI memory.",
        },
      });
    }

    const saved = await memoryService.saveCandidateMemories(req.userId, null, [
      {
        category: validated.category,
        content: validated.content,
      },
    ]);

    res.status(201).json({
      success: true,
      memory: saved[0] || null,
      message: "Memory saved successfully.",
    });
  } catch (error) {
    console.error("[Memory API Error] POST /api/memory failed:", error);
    next(error);
  }
});

/**
 * DELETE /api/memory/:id
 * Deletes a specific memory owned by the authenticated user.
 */
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const deleted = await memoryService.deleteUserMemory(req.userId, req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Memory not found or not owned by authenticated user.",
        },
      });
    }

    res.json({
      success: true,
      message: "Memory deleted successfully.",
    });
  } catch (error) {
    console.error(`[Memory API Error] DELETE /api/memory/${req.params.id} failed:`, error);
    next(error);
  }
});

/**
 * DELETE /api/memory
 * Clears all memories for the authenticated user.
 */
router.delete("/", requireAuth, async (req, res, next) => {
  try {
    const deletedCount = await memoryService.clearAllUserMemories(req.userId);
    res.json({
      success: true,
      count: deletedCount,
      message: "All memories cleared successfully.",
    });
  } catch (error) {
    console.error("[Memory API Error] DELETE /api/memory failed:", error);
    next(error);
  }
});

export default router;
