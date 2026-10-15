// Chat Assistant and Session Management Routes for EmoSense AI
import express from "express";
import { z } from "zod";
import prisma from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import aiService, {
  CLINICAL_DISCLAIMER,
  CRISIS_RESOURCES,
  detectCrisisIntent,
  GUIDED_ASSESSMENT_TOPICS,
} from "../services/aiService.js";
import memoryService from "../services/memoryService.js";
import { formatMoodEntry } from "./moods.js";

const router = express.Router();

function formatChatSession(session) {
  if (!session) return null;
  const lastMessage = session.messages && session.messages.length > 0
    ? session.messages[session.messages.length - 1]
    : null;
  return {
    id: session.id,
    userId: session.userId,
    title: session.title,
    overallMood: session.overallMood,
    overall_mood: session.overallMood,
    sessionSummary: session.sessionSummary,
    session_summary: session.sessionSummary,
    createdAt: session.createdAt,
    created_date: session.createdAt,
    updatedAt: session.updatedAt,
    preview: session.preview || (lastMessage ? lastMessage.content : session.sessionSummary || "No messages yet"),
    messageCount: session._count ? session._count.messages : (session.messages ? session.messages.length : 0),
    messages: session.messages
      ? session.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          detectedMood: m.detectedMood,
          detectedStress: m.detectedStress,
          createdAt: m.createdAt,
        }))
      : [],
  };
}

const messageSchema = z.object({
  message: z.string().trim().min(1, "Message content is required").max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      })
    )
    .optional()
    .default([]),
  sessionId: z.string().optional().nullable(),
});

const createSessionSchema = z.object({
  title: z.string().trim().max(100).optional(),
});

const completeSessionSchema = z.object({
  messages: z.array(
    z.object({
      role: z.string(),
      content: z.string(),
    })
  ).min(1, "At least one message is required to analyze conversation"),
});

const assessmentStartSchema = z.object({
  title: z.string().trim().max(100).optional(),
});

const assessmentStepSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
  answer: z.string().trim().max(4000).optional().default(""),
  skipped: z.boolean().optional().default(false),
  step: z.number().int().min(1).max(10),
});

const assessmentAnalyzeSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
});

/**
 * POST /api/chat/message
 * Generates an empathetic assistant response and updates message history.
 * Guarantees persistent session creation, message persistence in SQLite, and sessionId reuse.
 */
