// Emotional Analysis Routes for EmoSense AI (Text & Voice)
import express from "express";
import multer from "multer";
import { z } from "zod";
import prisma from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import aiService from "../services/aiService.js";
import { formatMoodEntry } from "./moods.js";

const router = express.Router();

// Memory-backed Multer configuration with size limits and MIME validation
const ALLOWED_AUDIO_MIMES = [
  "audio/webm",
  "audio/ogg",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mp3",
  "audio/mpeg",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "video/webm",
];

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB limit
  },
  fileFilter: (req, file, cb) => {
    const mime = (file.mimetype || "").toLowerCase().split(";")[0].trim();
    if (ALLOWED_AUDIO_MIMES.includes(mime)) {
      cb(null, true);
    } else {
      const err = new Error(
        `Invalid audio file format (${file.mimetype}). Supported formats: WebM, WAV, MP3, OGG, M4A, AAC.`
      );
      err.code = "INVALID_FILE_TYPE";
      err.status = 400;
      cb(err, false);
    }
  },
});

function handleAudioUpload(req, res, next) {
  audioUpload.single("audio")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          error: {
            code: "FILE_TOO_LARGE",
            message: "Audio recording exceeds the 15MB file size limit.",
          },
        });
      }
      return res.status(400).json({
        success: false,
        error: {
          code: err.code || "INVALID_FILE",
          message: err.message || "Invalid audio file upload.",
        },
      });
    }
    next();
  });
}

// Memory-backed Multer configuration for face image captures (10MB limit, strict image MIMEs)
const ALLOWED_IMAGE_MIMES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const mime = (file.mimetype || "").toLowerCase().split(";")[0].trim();
    if (ALLOWED_IMAGE_MIMES.includes(mime)) {
      cb(null, true);
    } else {
      const err = new Error(
        `Invalid image file format (${file.mimetype}). Supported formats: JPEG, PNG, WebP.`
      );
      err.code = "INVALID_FILE_TYPE";
      err.status = 400;
      cb(err, false);
    }
  },
});

function handleImageUpload(req, res, next) {
  imageUpload.single("image")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          error: {
            code: "FILE_TOO_LARGE",
            message: "Image upload exceeds the 10MB file size limit.",
          },
        });
      }
      return res.status(400).json({
        success: false,
        error: {
          code: err.code || "INVALID_FILE",
          message: err.message || "Invalid image file upload.",
        },
      });
    }
    next();
  });
}

