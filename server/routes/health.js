// Health Check Route for EmoSense AI Backend
import express from "express";
import prisma from "../db.js";
import aiService from "../services/aiService.js";

const router = express.Router();

router.get("/health", async (req, res, next) => {
  try {
    const startTime = Date.now();
    // Test database connectivity
    await prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - startTime;

    const doctorCount = await prisma.doctor.count();
    const activeAi = aiService.getActiveAiProvider();

    res.json({
      status: "ok",
      service: "EmoSense AI Backend",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        status: "connected",
        provider: "sqlite",
        latencyMs: dbLatencyMs,
        demoDoctorsLoaded: doctorCount,
      },
      ai: activeAi,
    });
  } catch (error) {
    console.error("Health check database failure:", error);
    res.status(503).json({
      status: "degraded",
      service: "EmoSense AI Backend",
      timestamp: new Date().toISOString(),
      database: {
        status: "disconnected",
        error: error.message,
      },
    });
  }
});

export default router;