router.post("/message", requireAuth, async (req, res, next) => {
  try {
    const validated = messageSchema.parse(req.body);
    const { message, history, sessionId } = validated;

    // Safe, non-sensitive audit log (never logs message text, cookies, JWTs, or API keys)
    const userAuditId = req.userId ? `${req.userId.substring(0, 8)}...` : "authenticated";
    console.log(`[Express Backend] Handled POST /api/chat/message (user: ${userAuditId}, msgLength: ${message.length}, sessionId: ${sessionId || "new"})`);

    // Ensure or create persistent session for authenticated user
    let persistentSession = null;
    if (sessionId) {
      const existing = await prisma.chatSession.findUnique({
        where: { id: sessionId },
      });
      if (existing && existing.userId === req.userId) {
        persistentSession = existing;
      }
    }

    if (!persistentSession) {
      const initialTitle = message.length > 36 ? `${message.substring(0, 36).trim()}...` : message.trim();
      persistentSession = await prisma.chatSession.create({
        data: {
          userId: req.userId,
          title: initialTitle || `Chat Session - ${new Date().toLocaleDateString()}`,
        },
      });
    }

    // Duplicate message detection (e.g. rapid double-clicks or re-renders within 2.5s)
    const recentDuplicate = await prisma.chatMessage.findFirst({
      where: {
        sessionId: persistentSession.id,
        role: "user",
        content: message,
      },
      orderBy: { createdAt: "desc" },
    });

    if (recentDuplicate && Date.now() - new Date(recentDuplicate.createdAt).getTime() < 2500) {
      const recentAssistant = await prisma.chatMessage.findFirst({
        where: {
          sessionId: persistentSession.id,
          role: "assistant",
          createdAt: { gte: recentDuplicate.createdAt },
        },
        orderBy: { createdAt: "asc" },
      });

      if (recentAssistant) {
        console.log(`[Express Backend] Duplicate message prevented for session ${persistentSession.id}. Returning cached response.`);
        return res.json({
          success: true,
          sessionId: persistentSession.id,
          messageId: recentAssistant.id,
          userMessageId: recentDuplicate.id,
          reply: recentAssistant.content,
          response: recentAssistant.content,
          detectedMood: recentDuplicate.detectedMood || "neutral",
          detectedStress: recentDuplicate.detectedStress || 3,
          suggestedActions: [],
          _handledBy: "emosense-local-express",
          provider: "google-gemini",
          duplicateAvoided: true,
        });
      }
    }

    // Check if the user is asking to forget/delete saved memories
    const forgetIntent = memoryService.detectForgetIntent(message);
    if (forgetIntent) {
      const forgetResult = await memoryService.handleForgetCommand(
        req.userId,
        forgetIntent.targetTopic || message
      );
      const replyMsg =
        forgetResult.message ||
        (forgetResult.deletedCount > 0
          ? "I've forgotten that for you."
          : "I couldn't find any saved memories matching that request.");

      const savedUserMsg = await prisma.chatMessage.create({
        data: {
          sessionId: persistentSession.id,
          role: "user",
          content: message,
          detectedMood: "neutral",
          detectedStress: 2,
        },
      });

      const savedAssistantMsg = await prisma.chatMessage.create({
        data: {
          sessionId: persistentSession.id,
          role: "assistant",
          content: replyMsg,
        },
      });

      return res.json({
        success: true,
        sessionId: persistentSession.id,
        messageId: savedAssistantMsg.id,
        userMessageId: savedUserMsg.id,
        reply: replyMsg,
        response: replyMsg,
        detectedMood: "calm",
        detectedStress: 2,
        suggestedActions: [],
        _handledBy: "emosense-local-express",
        provider: "emosense-memory-manager",
        fallback: true,
        isCrisis: false,
        recalledMemories: [],
        forgottenCount: forgetResult.deletedCount,
      });
    }

    // 1. Retrieve relevant long-term memories for this user & message
    const relevantMemories = await memoryService.getRelevantMemories(req.userId, message);

    // 2. Generate empathetic, adaptive response with long-term memory context
    const aiResult = await aiService.generateChatReply(message, history, {
      userId: req.userId,
      memories: relevantMemories,
    });
    const activeAi = aiService.getActiveAiProvider();

    // 3. Extract and save candidate memories
    const candidateMemories = memoryService.extractCandidateFacts(message);
    if (candidateMemories.length > 0) {
      try {
        await memoryService.saveCandidateMemories(
          req.userId,
          candidateMemories,
          persistentSession.id
        );
      } catch (err) {
        console.warn("[Chat API] Memory save notice:", err.message);
      }
    }

    // Persist user and assistant messages to database
    const savedUserMsg = await prisma.chatMessage.create({
      data: {
        sessionId: persistentSession.id,
        role: "user",
        content: message,
        detectedMood: aiResult.detectedMood || null,
        detectedStress: aiResult.detectedStress || null,
      },
    });

    const savedAssistantMsg = await prisma.chatMessage.create({
      data: {
        sessionId: persistentSession.id,
        role: "assistant",
        content: aiResult.reply,
      },
    });

    // Update session timestamp and title if generic
    const isDefaultTitle = !persistentSession.title || persistentSession.title.startsWith("Chat Session");
    const updatedTitle = isDefaultTitle
      ? (message.length > 36 ? `${message.substring(0, 36).trim()}...` : message.trim())
      : persistentSession.title;

    await prisma.chatSession.update({
      where: { id: persistentSession.id },
      data: {
        title: updatedTitle,
        updatedAt: new Date(),
      },
    });

    const reportedProvider = aiResult.provider || activeAi.provider;

    // Explicit provenance header proving request reached local Express backend
    res.setHeader("X-Backend-Service", "EmoSense-Express-Local");
    res.setHeader("X-Backend-AI-Provider", reportedProvider);

    res.json({
      success: true,
      sessionId: persistentSession.id,
      messageId: savedAssistantMsg.id,
      userMessageId: savedUserMsg.id,
      reply: aiResult.reply,
      response: aiResult.reply, // Dual compatibility
      detectedMood: aiResult.detectedMood,
      detectedStress: aiResult.detectedStress,
      suggestedActions: aiResult.suggestedActions || [],
      _handledBy: "emosense-local-express",
      provider: reportedProvider,
      model: aiResult.model || null,
      fallback: Boolean(aiResult.fallback),
      isCrisis: Boolean(aiResult.isCrisis),
      crisisResources: aiResult.crisisResources || null,
      error: aiResult.error || null,
      recalledMemories: relevantMemories.map((m) => ({
        id: m.id,
        category: m.category,
        content: m.content,
      })),
    });
  } catch (error) {
    console.error("[Chat API Error] POST /api/chat/message failed:", error);
    next(error);
  }
});