function safeJsonParse(str) {
  if (!str) return null;
  if (typeof str === "object") return str;
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

function formatAnalysisRecord(record) {
  if (!record) return null;
  return {
    id: record.id,
    userId: record.userId,
    analysisType: record.analysisType,
    result: safeJsonParse(record.result),
    confidence: record.confidence,
    disclaimer: record.disclaimer,
    createdAt: record.createdAt,
    created_date: record.createdAt,
  };
}

const textAnalysisSchema = z.object({
  text: z.string().trim().min(1, "Text content is required").max(10000, "Text must be under 10,000 characters"),
  saveMood: z.boolean().optional().default(true),
  title: z.string().max(200).optional(),
});

/**
 * POST /api/analysis/text
 * Performs structured non-clinical emotional analysis on journal entries or free text.
 * Saves an AnalysisRecord and optionally creates a MoodEntry for the authenticated user.
 */
router.post("/text", requireAuth, async (req, res, next) => {
  try {
    const validated = textAnalysisSchema.parse(req.body);
    const { text, saveMood } = validated;

    // Run text analysis
    const analysis = await aiService.analyzeText(text);

    // Save AnalysisRecord to SQLite database
    const analysisRecord = await prisma.analysisRecord.create({
      data: {
        userId: req.userId,
        analysisType: "text",
        result: JSON.stringify(analysis),
        confidence: analysis.confidence || 75,
        disclaimer: analysis.disclaimer,
      },
    });

    let moodEntry = null;
    if (saveMood) {
      moodEntry = await prisma.moodEntry.create({
        data: {
          userId: req.userId,
          mood: analysis.dominant_mood || "neutral",
          moodScore: analysis.mood_score || 5,
          stressLevel: analysis.stress_level || 5,
          source: "manual",
          notes: (analysis.summary || text).substring(0, 500),
        },
      });
    }

    res.setHeader("X-Backend-Service", "EmoSense-Express-Local");

    res.status(201).json({
      success: true,
      message: "Text analysis completed successfully.",
      analysis,
      record: formatAnalysisRecord(analysisRecord),
      moodEntry: moodEntry ? formatMoodEntry(moodEntry) : null,
      _handledBy: "emosense-local-express",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/analysis/voice
 * Analyzes spoken voice audio for emotional markers, tone, and acoustic signals.
 * Transcribes audio via configured server provider (Whisper/Gemini) or browser SpeechRecognition.
 * Saves an AnalysisRecord (type: "voice") and linked MoodEntry (source: "voice") atomically.
 */
router.post("/voice", requireAuth, handleAudioUpload, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: "AUDIO_FILE_REQUIRED",
          message: "Audio recording file is required for voice analysis.",
        },
      });
    }

    let transcript = "";
    let provider = "unknown";

    // 1. Try server-side transcription if provider is configured
    const serverTranscription = await aiService.transcribeAudio(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );

    if (serverTranscription && serverTranscription.transcript) {
      transcript = serverTranscription.transcript;
      provider = serverTranscription.provider;
    } else if (req.body.transcript && typeof req.body.transcript === "string" && req.body.transcript.trim().length > 0) {
      // 2. Client-provided speech recognition transcript (Web Speech API)
      transcript = req.body.transcript.trim();
      provider = "browser-speech-recognition";
    }

    // 3. If neither server provider nor client transcript is available:
    if (!transcript) {
      return res.status(422).json({
        success: false,
        error: {
          code: "TRANSCRIPTION_UNAVAILABLE",
          message:
            "Speech transcription is currently unavailable. Please configure GEMINI_API_KEY or OPENAI_API_KEY on the server, or record using a browser that supports Web Speech Recognition.",
        },
      });
    }

    // Safe, non-sensitive audit log (never logs speech text, cookies, JWTs, or API keys)
    const userAuditId = req.userId ? `${req.userId.substring(0, 8)}...` : "authenticated";
    console.log(
      `[Express Backend] Handled POST /api/analysis/voice (user: ${userAuditId}, bytes: ${req.file.size}, provider: ${provider}, transcriptLength: ${transcript.length})`
    );

    // 4. Reuse existing text-analysis engine to analyze transcript emotional content
    const textAnalysis = await aiService.analyzeText(transcript);

    // 5. Extract acoustic signals from client (pitch, energy, tempo, duration)
    const pitch = parseFloat(req.body.pitch) || 120;
    const energy = parseFloat(req.body.energy) || 50;
    const tempo = parseFloat(req.body.tempo) || 90;
    const duration = parseFloat(req.body.duration) || 0;

    const voiceResult = {
      transcript,
      detected_mood: textAnalysis.dominant_mood || "neutral",
      dominant_mood: textAnalysis.dominant_mood || "neutral",
      stress_level: textAnalysis.stress_level || 5,
      mood_score: textAnalysis.mood_score || 5,
      confidence: textAnalysis.confidence || 75,
      summary: textAnalysis.summary,
      observations: textAnalysis.observations,
      recommendations: textAnalysis.recommendations,
      pitch,
      energy,
      tempo,
      duration,
      transcriptionProvider: provider,
      suggest_professional_help: textAnalysis.suggest_professional_help,
      disclaimer: textAnalysis.disclaimer,
    };

    // 6. Save AnalysisRecord to SQLite database
    const analysisRecord = await prisma.analysisRecord.create({
      data: {
        userId: req.userId,
        analysisType: "voice",
        result: JSON.stringify(voiceResult),
        confidence: voiceResult.confidence,
        disclaimer: voiceResult.disclaimer,
      },
    });

    // 7. Save linked MoodEntry with source="voice" (single entry, no duplicates)
    const moodEntry = await prisma.moodEntry.create({
      data: {
        userId: req.userId,
        mood: voiceResult.dominant_mood,
        moodScore: voiceResult.mood_score,
        stressLevel: voiceResult.stress_level,
        source: "voice",
        notes: transcript.substring(0, 500),
        voiceAnalysis: JSON.stringify({
          pitch,
          energy,
          tempo,
          duration,
        }),
      },
    });

    res.setHeader("X-Backend-Service", "EmoSense-Express-Local");

    res.status(201).json({
      success: true,
      message: "Voice emotional analysis completed successfully.",
      analysis: voiceResult,
      record: formatAnalysisRecord(analysisRecord),
      analysisRecordId: analysisRecord.id,
      moodEntry: formatMoodEntry(moodEntry),
      _handledBy: "emosense-local-express",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/analysis/face
 * Analyzes captured face image for visible emotional expressions and muscle tension patterns.
 * Evaluates image via server vision provider (Gemini / OpenAI GPT-4o-mini).
 * Zero persistent image storage: image buffer is processed in RAM and never written to disk or database.
 * Saves an AnalysisRecord (type: "face") and linked MoodEntry (source: "face") atomically.
 */
router.post("/face", requireAuth, handleImageUpload, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: "IMAGE_FILE_REQUIRED",
          message: "Face capture image file is required for facial emotion analysis.",
        },
      });
    }

    // Call server-side vision AI provider
    const visionAnalysis = await aiService.analyzeFaceImage(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );

    const isSuccess = Boolean(
      visionAnalysis &&
        (visionAnalysis.success === true ||
          (typeof visionAnalysis.dominant_emotion === "string" && !visionAnalysis.error))
    );

    // If no vision provider is configured or vision call failed, return honest diagnostic error
    // (Never fabricate results using unrelated text rules)
    if (!isSuccess) {
      const errInfo = visionAnalysis?.error || {
        code: "VISION_UNAVAILABLE",
        category: "missing_api_key",
        status: 422,
        message:
          "Facial expression image analysis is currently unavailable. Please configure GEMINI_API_KEY or OPENAI_API_KEY with vision capabilities on the server.",
      };
      return res.status(errInfo.status || 422).json({
        success: false,
        error: {
          code: errInfo.code || "VISION_UNAVAILABLE",
          category: errInfo.category || "missing_api_key",
          message: errInfo.message,
        },
      });
    }

    // Safe, non-sensitive audit log (never logs image bytes, cookies, JWTs, or API keys)
    const userAuditId = req.userId ? `${req.userId.substring(0, 8)}...` : "authenticated";
    console.log(
      `[Express Backend] Handled POST /api/analysis/face (user: ${userAuditId}, bytes: ${req.file.size}, provider: ${visionAnalysis.visionProvider}, dominantEmotion: ${visionAnalysis.dominant_emotion})`
    );

    const dominantEmotion = visionAnalysis.dominant_emotion || "neutral";
    const confidence = visionAnalysis.confidence || 75;
    const stressLevel = visionAnalysis.stress_level || 5;
    const moodScore = visionAnalysis.mood_score || 5;
    const observations = visionAnalysis.observations || "Facial expressions observed.";
    const recommendations = visionAnalysis.recommendations || [];
    const disclaimer = visionAnalysis.disclaimer || "Non-diagnostic wellness assessment.";
    const visionProvider = visionAnalysis.visionProvider || "unknown";

    const faceResult = {
      dominant_emotion: dominantEmotion,
      detected_mood: dominantEmotion,
      confidence,
      stress_level: stressLevel,
      mood_score: moodScore,
      observations,
      recommendations,
      visionProvider,
      disclaimer,
    };

    // Save AnalysisRecord to SQLite database
    const analysisRecord = await prisma.analysisRecord.create({
      data: {
        userId: req.userId,
        analysisType: "face",
        result: JSON.stringify(faceResult),
        confidence,
        disclaimer,
      },
    });

    // Save linked MoodEntry with source="face" (single entry, no duplicates)
    const moodEntry = await prisma.moodEntry.create({
      data: {
        userId: req.userId,
        mood: dominantEmotion,
        moodScore,
        stressLevel,
        source: "face",
        notes: observations.substring(0, 500),
        faceAnalysis: JSON.stringify({
          dominant_emotion: dominantEmotion,
          confidence,
          stress_level: stressLevel,
          mood_score: moodScore,
          observations,
        }),
      },
    });

    res.setHeader("X-Backend-Service", "EmoSense-Express-Local");

    res.status(201).json({
      success: true,
      message: "Face emotion analysis completed successfully.",
      analysis: faceResult,
      record: formatAnalysisRecord(analysisRecord),
      analysisRecordId: analysisRecord.id,
      moodEntry: formatMoodEntry(moodEntry),
      _handledBy: "emosense-local-express",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analysis
 * Retrieves only the authenticated user's analysis history.
 */
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { limit = 50, type } = req.query;
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

    const where = {
      userId: req.userId, // Strictly scopes to authenticated user
    };

    if (type) {
      where.analysisType = type;
    }

    const records = await prisma.analysisRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: parsedLimit,
    });

    const formatted = records.map(formatAnalysisRecord);

    res.json({
      success: true,
      count: formatted.length,
      records: formatted,
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analysis/:id
 * Retrieves a single analysis record with ownership verification.
 */
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const record = await prisma.analysisRecord.findUnique({
      where: { id: req.params.id },
    });

    if (!record || record.userId !== req.userId) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Analysis record not found.",
        },
      });
    }

    res.json({
      success: true,
      record: formatAnalysisRecord(record),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/analysis/:id
 * Deletes an analysis record with ownership verification.
 */
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const record = await prisma.analysisRecord.findUnique({
      where: { id: req.params.id },
    });

    if (!record || record.userId !== req.userId) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Analysis record not found.",
        },
      });
    }

    await prisma.analysisRecord.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: "Analysis record deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