/**
 * POST /api/chat/assessment/start
 * Initializes a structured guided emotional assessment session.
 * Creates the session and records Question 1.
 */
router.post("/assessment/start", requireAuth, async (req, res, next) => {
  try {
    const validated = assessmentStartSchema.parse(req.body || {});
    const defaultTitle = `Emotional Assessment - ${new Date().toLocaleDateString()}`;

    const session = await prisma.chatSession.create({
      data: {
        userId: req.userId,
        title: validated.title || defaultTitle,
      },
    });

    const initialTopic = GUIDED_ASSESSMENT_TOPICS[0];
    const initialQuestion = initialTopic.defaultQuestion;

    const initialMessage = await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        content: initialQuestion,
      },
    });

    const activeAi = aiService.getActiveAiProvider();

    // Provenance headers
    res.setHeader("X-Backend-Service", "EmoSense-Express-Local");
    res.setHeader("X-Backend-AI-Provider", activeAi.provider);

    res.status(201).json({
      success: true,
      sessionId: session.id,
      step: 1,
      totalSteps: 5,
      topic: initialTopic.topicKey,
      topicTitle: initialTopic.title,
      question: initialQuestion,
      readyForAnalysis: false,
      isCrisis: false,
      messages: [
        {
          id: initialMessage.id,
          role: "assistant",
          content: initialQuestion,
          createdAt: initialMessage.createdAt,
        },
      ],
      session: formatChatSession({ ...session, messages: [initialMessage] }),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/chat/assessment/step
 * Advances the guided assessment by recording the user's response,
 * evaluating crisis safety, and returning the next adaptive question or completion flag.
 */
router.post("/assessment/step", requireAuth, async (req, res, next) => {
  try {
    const validated = assessmentStepSchema.parse(req.body);
    const { sessionId, answer, skipped, step } = validated;

    // Verify session exists and belongs to authenticated user
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!session || session.userId !== req.userId) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Assessment session not found.",
        },
      });
    }

    // State machine check: prevent advancing if already completed
    if (session.overallMood && session.sessionSummary) {
      return res.status(400).json({
        success: false,
        error: {
          code: "SESSION_COMPLETED",
          message: "This assessment session has already been completed and analyzed.",
        },
      });
    }

    const recordedContent = skipped ? "[Question skipped by user]" : answer.trim();
    if (!skipped && !recordedContent) {
      return res.status(400).json({
        success: false,
        error: {
          code: "EMPTY_RESPONSE",
          message: "Please provide an answer or click Skip to continue.",
        },
      });
    }

    // Record user message
    const userMessage = await prisma.chatMessage.create({
      data: {
        sessionId,
        role: "user",
        content: recordedContent,
      },
    });

    // Re-fetch all session messages for comprehensive multi-turn context
    const updatedMessages = [...session.messages, userMessage];

    // Check for crisis indicators
    if (!skipped && detectCrisisIntent(recordedContent)) {
      console.warn(`[Express Backend] Crisis intent detected for user ${req.userId.substring(0, 8)}...`);
      const crisisAssistantMessage = await prisma.chatMessage.create({
        data: {
          sessionId,
          role: "assistant",
          content:
            "I hear how much pain you are experiencing right now, and I care deeply about your safety. You don't have to carry this alone. Please consider connecting with a trained, compassionate counselor right now. Support is available 24/7.",
        },
      });

      return res.json({
        success: true,
        sessionId,
        step,
        totalSteps: 5,
        isCrisis: true,
        crisisResources: CRISIS_RESOURCES,
        acknowledgment:
          "I hear how much pain you are experiencing right now, and I care deeply about your safety.",
        question:
          "Please consider connecting with a compassionate counselor right now through 988 or the Crisis Text Line.",
        readyForAnalysis: false,
        messages: [...updatedMessages, crisisAssistantMessage].map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        })),
      });
    }

    // Check if user has completed the final step (5 of 5)
    if (step >= 5) {
      const completionText =
        "Thank you for sharing your reflections throughout this check-in. You've completed all assessment questions. When you're ready, click 'Analyze My Responses' to generate your personalized wellness report.";

      const assistantMessage = await prisma.chatMessage.create({
        data: {
          sessionId,
          role: "assistant",
          content: completionText,
        },
      });

      return res.json({
        success: true,
        sessionId,
        step: 5,
        totalSteps: 5,
        readyForAnalysis: true,
        acknowledgment: "Thank you for reflecting with me.",
        question: null,
        topic: "completion",
        messages: [...updatedMessages, assistantMessage].map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        })),
      });
    }

    // Generate next adaptive question using Gemini (or intelligent fallback)
    const nextStep = step + 1;
    const aiResult = await aiService.generateGuidedAssessmentQuestion(updatedMessages, nextStep, 5);

    const nextQuestionText = aiResult.nextQuestion || GUIDED_ASSESSMENT_TOPICS[nextStep - 1]?.defaultQuestion;

    const assistantMessage = await prisma.chatMessage.create({
      data: {
        sessionId,
        role: "assistant",
        content: nextQuestionText,
      },
    });

    const activeAi = aiService.getActiveAiProvider();
    res.setHeader("X-Backend-Service", "EmoSense-Express-Local");
    res.setHeader("X-Backend-AI-Provider", activeAi.provider);

    res.json({
      success: true,
      sessionId,
      step: nextStep,
      totalSteps: 5,
      readyForAnalysis: aiResult.readyForAnalysis || false,
      acknowledgment: aiResult.acknowledgment,
      question: nextQuestionText,
      topic: aiResult.topic || GUIDED_ASSESSMENT_TOPICS[nextStep - 1]?.topicKey,
      isCrisis: aiResult.isCrisis || false,
      crisisResources: aiResult.crisisResources,
      provider: aiResult.provider || activeAi.provider,
      messages: [...updatedMessages, assistantMessage].map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/chat/assessment/analyze
 * Synthesizes the entire multi-turn transcript using real Gemini model,
 * generates the 10-field structured JSON report, persists AnalysisRecord and MoodEntry,
 * and prevents duplicate submissions.
 */
router.post("/assessment/analyze", requireAuth, async (req, res, next) => {
  try {
    const validated = assessmentAnalyzeSchema.parse(req.body);
    const { sessionId } = validated;

    // Verify session ownership
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!session || session.userId !== req.userId) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Assessment session not found.",
        },
      });
    }

    // Duplicate Submission Protection: if already analyzed, return cached analysis record
    if (session.overallMood && session.sessionSummary) {
      const existingRecord = await prisma.analysisRecord.findFirst({
        where: {
          userId: req.userId,
          analysisType: "chat_assessment",
        },
        orderBy: { createdAt: "desc" },
      });

      if (existingRecord) {
        let parsed = null;
        try {
          parsed = JSON.parse(existingRecord.result);
        } catch {
          // ignore
        }
        if (parsed) {
          console.log(`[Express Backend] Duplicate assessment analysis avoided for session ${sessionId}. Returning existing report.`);
          return res.json({
            success: true,
            sessionId,
            analysis: parsed,
            analysisRecordId: existingRecord.id,
            session: formatChatSession(session),
            duplicateAvoided: true,
            _handledBy: "emosense-local-express",
          });
        }
      }
    }

    // Ensure there is at least one user response to analyze
    const userMessages = session.messages.filter((m) => m.role === "user");
    if (userMessages.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: "NO_USER_RESPONSES",
          message: "At least one question must be answered or reflected upon before analyzing your assessment.",
        },
      });
    }

    // Safe, non-sensitive audit log
    const userAuditId = req.userId ? `${req.userId.substring(0, 8)}...` : "authenticated";
    console.log(`[Express Backend] Handled POST /api/chat/assessment/analyze (user: ${userAuditId}, msgCount: ${session.messages.length})`);

    // Run conversational emotional wellness multi-turn synthesis
    const analysis = await aiService.generateGuidedAssessmentReport(session.messages);

    // Update ChatSession in database
    const updatedSession = await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        overallMood: analysis.overall_mood || analysis.reported_mood,
        sessionSummary: analysis.overall_summary || analysis.summary,
      },
    });

    // Save AnalysisRecord to SQLite database
    const analysisRecord = await prisma.analysisRecord.create({
      data: {
        userId: req.userId,
        analysisType: "chat_assessment",
        result: JSON.stringify(analysis),
        confidence: analysis.confidence || 85,
        disclaimer: analysis.clinical_disclaimer || CLINICAL_DISCLAIMER,
      },
    });

    // Create MoodEntry linked to this assessment
    const stressScore =
      typeof analysis.stress_level === "object" && analysis.stress_level !== null
        ? analysis.stress_level.score
        : analysis.stress_level || 5;

    const moodEntry = await prisma.moodEntry.create({
      data: {
        userId: req.userId,
        mood: analysis.overall_mood || "calm",
        moodScore: analysis.mood_score || 7,
        stressLevel: stressScore,
        source: "chat",
        notes: (analysis.overall_summary || analysis.summary || "").substring(0, 500),
      },
    });

    const activeAi = aiService.getActiveAiProvider();
    res.setHeader("X-Backend-Service", "EmoSense-Express-Local");
    res.setHeader("X-Backend-AI-Provider", activeAi.provider);

    res.json({
      success: true,
      sessionId,
      analysis,
      session: formatChatSession(updatedSession),
      analysisRecordId: analysisRecord.id,
      moodEntry: formatMoodEntry(moodEntry),
      _handledBy: "emosense-local-express",
      provider: analysis.provider || activeAi.provider,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/chat/sessions
 * Initializes a new conversation session for the authenticated user.
 */
router.post("/sessions", requireAuth, async (req, res, next) => {
  try {
    const validated = createSessionSchema.parse(req.body || {});
    const defaultTitle = `Chat Session - ${new Date().toLocaleDateString()}`;

    const session = await prisma.chatSession.create({
      data: {
        userId: req.userId,
        title: validated.title || defaultTitle,
      },
    });

    res.status(201).json({
      success: true,
      session: formatChatSession(session),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/chat/sessions
 * Lists authenticated user's past chat sessions.
 */
router.get("/sessions", requireAuth, async (req, res, next) => {
  try {
    const sessions = await prisma.chatSession.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { messages: true },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const formatted = sessions.map(formatChatSession);

    res.json({
      success: true,
      count: formatted.length,
      sessions: formatted,
      data: formatted,
    });
  } catch (error) {
    console.error("[Chat API Error] GET /api/chat/sessions failed:", error);
    next(error);
  }
});

/**
 * GET /api/chat/sessions/:id
 * Retrieves a single chat session with full message history, verifying ownership.
 */
router.get("/sessions/:id", requireAuth, async (req, res, next) => {
  try {
    const session = await prisma.chatSession.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: { messages: true },
        },
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!session || session.userId !== req.userId) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Chat session not found.",
        },
      });
    }

    res.json({
      success: true,
      session: formatChatSession(session),
    });
  } catch (error) {
    console.error(`[Chat API Error] GET /api/chat/sessions/${req.params.id} failed:`, error);
    next(error);
  }
});

/**
 * POST /api/chat/sessions/:id/complete
 * Completes a session, generates comprehensive emotional analysis,
 * saves an AnalysisRecord, and records a MoodEntry.
 */
router.post("/sessions/:id/complete", requireAuth, async (req, res, next) => {
  try {
    const session = await prisma.chatSession.findUnique({
      where: { id: req.params.id },
    });

    if (!session || session.userId !== req.userId) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Chat session not found.",
        },
      });
    }

    const validated = completeSessionSchema.parse(req.body);
    const { messages } = validated;

    // Run conversational emotional wellness analysis
    const analysis = await aiService.analyzeConversation(messages);

    // Update ChatSession in database
    const updatedSession = await prisma.chatSession.update({
      where: { id: req.params.id },
      data: {
        overallMood: analysis.overall_mood,
        sessionSummary: analysis.summary,
      },
    });

    // Save AnalysisRecord to SQLite database
    const analysisRecord = await prisma.analysisRecord.create({
      data: {
        userId: req.userId,
        analysisType: "text",
        result: JSON.stringify(analysis),
        confidence: analysis.confidence || 80,
        disclaimer: analysis.clinical_disclaimer || analysis.disclaimer || CLINICAL_DISCLAIMER,
      },
    });

    const stressScore =
      typeof analysis.stress_level === "object" && analysis.stress_level !== null
        ? analysis.stress_level.score
        : analysis.stress_level || 5;

    // Create MoodEntry linked to this chat session
    const moodEntry = await prisma.moodEntry.create({
      data: {
        userId: req.userId,
        mood: analysis.overall_mood || "calm",
        moodScore: analysis.mood_score || 7,
        stressLevel: stressScore,
        source: "chat",
        notes: (analysis.overall_summary || analysis.summary || "").substring(0, 500),
      },
    });

    // Safe, non-sensitive audit log
    const userAuditId = req.userId ? `${req.userId.substring(0, 8)}...` : "authenticated";
    console.log(`[Express Backend] Handled POST /api/chat/sessions/${req.params.id}/complete (user: ${userAuditId}, msgCount: ${messages.length})`);

    res.setHeader("X-Backend-Service", "EmoSense-Express-Local");

    res.json({
      success: true,
      message: "Chat session completed and analyzed successfully.",
      analysis,
      session: formatChatSession(updatedSession),
      analysisRecordId: analysisRecord.id,
      moodEntry: formatMoodEntry(moodEntry),
      _handledBy: "emosense-local-express",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/chat/sessions/:id
 * Deletes a chat session and associated messages, verifying ownership.
 */
router.delete("/sessions/:id", requireAuth, async (req, res, next) => {
  try {
    const session = await prisma.chatSession.findUnique({
      where: { id: req.params.id },
    });

    if (!session || session.userId !== req.userId) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Chat session not found.",
        },
      });
    }

    await prisma.chatSession.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: "Chat session deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
