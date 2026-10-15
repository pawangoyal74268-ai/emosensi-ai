// EmoSense AI — Core Text Analysis & AI Assistant Service
// Provides privacy-conscious, non-diagnostic emotional observations and wellness recommendations.
// Supports optional Gemini/OpenAI API keys on the server, with an intelligent built-in
// emotional wellness engine for guaranteed zero-dependency local development and fallback.
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

export const CLINICAL_DISCLAIMER =
  "EmoSense AI provides emotional wellness observations for self-reflection and personal tracking only. It is not a clinical assessment, medical diagnosis, or substitute for professional psychiatric or psychological care. If you are experiencing acute distress or a mental health crisis, please consult a qualified healthcare professional or emergency services.";

// Currently active vision-capable Google Gemini models
export const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
export const GEMINI_CANDIDATE_MODELS = Array.from(
  new Set([DEFAULT_GEMINI_MODEL, "gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-3.1-flash"])
);

/**
 * Safely extracts JSON from model text responses, including markdown fenced code blocks.
 */
export function extractJson(text) {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        // Fall through
      }
    }
  }
  return null;
}

export const CRISIS_RESOURCES = {
  nationalLifeline: "988 (Suicide & Crisis Lifeline - Call or Text 24/7, Free, Confidential)",
  crisisTextLine: "Text HOME to 741741 (Crisis Text Line)",
  trevorProject: "1-866-488-7386 or Text START to 678-678 (The Trevor Project - LGBTQ Youth)",
  international: "Befrienders Worldwide: https://www.befrienders.org | Find A Helpline: https://findahelpline.com",
};

/**
 * Detects immediate expressions of crisis, self-harm, or suicidal intent.
 */
export function detectCrisisIntent(text) {
  if (!text || typeof text !== "string") return false;
  const lower = text.toLowerCase();
  const crisisPatterns = [
    /\b(kill|end)\s+(my\s+self|myself|my\s+life)\b/,
    /\bwant\s+to\s+die\b/,
    /\bsuicid(e|al)\b/,
    /\bharm(ing)?\s+(my\s+self|myself)\b/,
    /\bcutting\s+myself\b/,
    /\bdon'?t\s+want\s+to\s+(live|wake\s+up|be\s+here)\s+anymore\b/,
    /\brather\s+be\s+dead\b/,
    /\bbetter\s+off\s+dead\b/,
  ];
  return crisisPatterns.some((pattern) => pattern.test(lower));
}

/**
 * Standard 5 guided emotional assessment topics and default fallback prompts.
 */
export const GUIDED_ASSESSMENT_TOPICS = [
  {
    step: 1,
    topicKey: "recent_mood",
    title: "Recent Mood & Feelings",
    defaultQuestion:
      "To begin our check-in, how have you been feeling emotionally over the past few days? What words or feelings best capture your mood lately?",
  },
  {
    step: 2,
    topicKey: "stress_sources",
    title: "Stress Intensity & Sources",
    defaultQuestion:
      "Thank you for sharing that with me. On a day-to-day level, what has been creating the most pressure, worry, or emotional weight for you recently?",
  },
  {
    step: 3,
    topicKey: "sleep_and_energy",
    title: "Sleep, Energy & Daily Routine",
    defaultQuestion:
      "How has your sleep and overall physical energy been feeling? Have you noticed any changes in your rest, fatigue, or daily routine?",
  },
  {
    step: 4,
    topicKey: "life_pressures",
    title: "Life, Work & Relationship Pressures",
    defaultQuestion:
      "Looking at your everyday commitments—such as work, studies, home life, or relationships—is there a specific area that feels especially demanding or draining right now?",
  },
  {
    step: 5,
    topicKey: "coping_and_support",
    title: "Coping Strategies & Support",
    defaultQuestion:
      "When things feel heavy or stressful, what usually brings you a sense of comfort or relief? And what kind of care, support, or space would feel most helpful for you right now?",
  },
];

/**
 * Categorizes Google Gemini API failures into distinct sanitized categories:
 * - missing_api_key
 * - invalid_api_key
 * - api_quota_billing
 * - unsupported_model
 * - malformed_request
 * - network_error
 * - service_unavailable
 */
export function categorizeGeminiError(statusCode, errorData, err) {
  if (err && (err.name === "TypeError" || err.code === "ENOTFOUND" || err.code === "ECONNREFUSED" || err.message?.includes("fetch failed"))) {
    return {
      category: "network_error",
      code: "NETWORK_ERROR",
      status: 503,
      message: "Network connection error communicating with Google Gemini API.",
    };
  }

  const status = errorData?.status || "";
  const rawMsg = errorData?.message || err?.message || "";
  const httpCode = statusCode || errorData?.code || 500;

  // 1. Invalid API Key
  if (
    (httpCode === 400 && (status === "INVALID_ARGUMENT" && (rawMsg.includes("API key not valid") || rawMsg.includes("API_KEY_INVALID")))) ||
    (httpCode === 403 && (status === "PERMISSION_DENIED" && (rawMsg.includes("API key not valid") || rawMsg.includes("API_KEY_INVALID") || rawMsg.includes("not enabled"))))
  ) {
    return {
      category: "invalid_api_key",
      code: "INVALID_API_KEY",
      status: 401,
      message: "The configured GEMINI_API_KEY is invalid, revoked, or expired. Please verify your Google AI Studio credentials.",
    };
  }

  // 2. Quota / Billing limit
  if (
    httpCode === 429 ||
    status === "RESOURCE_EXHAUSTED" ||
    rawMsg.toLowerCase().includes("quota") ||
    rawMsg.toLowerCase().includes("rate limit") ||
    rawMsg.toLowerCase().includes("billing")
  ) {
    return {
      category: "api_quota_billing",
      code: "QUOTA_EXCEEDED",
      status: 429,
      message: "Gemini API rate limit or billing quota exceeded. Please check your Google AI Studio plan and usage tier.",
    };
  }

  // 3. Unsupported model
  if (
    httpCode === 404 ||
    status === "NOT_FOUND" ||
    rawMsg.includes("is not found") ||
    rawMsg.includes("no longer available")
  ) {
    return {
      category: "unsupported_model",
      code: "UNSUPPORTED_MODEL",
      status: 422,
      message: `The configured Gemini model is unsupported or sunset: ${rawMsg}`,
    };
  }

  // 4. Malformed request
  if (httpCode === 400 || status === "INVALID_ARGUMENT") {
    return {
      category: "malformed_request",
      code: "MALFORMED_REQUEST",
      status: 400,
      message: `Malformed request to Gemini API: ${rawMsg}`,
    };
  }

  // 5. Temporary high demand (503)
  if (httpCode === 503 || status === "UNAVAILABLE") {
    return {
      category: "service_unavailable",
      code: "PROVIDER_UNAVAILABLE",
      status: 503,
      message: "Google Gemini API is temporarily experiencing high demand. Please retry in a few moments.",
    };
  }

  // Default provider error
  return {
    category: "provider_error",
    code: "PROVIDER_ERROR",
    status: httpCode >= 400 && httpCode < 600 ? httpCode : 502,
    message: `Gemini API error (${status || httpCode}): ${rawMsg}`,
  };
}

// Emotion lexicon keywords with weighted valence and arousal
const EMOTION_LEXICON = {
  happy: {
    keywords: [
      "happy", "joy", "great", "glad", "excited", "wonderful", "delighted", "cheerful",
      "optimistic", "blessed", "grateful", "fantastic", "amazing", "good", "proud",
      "content", "pleased", "smiling", "laughing", "thriving", "positive", "love"
    ],
    stressRange: [1, 3],
    moodScoreRange: [8, 10],
  },
  calm: {
    keywords: [
      "calm", "peace", "peaceful", "relaxed", "serene", "tranquil", "balanced", "centered",
      "grounded", "meditative", "quiet", "steady", "composed", "rested", "soothing",
      "clear", "still", "ease", "comfortable"
    ],
    stressRange: [1, 3],
    moodScoreRange: [7, 9],
  },
  neutral: {
    keywords: [
      "okay", "fine", "neutral", "normal", "average", "alright", "routine", "ordinary",
      "fair", "standard", "moderate", "so-so", "regular"
    ],
    stressRange: [3, 5],
    moodScoreRange: [5, 6],
  },
  anxious: {
    keywords: [
      "anxious", "worry", "worried", "nervous", "fear", "panic", "dread", "uneasy",
      "overwhelmed", "restless", "on edge", "jittery", "scared", "hesitant", "frightened",
      "overthinking", "uncertain", "apprehensive", "paralyzed", "hyperventilating"
    ],
    stressRange: [6, 9],
    moodScoreRange: [3, 5],
  },
  sad: {
    keywords: [
      "sad", "unhappy", "depressed", "down", "gloomy", "heartbroken", "lonely", "hopeless",
      "crying", "miserable", "sorrow", "grief", "empty", "drained", "disappointed",
      "exhausted", "numb", "melancholy", "weeping", "blue"
    ],
    stressRange: [5, 8],
    moodScoreRange: [2, 4],
  },
  stressed: {
    keywords: [
      "stressed", "burnout", "busy", "pressure", "overload", "exhausted", "hectic",
      "frustrated", "swamped", "stretched", "demanding", "deadline", "fatigue",
      "running on empty", "too much", "collapsed", "burnt out", "suffocating"
    ],
    stressRange: [7, 10],
    moodScoreRange: [2, 4],
  },
  angry: {
    keywords: [
      "angry", "mad", "furious", "irritated", "annoyed", "enraged", "pissed", "bitter",
      "resentful", "hostile", "outraged", "agitated", "provoked", "infuriated", "fuming"
    ],
    stressRange: [7, 10],
    moodScoreRange: [1, 3],
  },
};

// Cautious, non-clinical wellness recommendations tailored to detected emotional states
const WELLNESS_RECOMMENDATIONS = {
  happy: [
    "Reflect on what brought you joy today and write down 2-3 highlights in your journal.",
    "Share your positive energy with a friend, family member, or colleague.",
    "Engage in an activity that nurtures your creative side or hobbies.",
  ],
  calm: [
    "Anchor this feeling with a brief 5-minute gratitude or mindful breathing pause.",
    "Maintain this grounded rhythm by setting realistic boundaries for the rest of your day.",
    "Enjoy a mindful walk or quiet moment in natural light.",
  ],
  neutral: [
    "Check in gently with your body: take a glass of water and stretch for 2 minutes.",
    "Ask yourself what small, pleasant thing could brighten your afternoon.",
    "Notice if any underlying tension is present without judgment.",
  ],
  anxious: [
    "Try the 4-7-8 breathing exercise: inhale for 4 seconds, hold for 7, exhale slowly for 8.",
    "Ground yourself using the 5-4-3-2-1 sensory technique (name 5 things you see, 4 you feel, etc.).",
    "Jot down your worries on paper to externalize them, then identify what is within your direct control.",
    "Limit caffeine and consider stepping outside for gentle fresh air.",
  ],
  sad: [
    "Allow yourself to feel without self-criticism; your emotions are valid.",
    "Wrap yourself in comfort: listen to comforting music, take a warm shower, or sip warm tea.",
    "Consider reaching out to a trusted confidant or friend for a gentle connection.",
    "If feelings of persistent sadness endure, consider consulting a supportive counselor.",
  ],
  stressed: [
    "Take an immediate 5-minute micro-break away from screens and work materials.",
    "Break down your current to-do list into a single next physical action, setting other items aside.",
    "Practice progressive muscle relaxation: gently tense and release shoulder and jaw muscles.",
    "Prioritize getting 7-8 hours of sleep tonight and avoid working late into the evening.",
  ],
  angry: [
    "Pause before responding: take 10 slow, deep belly breaths to let the physiological surge settle.",
    "Channel the emotional charge into physical movement like a brisk walk or stretching.",
    "Write an uncensored draft of your thoughts in private, then delete or discard it.",
    "Reframe the situation once the initial adrenaline has moderated.",
  ],
};

/**
 * Analyzes text input to evaluate emotional markers, stress level, and sentiment.
 * Safe and deterministic fallback engine.
 */
function localAnalyzeText(text) {
  const normalized = text.toLowerCase();
  const words = normalized.match(/\b[a-z']+\b/g) || [];

  const scores = {
    happy: 0,
    calm: 0,
    neutral: 0.5, // baseline
    anxious: 0,
    sad: 0,
    stressed: 0,
    angry: 0,
  };

  for (const [mood, data] of Object.entries(EMOTION_LEXICON)) {
    for (const kw of data.keywords) {
      if (normalized.includes(kw)) {
        scores[mood] += 2.0;
      }
    }
  }

  // Count matches
  let dominantMood = "neutral";
  let maxScore = scores.neutral;

  for (const [mood, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      dominantMood = mood;
    }
  }

  // Determine stress level and mood score
  const moodConfig = EMOTION_LEXICON[dominantMood] || EMOTION_LEXICON.neutral;
  const stressLevel = Math.round((moodConfig.stressRange[0] + moodConfig.stressRange[1]) / 2);
  const moodScore = Math.round((moodConfig.moodScoreRange[0] + moodConfig.moodScoreRange[1]) / 2);

  // Confidence calculation
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const rawConfidence = totalScore > 0 ? Math.min(95, Math.round((maxScore / totalScore) * 100) + 20) : 65;
  const confidence = Math.max(50, Math.min(95, rawConfidence));

  // Determine observations
  const observations = [
    `Language patterns indicate an emotional state centered around feeling ${dominantMood}.`,
    stressLevel >= 7
      ? "Elevated tension markers detected in message tone, suggesting current pressure or fatigue."
      : stressLevel <= 3
      ? "Language conveys low physiological arousal and steady emotional regulation."
      : "Tone reflects moderate daily demands with manageable baseline arousal.",
  ];

  if (words.length > 50) {
    observations.push("Reflective, detailed self-expression shows active processing of internal experiences.");
  } else if (words.length < 10) {
    observations.push("Brief, direct expression captures the core immediate feeling.");
  }

  const recommendations = WELLNESS_RECOMMENDATIONS[dominantMood] || WELLNESS_RECOMMENDATIONS.neutral;
  const suggestProfessionalHelp = stressLevel >= 8 || dominantMood === "sad" || dominantMood === "anxious";

  const summary = `Based on your written expression, your dominant emotion appears to be ${dominantMood} with a stress level around ${stressLevel}/10. ${
    stressLevel >= 7
      ? "You may be carrying noticeable pressure today. Gentle self-care and pacing are advised."
      : "Your state appears relatively balanced. Taking intentional restorative pauses will help support your wellness."
  }`;

  return {
    dominant_mood: dominantMood,
    overall_mood: dominantMood,
    stress_level: stressLevel,
    mood_score: moodScore,
    confidence,
    summary,
    observations: observations.join(" "),
    recommendations,
    suggest_professional_help: suggestProfessionalHelp,
    disclaimer: CLINICAL_DISCLAIMER,
  };
}

/**
 * Generates an intelligent, natural conversational response for local fallback.
 * Supports general questions, coding/study/planning tasks, casual chat, and emotional wellness reflections.
 * Returns contextual suggested actions with each response.
 */
/**
 * Generates an intelligent, natural conversational response for local fallback.
 * Follows strict adaptive response length:
 * - Greetings & simple social exchanges: ONE short sentence (e.g. "Hey! 😊 How's your day going?")
 * - Celebrations: short genuine celebration, no lectures
 * - Emotional sharing: brief empathy first, no unsolicited menus
 * - Advice requests: practical guidance with suggestions
 * - Technical & detailed queries: structured answers with code or plans
 * - Memory queries: recalls stored facts or confirms when none are stored
 */
function localGenerateReply(userMessage, history = [], options = {}) {
  const normalized = (userMessage || "").trim().toLowerCase();
  const analysis = localAnalyzeText(userMessage);
  const mood = analysis.dominant_mood;
  const memories = Array.isArray(options.memories) ? options.memories : [];

  // Detect if user explicitly seeks advice, solutions, action plans, or tips
  const seeksAdvice =
    normalized.includes("what should i do") ||
    normalized.includes("how should i") ||
    normalized.includes("what can i do") ||
    normalized.includes("give me advice") ||
    normalized.includes("give me suggestions") ||
    normalized.includes("any suggestions") ||
    normalized.includes("tips for") ||
    normalized.includes("tips to") ||
    normalized.includes("how to cope") ||
    normalized.includes("help me plan") ||
    normalized.includes("recommend a");

  // 1. Memory query: User asking what EmoSense remembers about their projects, goals, or identity
  const isMemoryQuery =
    normalized.includes("what do you remember") ||
    normalized.includes("what do you know about me") ||
    normalized.includes("what is my project") ||
    normalized.includes("what project") ||
    normalized.includes("what am i building") ||
    normalized.includes("what am i working on") ||
    normalized.includes("what am i learning") ||
    normalized.includes("what am i studying") ||
    normalized.includes("what are my goals") ||
    normalized.includes("do you remember") ||
    normalized.includes("tell me about myself") ||
    normalized.includes("my background");

  if (isMemoryQuery) {
    if (memories.length > 0) {
      const projectMem = memories.find(
        (m) =>
          m.category === "project" ||
          m.content.toLowerCase().includes("building") ||
          m.content.toLowerCase().includes("working on")
      );
      const goalMem = memories.find(
        (m) =>
          m.category === "goal" ||
          m.category === "learning" ||
          m.content.toLowerCase().includes("learning") ||
          m.content.toLowerCase().includes("studying")
      );

      const asksProject =
        normalized.includes("project") ||
        normalized.includes("building") ||
        normalized.includes("working on");
      const asksLearning =
        normalized.includes("learning") ||
        normalized.includes("studying") ||
        normalized.includes("goal");

      if (asksProject && asksLearning && projectMem && goalMem) {
        const cleanProj = projectMem.content.replace(/^user is (?:building|working on):?\s*/i, "").trim();
        const cleanGoal = goalMem.content.replace(/^user is (?:learning|studying|preparing for):?\s*/i, "").trim();
        return {
          reply: `You're currently building ${cleanProj}, and you're also learning ${cleanGoal}.`,
          detectedMood: "calm",
          detectedStress: 2,
          suggestedActions: [],
        };
      } else if (asksProject && projectMem) {
        const cleanProj = projectMem.content.replace(/^user is (?:building|working on):?\s*/i, "").trim();
        return {
          reply: `You're currently working on building ${cleanProj}.`,
          detectedMood: "calm",
          detectedStress: 2,
          suggestedActions: [],
        };
      } else if (asksLearning && goalMem) {
        const cleanGoal = goalMem.content.replace(/^user is (?:learning|studying|preparing for):?\s*/i, "").trim();
        return {
          reply: `You're currently learning ${cleanGoal}.`,
          detectedMood: "calm",
          detectedStress: 2,
          suggestedActions: [],
        };
      }

      const memoryLines = memories.map((m) => `• ${m.content}`).join("\n");
      return {
        reply: `Here is what I remember from our previous conversations:\n\n${memoryLines}\n\nYou can ask me to forget any of these details anytime, or manage them in your Settings.`,
        detectedMood: "calm",
        detectedStress: 2,
        suggestedActions: [],
      };
    } else {
      return {
        reply: "I don't have any saved personal memories about that yet. As we chat about your projects, study goals, or preferences, I'll remember the key details to personalize future conversations!",
        detectedMood: "calm",
        detectedStress: 2,
        suggestedActions: [],
      };
    }
  }

  // 2. Greetings & Social Openers: strictly ONE short sentence
  if (normalized === "hi" || normalized === "hey" || normalized === "yo") {
    return {
      reply: "Hey! 😊 How's your day going?",
      detectedMood: "calm",
      detectedStress: 2,
      suggestedActions: [],
    };
  }
  if (normalized === "hello" || normalized.startsWith("hello ")) {
    return {
      reply: "Hello! 😊 How's your day going?",
      detectedMood: "calm",
      detectedStress: 2,
      suggestedActions: [],
    };
  }
  if (normalized.startsWith("good morning")) {
    return {
      reply: "Good morning! 😊 Hope your day is off to a good start.",
      detectedMood: "calm",
      detectedStress: 2,
      suggestedActions: [],
    };
  }
  if (normalized.startsWith("good afternoon")) {
    return {
      reply: "Good afternoon! 😊 Hope your day is going well.",
      detectedMood: "calm",
      detectedStress: 2,
      suggestedActions: [],
    };
  }
  if (normalized.startsWith("good evening")) {
    return {
      reply: "Good evening! 😊 How has your day been treating you?",
      detectedMood: "calm",
      detectedStress: 2,
      suggestedActions: [],
    };
  }

  // 3. Celebrations & Project Completion: short genuine congratulation, no productivity lectures
  if (
    normalized.includes("completed my project") ||
    normalized.includes("finished my project") ||
    normalized.includes("finally completed") ||
    normalized.includes("finally finished")
  ) {
    return {
      reply: "That's awesome! 🎉 You must feel great getting it finished.",
      detectedMood: "happy",
      detectedStress: 2,
      suggestedActions: [],
    };
  }

  // 4. Emotional Sharing: brief empathy first, continuing dialogue naturally
  if (normalized.includes("worried about my exams") || normalized.includes("worried about exams")) {
    return {
      reply: "That sounds stressful. Exams can feel overwhelming, especially when there's a lot to prepare. What's been weighing on you the most?",
      detectedMood: "anxious",
      detectedStress: 7,
      suggestedActions: [],
    };
  }

  // 5. Explicit advice requests about exams
  if (
    normalized.includes("what should i do about my exam stress") ||
    normalized.includes("what should i do about exam stress") ||
    normalized.includes("how to deal with exam stress")
  ) {
    return {
      reply: "Start by focusing on what you can control today: pick one topic to revise in a manageable block, take short breaks, and give yourself space to rest. You don't have to solve everything at once.",
      detectedMood: "anxious",
      detectedStress: 6,
      suggestedActions: [
        "Break revision into smaller blocks",
        "Prioritize your most challenging topics",
        "Schedule short, restorative breaks",
      ],
    };
  }

  // 6. Python loops explanation with code examples
  if (
    normalized.includes("python loops") ||
    normalized.includes("python loop") ||
    (normalized.includes("explain") && normalized.includes("loop") && normalized.includes("python"))
  ) {
    return {
      reply: "In Python, loops let you execute a block of code repeatedly:\n\n### 1. `for` Loop (Iterating over a collection or range):\n```python\n# Iterating over a list\nfruits = [\"apple\", \"banana\", \"cherry\"]\nfor fruit in fruits:\n    print(f\"Enjoy a {fruit}!\")\n\n# Using range(start, stop)\nfor i in range(1, 4):\n    print(f\"Count: {i}\")\n```\n\n### 2. `while` Loop (Repeats while condition is True):\n```python\ncount = 1\nwhile count <= 3:\n    print(f\"Step {count}\")\n    count += 1\n```\n\nUse `for` when iterating over collections or known sequences, and `while` when repeating until an external condition changes.",
      detectedMood: "neutral",
      detectedStress: 2,
      suggestedActions: seeksAdvice ? ["Show break and continue", "Explain list comprehensions"] : [],
    };
  }

  // 7. Detailed 30-day study plan (structured & thorough as requested)
  if (
    normalized.includes("30-day study plan") ||
    normalized.includes("30 day study plan") ||
    (normalized.includes("study plan") && (normalized.includes("detailed") || normalized.includes("thorough")))
  ) {
    return {
      reply: "Here is a structured, balanced 30-day study plan designed for high retention and steady pacing without burnout:\n\n### Week 1: Foundation & Core Concepts (Days 1–7)\n• Focus on core definitions, mental models, and foundational theories.\n• Schedule two 45-minute focused revision blocks per day with a 10-minute break.\n• End each day by writing a 3-bullet summary in your own words.\n\n### Week 2: Deep Dive & Active Practice (Days 8–14)\n• Transition from reading notes to solving targeted practice problems.\n• Pinpoint the 2–3 hardest concepts and tackle them during peak focus hours.\n• Create flashcards or cheat sheets for quick formulas and key terms.\n\n### Week 3: Mock Testing & Gap Remediation (Days 15–21)\n• Take timed practice exams to simulate real test conditions.\n• Maintain an 'error log' for every missed problem and review the underlying principles.\n• Take one full rest day on Day 21 to consolidate your memory.\n\n### Week 4: Synthesis, High-Yield Review & Rest (Days 22–30)\n• Days 22–27: Rapid review of high-yield areas and your error log.\n• Days 28–29: Light, confident review—avoid cramming new or unfamiliar material.\n• Day 30: Rest, hydrate, pack your materials, and get 8 hours of sleep.",
      detectedMood: "calm",
      detectedStress: 4,
      suggestedActions: ["How to set daily study goals", "Tips for staying focused during study blocks"],
    };
  }

  // 8. JavaScript async/await explanation
  if (normalized.includes("async/await") || normalized.includes("async await")) {
    return {
      reply: "In JavaScript, `async/await` lets you write asynchronous Promise-based code that reads sequentially like synchronous code. Functions marked `async` always return a Promise, and `await` pauses execution inside that function until the Promise settles.\n\nExample:\n```javascript\nasync function loadData() {\n  const response = await fetch('/api/data');\n  const data = await response.json();\n  return data;\n}\n```",
      detectedMood: "neutral",
      detectedStress: 2,
      suggestedActions: seeksAdvice
        ? ["Show me error handling with try/catch", "Explain Promise.all", "Give me a practice problem"]
        : [],
    };
  }

  // 9. Identity and capabilities
  if (
    normalized.includes("who are you") ||
    normalized.includes("what can you do") ||
    normalized.includes("how do you work") ||
    normalized.includes("what is emosense")
  ) {
    return {
      reply: "I'm EmoSense AI, your warm, intelligent, and thoughtful conversational companion. I can discuss ordinary topics, answer questions, help with studying, writing, or programming, while also offering empathetic wellness support when you want to reflect.",
      detectedMood: "neutral",
      detectedStress: 2,
      suggestedActions: [],
    };
  }

  // 10. Programming, Code & Technical Questions
  if (
    normalized.includes("code") ||
    normalized.includes("programming") ||
    normalized.includes("function") ||
    normalized.includes("debug") ||
    normalized.includes("api") ||
    normalized.includes("react")
  ) {
    return {
      reply: "I'd be glad to look at that with you. Whether you are debugging, writing a function, or designing an architecture, tell me a bit more about the specific piece you are working on.",
      detectedMood: "neutral",
      detectedStress: 3,
      suggestedActions: seeksAdvice
        ? ["Show me an example", "Explain it more simply", "Give me a practice problem"]
        : [],
    };
  }

  // 11. Breathing & Unwinding
  if (
    normalized.includes("breathing exercise") ||
    normalized.includes("help me breathe") ||
    normalized.includes("de-stress") ||
    normalized.includes("unwind") ||
    normalized.includes("calm down")
  ) {
    return {
      reply: "Let's take a peaceful pause together right now. Inhale slowly through your nose for 4 seconds... hold gently for 4... and exhale completely for 6. Feel your shoulders release downward. How does your body feel after that breath?",
      detectedMood: "calm",
      detectedStress: 3,
      suggestedActions: seeksAdvice
        ? ["Try another breathing round", "Suggest a quick physical stretch"]
        : [],
    };
  }

  // 12. Sleep queries
  if (
    normalized.includes("sleep better") ||
    normalized.includes("trouble sleeping") ||
    normalized.includes("can't sleep") ||
    normalized.includes("insomnia")
  ) {
    return {
      reply: "Sleep has such a profound impact on clarity and physical well-being. Keeping a consistent bedtime, dimming screens 45 minutes prior, and a cool room can make a world of difference. What usually keeps you awake when you struggle to sleep?",
      detectedMood: "stressed",
      detectedStress: 5,
      suggestedActions: seeksAdvice
        ? ["Suggest a wind-down routine", "Tips to quiet racing thoughts"]
        : [],
    };
  }

  // 13. General emotional responses - normal empathetic conversation first
  const contextualReplies = {
    happy: "It sounds like things are moving in a really uplifting direction! Celebrating these moments is so refreshing. What's been the brightest highlight for you?",
    calm: "It's really grounding to hear that. Taking time to appreciate peaceful spaces is wonderful. How has the rest of your day been treating you?",
    neutral: "I'm right here with you. What's on your mind today that you'd like to dive into?",
    anxious: "Thank you for sharing how you feel. Feeling anxious or unsettled is exhausting, but you don't have to carry it all by yourself. What feels like the most pressing part on your mind?",
    sad: "I hear how difficult things feel right now. It's completely okay to not feel okay today. If you feel like talking through it, I'm listening.",
    stressed: "It sounds like you're carrying a substantial amount of pressure right now. What's taking up the most space on your plate today?",
    angry: "It makes complete sense that you're feeling frustrated given what you're dealing with. Take your time, and tell me more about what triggered this.",
  };

  return {
    reply: contextualReplies[mood] || "Thank you for sharing that with me. I'm listening closely—tell me more about what's on your mind.",
    detectedMood: mood,
    detectedStress: analysis.stress_level,
    suggestedActions: seeksAdvice
      ? ["Suggest a small next step", "Help me break this down", "Give me a practical tip"]
      : [],
  };
}

/**
 * Local deterministic adaptive question generator for guided emotional assessments.
 */
function localGenerateAssessmentQuestion(transcript = [], stepIndex = 1, totalSteps = 5) {
  const targetTopic =
    GUIDED_ASSESSMENT_TOPICS[Math.min(Math.max(1, stepIndex) - 1, GUIDED_ASSESSMENT_TOPICS.length - 1)] ||
    GUIDED_ASSESSMENT_TOPICS[0];

  const userMessages = transcript.filter((m) => m && m.role === "user");
  const lastUserMsg = userMessages[userMessages.length - 1]?.content || "";

  let acknowledgment = "Thank you for reflecting on that with me.";
  if (lastUserMsg.toLowerCase().includes("[skip") || lastUserMsg.toLowerCase().includes("skip")) {
    acknowledgment = "No problem at all—we can move forward at whatever pace feels comfortable for you.";
  } else if (lastUserMsg.length > 0) {
    const analysis = localAnalyzeText(lastUserMsg);
    if (analysis.dominant_mood === "anxious" || analysis.dominant_mood === "stressed") {
      acknowledgment = "I hear how much pressure you've been carrying, and I appreciate your openness.";
    } else if (analysis.dominant_mood === "sad") {
      acknowledgment = "Thank you for sharing that vulnerable part of what you're experiencing.";
    } else if (analysis.dominant_mood === "happy" || analysis.dominant_mood === "calm") {
      acknowledgment = "It's wonderful to hear those bright and grounding moments.";
    } else {
      acknowledgment = "Thank you for sharing that thoughtful perspective.";
    }
  }

  return {
    success: true,
    acknowledgment,
    nextQuestion: targetTopic.defaultQuestion,
    topic: targetTopic.topicKey,
    step: stepIndex,
    totalSteps,
    isCrisis: false,
    provider: "local-fallback",
  };
}

/**
 * Local deterministic assessment synthesizer generating all 10 required structured report fields.
 */
function localGenerateAssessmentReport(transcript = []) {
  const userMessages = transcript.filter((m) => m && m.role === "user");
  const fullText = userMessages.map((m) => m.content).join(" ");
  const analysis = localAnalyzeText(fullText || "Self reflection check-in");
  const normalized = fullText.toLowerCase();

  // Extract key stressors
  const keyStressors = [];
  if (normalized.includes("work") || normalized.includes("job") || normalized.includes("boss") || normalized.includes("career")) {
    keyStressors.push("Workplace demands or career expectations");
  }
  if (normalized.includes("study") || normalized.includes("exam") || normalized.includes("college") || normalized.includes("school") || normalized.includes("class")) {
    keyStressors.push("Academic deadlines and educational pressures");
  }
  if (normalized.includes("relationship") || normalized.includes("partner") || normalized.includes("friend") || normalized.includes("family")) {
    keyStressors.push("Interpersonal relationships or communication dynamics");
  }
  if (normalized.includes("money") || normalized.includes("finan") || normalized.includes("rent") || normalized.includes("debt")) {
    keyStressors.push("Financial or material concerns");
  }
  if (normalized.includes("health") || normalized.includes("sick") || normalized.includes("pain")) {
    keyStressors.push("Physical well-being or health concerns");
  }
  if (keyStressors.length === 0) {
    keyStressors.push(analysis.stress_level > 5 ? "General life pressures and daily obligations" : "No acute external stressors explicitly highlighted");
  }

  // Sleep and energy
  let sleepAndEnergy = "not discussed";
  if (normalized.includes("sleep") || normalized.includes("tired") || normalized.includes("exhaust") || normalized.includes("insomnia") || normalized.includes("energy")) {
    if (normalized.includes("tired") || normalized.includes("exhaust") || normalized.includes("poor") || normalized.includes("trouble sleeping") || normalized.includes("insomnia")) {
      sleepAndEnergy = "Reported fatigue or disrupted rest, indicating that stress may be impacting daily physical restoration.";
    } else {
      sleepAndEnergy = "Discussed sleep or daily energy levels as relatively stable or manageable.";
    }
  }

  // Coping strengths
  const copingStrengths = [];
  if (normalized.includes("walk") || normalized.includes("run") || normalized.includes("gym") || normalized.includes("exercise")) {
    copingStrengths.push("Physical movement and exercise");
  }
  if (normalized.includes("music") || normalized.includes("read") || normalized.includes("art") || normalized.includes("journal")) {
    copingStrengths.push("Creative expression and personal hobbies");
  }
  if (normalized.includes("friend") || normalized.includes("talk") || normalized.includes("family") || normalized.includes("partner")) {
    copingStrengths.push("Connecting with trusted social support");
  }
  if (normalized.includes("breath") || normalized.includes("meditat") || normalized.includes("relax")) {
    copingStrengths.push("Mindful breathing and intentional grounding");
  }
  if (copingStrengths.length === 0) {
    copingStrengths.push("Willingness to take intentional time for personal reflection");
  }

  // Qualitative stress level
  let stressRating = "mild";
  if (analysis.stress_level >= 8) stressRating = "high";
  else if (analysis.stress_level >= 6) stressRating = "elevated";
  else if (analysis.stress_level >= 4) stressRating = "moderate";
  else stressRating = "low";

  const stressExplanation = `Qualitative estimation (${stressRating}) based on self-reported feelings of ${analysis.dominant_mood} and referenced life demands.`;

  return {
    overall_summary: `During this check-in, you reflected on your emotional state, noting predominant feelings of ${analysis.dominant_mood}. While certain day-to-day demands were identified, you demonstrated thoughtful self-awareness by taking time to assess your well-being.`,
    reported_mood: analysis.dominant_mood,
    stress_level: {
      rating: stressRating,
      score: analysis.stress_level,
      explanation: stressExplanation,
    },
    key_stressors: keyStressors,
    sleep_and_energy: sleepAndEnergy,
    coping_strengths: copingStrengths,
    patterns_and_uncertainties: "You articulated clear awareness of current pressures; however, whether these feelings represent transient situational stress or longer-term patterns remains uncertain from a single self-reflection session.",
    personalized_next_steps: analysis.recommendations.slice(0, 3),
    follow_up_question: "Looking ahead over the next 24 to 48 hours, what is one kind, unpressured gesture you can offer yourself?",
    clinical_disclaimer: CLINICAL_DISCLAIMER,
    disclaimer: CLINICAL_DISCLAIMER,
    // Dual compatibility
    overall_mood: analysis.dominant_mood,
    mood_score: analysis.mood_score,
    summary: `Reflective check-in highlighting feelings of ${analysis.dominant_mood} and stress level of ${analysis.stress_level}/10.`,
    recommendations: analysis.recommendations,
    observations: "Consistent self-reflection session.",
    confidence: analysis.confidence,
    provider: "local-fallback",
  };
}

/**
 * Main Service API for Stage 4A Text Analysis
 */
export const aiService = {
  /**
   * Identifies the active server-side AI provider and operational mode.
   */
  getActiveAiProvider() {
    if (process.env.GEMINI_API_KEY) {
      return {
        provider: "google-gemini",
        model: DEFAULT_GEMINI_MODEL,
        configured: true,
        mode: "server-side-api",
      };
    }
    if (process.env.OPENAI_API_KEY) {
      return {
        provider: "openai",
        model: "gpt-4o-mini",
        configured: true,
        mode: "server-side-api",
      };
    }
    return {
      provider: "emosense-core-wellness-engine",
      model: "rule-lexicon-v1",
      configured: true,
      mode: "offline-deterministic-fallback",
      description: "Zero-dependency privacy-focused local emotional wellness engine",
    };
  },

  /**
   * Analyzes freeform text or journal entries.
   * Never logs raw user text to server console.
   */
  async analyzeText(text) {
    if (!text || typeof text !== "string") {
      throw new Error("Text content is required for emotional analysis");
    }

    // Safe, non-invasive log (does NOT log private user text)
    console.log(`[AI Assistant] Analyzing text entry (length: ${text.length} chars)`);

    // Check for Gemini API key if present on server
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `You are EmoSense AI, an empathetic emotional wellness assistant. Analyze the emotional tone of this text for personal self-reflection.
Return a clean JSON object with:
- dominant_mood: one of ["happy", "calm", "neutral", "anxious", "sad", "stressed", "angry"]
- stress_level: number from 1 to 10
- mood_score: number from 1 to 10
- confidence: number percentage from 50 to 95
- summary: 2-3 sentences non-clinical emotional reflection
- observations: 2-3 sentences identifying emotional themes and self-awareness
- recommendations: array of 3 actionable, cautious, non-clinical wellness suggestions
- suggest_professional_help: boolean (true if severe distress detected)

Input text: "${text.substring(0, 4000)}"`,
                    },
                  ],
                },
              ],
              generationConfig: {
                responseMimeType: "application/json",
              },
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawJson) {
            const parsed = JSON.parse(rawJson);
            return {
              ...parsed,
              disclaimer: CLINICAL_DISCLAIMER,
            };
          }
        }
      } catch (err) {
        console.warn("[AI Assistant] External provider unavailable. Falling back to local engine:", err.message);
      }
    }

    // Default: reliable, deterministic, non-diagnostic wellness engine
    return localAnalyzeText(text);
  },

  /**
   * Generates empathetic, conversational chat response using real Google Gemini models.
   * Understands multi-turn conversation context, supports casual chat, general questions, and emotional wellness,
   * detects crisis intent, iterates candidate models on transient failures, and honestly reports provider provenance.
   */
  async generateChatReply(message, history = [], options = {}) {
    if (!message || typeof message !== "string") {
      throw new Error("Message content is required");
    }

    const trimmedMsg = message.trim();
    if (!trimmedMsg) {
      throw new Error("Message content cannot be empty");
    }

    // 1. Safety & Crisis check
    const isCrisis = detectCrisisIntent(trimmedMsg);
    if (isCrisis) {
      console.warn("[AI Assistant] Immediate crisis intent indicator detected in chat message. Prioritizing human support.");
      return {
        success: true,
        reply:
          "I hear how much pain you are experiencing right now, and I care deeply about your safety. You don't have to carry this alone. Please connect with a compassionate, trained counselor right now—free, confidential help is available 24/7:\n\n• **988 Suicide & Crisis Lifeline**: Call or text 988\n• **Crisis Text Line**: Text HOME to 741741\n• **The Trevor Project (LGBTQ youth)**: 1-866-488-7386\n\nPlease reach out to them or a trusted loved one right now.",
        detectedMood: "distressed",
        detectedStress: 10,
        suggestedActions: [
          "Call or text 988 Lifeline",
          "Text HOME to 741741",
          "Connect with a trusted friend",
        ],
        provider: "safety-interceptor",
        isCrisis: true,
        crisisResources: CRISIS_RESOURCES,
      };
    }

    const memories = Array.isArray(options.memories) ? options.memories : [];

    // Safe non-sensitive diagnostic log: length, turns count, and memory injection status (never logs private text)
    console.log(
      `[AI Assistant] Generating conversational reply (msgLength: ${trimmedMsg.length}, historyTurns: ${history.length}, memoriesInjected: ${memories.length}, memoryContextAdded: ${memories.length > 0})`
    );

    const geminiKey = process.env.GEMINI_API_KEY;
    let lastError = null;

    if (geminiKey) {
      // Build natural multi-turn context (up to last 12 messages)
      const recentHistory = history
        .slice(-12)
        .filter((m) => m && m.content)
        .map((m) => `${m.role === "user" ? "User" : "EmoSense"}: ${m.content}`)
        .join("\n\n");

      const memoryBlock = memories.length > 0
        ? `Relevant Long-Term Memories (from previous sessions with this user):\n${memories.map((m) => `• [${m.category || "fact"}] ${m.content}`).join("\n")}\n(Note: Personalize naturally using these memories. When the user asks about their project, what they are building, or what they are learning, answer directly from these memories.)\n\n`
        : "";

      const prompt = `You are EmoSense AI, a warm, intelligent, thoughtful conversational companion. You can help with general questions and everyday tasks while also offering empathetic emotional-wellness support when appropriate. Listen carefully, understand context, speak naturally, and adapt your response length and tone to what the user actually says.

${memoryBlock}Conversational Behavior & Adaptive Response Length Rules:
1. Long-Term Memory Usage (Critical):
   - When the user asks what project they are building or working on, what they are learning or studying, or what you remember about them, directly and accurately answer using the Relevant Long-Term Memories provided above.
   - For general conversations, use these memories to subtly personalize your tone and context without mechanically reciting them unless asked.
   - Never claim to remember facts that are not present in the provided memories or recent conversation history.

2. Adaptive Response Length (STRICT):
   - Greetings and simple social exchanges (e.g. "Hi", "Hey", "Good morning"): respond with exactly ONE short sentence (e.g. "Hey! 😊 How's your day going?" or "Good morning! 😊 Hope your day is off to a good start."). NEVER introduce EmoSense or write a paragraph.
   - Celebrations & accomplishments (e.g. "I finally completed my project!"): respond with a short genuine congratulation (e.g. "That's awesome! 🎉 You must feel great getting it finished."). Do not lecture on productivity.
   - Emotional sharing without advice request (e.g. "I am worried about my exams"): respond with brief, warm empathy first, then continue naturally. Do NOT immediately dump advice, study schedules, or breathing exercises.
   - Explicit advice requests (e.g. "What should I do about my exam stress?"): provide a concise but useful response with a few practical, concrete steps.
   - Technical / programming explanations (e.g. "Explain Python loops with examples"): provide a structured explanation with clear code examples.
   - Detailed plans and explicit requests for depth (e.g. "Create a detailed 30-day study plan"): provide a thorough, organized plan.
   - Simple factual questions: direct answer first, typically a few sentences or less.
   - Follow the user's requested length whenever they specify one.
   - Avoid generic introductions, repetitive summaries, and unnecessary conclusions.
   - Do NOT force a follow-up question at the end of every answer.

3. Contextual Suggestion Chips (suggestedActions):
   - For greetings, celebrations, casual chatter, simple factual answers, and unprompted emotional sharing: return an EMPTY array: "suggestedActions": [].
   - ONLY when the user explicitly asks for advice, solutions, a plan, or next steps: provide 2 to 3 concise, actionable suggestions.

Recent Conversation History:
${recentHistory ? recentHistory : "(Starting a new conversation)"}

User message: "${trimmedMsg}"

Return a valid JSON object matching this schema:
{
  "reply": "Your natural, context-aware, well-proportioned response",
  "detectedMood": "happy | calm | neutral | anxious | sad | stressed | angry",
  "detectedStress": 1-10,
  "suggestedActions": [] // Empty array by default, or 2-3 short suggestions ONLY if user explicitly sought advice/action
}`;

      for (const model of GEMINI_CANDIDATE_MODELS) {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  responseMimeType: "application/json",
                  temperature: 0.7,
                },
              }),
            }
          );

          if (response.ok) {
            const data = await response.json();
            const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
            const parsed = extractJson(rawJson);
            if (parsed && typeof parsed.reply === "string" && parsed.reply.trim().length > 0) {
              const detectedMood =
                typeof parsed.detectedMood === "string"
                  ? parsed.detectedMood.toLowerCase().trim()
                  : "calm";
              const detectedStress = Math.min(10, Math.max(1, parseInt(parsed.detectedStress) || 5));
              const suggestedActions = Array.isArray(parsed.suggestedActions)
                ? parsed.suggestedActions
                    .filter((s) => typeof s === "string" && s.trim().length > 0)
                    .slice(0, 4)
                : [];

              return {
                success: true,
                reply: parsed.reply.trim(),
                detectedMood,
                detectedStress,
                suggestedActions,
                provider: "google-gemini",
                model,
                fallback: false,
                isCrisis: false,
              };
            }
          }

          let errorData = null;
          try {
            errorData = (await response.json())?.error;
          } catch {
            errorData = { message: await response.text() };
          }
          lastError = categorizeGeminiError(response.status, errorData, null);

          // If the model had a transient 503, 404, or 429, try the next candidate model
          if (response.status !== 503 && response.status !== 404 && response.status !== 429) {
            break;
          }
        } catch (err) {
          lastError = categorizeGeminiError(null, null, err);
          console.warn(`[AI Assistant] Gemini chat reply error (${model}):`, err.message);
          break;
        }
      }
    } else {
      lastError = {
        category: "missing_api_key",
        code: "MISSING_API_KEY",
        status: 422,
        message: "GEMINI_API_KEY is not configured on the server.",
      };
    }

    // Honest fallback indication: clearly mark as local engine, with error details
    console.warn(`[AI Assistant] Using local fallback engine for chat reply: ${lastError?.message || "provider unavailable"}`);
    const localResult = localGenerateReply(trimmedMsg, history, options);

    return {
      success: true,
      reply: localResult.reply,
      detectedMood: localResult.detectedMood,
      detectedStress: localResult.detectedStress,
      suggestedActions: localResult.suggestedActions || [],
      provider: "emosense-core-wellness-engine",
      fallback: true,
      error: lastError,
      isCrisis: false,
    };
  },

  /**
   * Generates an adaptive, empathetic assessment question based on the multi-turn transcript.
   * If crisis is detected, immediately returns supportive resources.
   */
  async generateGuidedAssessmentQuestion(transcript = [], stepIndex = 1, totalSteps = 5) {
    const targetTopic =
      GUIDED_ASSESSMENT_TOPICS[Math.min(Math.max(1, stepIndex) - 1, GUIDED_ASSESSMENT_TOPICS.length - 1)] ||
      GUIDED_ASSESSMENT_TOPICS[0];

    const userMessages = transcript.filter((m) => m && m.role === "user");
    const lastUserMsg = userMessages[userMessages.length - 1]?.content || "";

    // 1. Safety & Crisis check
    if (detectCrisisIntent(lastUserMsg)) {
      console.warn("[AI Assistant] Immediate crisis intent indicator detected during assessment. Prioritizing human support.");
      return {
        success: true,
        isCrisis: true,
        acknowledgment:
          "I hear how much pain you are experiencing right now, and I care deeply about your safety. You don't have to carry this alone.",
        nextQuestion:
          "Please consider connecting with a compassionate, trained counselor right now. Would you like to reach out to one of these free, 24/7 crisis lifelines?",
        topic: "crisis_intervention",
        step: stepIndex,
        totalSteps,
        crisisResources: CRISIS_RESOURCES,
        readyForAnalysis: false,
        provider: "safety-interceptor",
      };
    }

    // 2. Completion check
    if (stepIndex > totalSteps) {
      return {
        success: true,
        isCrisis: false,
        acknowledgment: "Thank you for taking the time to share your thoughts throughout this assessment.",
        nextQuestion: null,
        topic: "complete",
        step: stepIndex,
        totalSteps,
        readyForAnalysis: true,
        provider: "state-machine",
      };
    }

    // Safe non-sensitive audit log
    console.log(`[AI Assistant] Generating assessment Q (step: ${stepIndex}/${totalSteps}, topic: ${targetTopic.topicKey}, historyMsgs: ${transcript.length})`);

    // 3. Gemini Provider call
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      const historyText = transcript
        .filter((m) => m && m.content)
        .map((m) => `${m.role === "user" ? "User" : "EmoSense Guide"}: ${m.content}`)
        .join("\n\n");

      const prompt = `You are EmoSense AI, a compassionate, supportive wellness guide conducting a structured, non-diagnostic emotional self-reflection check-in.
The assessment has ${totalSteps} total questions. The user is currently at Step ${stepIndex} of ${totalSteps}.
The target topic for this step is: "${targetTopic.title}".

Complete conversation transcript so far:
${historyText || "(User is starting Question 1)"}

Instructions:
1. Empathetically acknowledge what the user said in their most recent response with warmth, specificity, and validation (1 short, natural sentence under 25 words). If the user skipped or was brief, acknowledge with gentle acceptance without any guilt or pressure. If starting step 1, provide a welcoming greeting.
2. Formulate exactly ONE clear, thoughtful, open-ended question tailored to explore the target topic: "${targetTopic.title}".
3. Adapt your question to what the user already stated earlier. Do NOT repeat questions already asked or answered.
4. Keep the tone empathetic, natural, non-judgmental, and non-clinical. Do NOT diagnose, label disorders, or claim clinical authority.
5. Do NOT ask for trauma details or invasive private disclosures.

Return a clean JSON object with:
{
  "acknowledgment": "Empathetic acknowledgment of user's last answer",
  "nextQuestion": "Single thoughtful, adaptive follow-up question for ${targetTopic.title}",
  "topic": "${targetTopic.topicKey}"
}`;

      for (const model of GEMINI_CANDIDATE_MODELS) {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  responseMimeType: "application/json",
                  temperature: 0.7,
                },
              }),
            }
          );

          if (response.ok) {
            const data = await response.json();
            const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
            const parsed = extractJson(rawJson);
            if (parsed && typeof parsed.nextQuestion === "string" && parsed.nextQuestion.trim().length > 0) {
              return {
                success: true,
                acknowledgment: parsed.acknowledgment || "Thank you for sharing that with me.",
                nextQuestion: parsed.nextQuestion.trim(),
                topic: targetTopic.topicKey,
                step: stepIndex,
                totalSteps,
                isCrisis: false,
                provider: "gemini",
                model,
              };
            }
          } else if (response.status !== 503) {
            break;
          }
        } catch (err) {
          console.warn(`[AI Assistant] Gemini assessment Q generation attempt error (${model}):`, err.message);
          break;
        }
      }
    }

    // 4. Fallback to local deterministic question generator
    return localGenerateAssessmentQuestion(transcript, stepIndex, totalSteps);
  },

  /**
   * Synthesizes the entire multi-turn assessment conversation using Gemini into a rich, structured wellness report.
   * Considers all answers together, noting nuances, contradictions, or trends without diagnosing.
   */
  async generateGuidedAssessmentReport(transcript = []) {
    const userMessages = transcript.filter((m) => m && m.role === "user");
    if (userMessages.length === 0) {
      throw new Error("At least one user response is required to generate an assessment report.");
    }

    // Check if any crisis intent was expressed across the session
    const hasCrisis = userMessages.some((m) => detectCrisisIntent(m.content));

    // Safe non-sensitive audit log
    console.log(`[AI Assistant] Generating full assessment report (totalMessages: ${transcript.length}, userMessages: ${userMessages.length}, hasCrisis: ${hasCrisis})`);

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      const transcriptText = transcript
        .filter((m) => m && m.content)
        .map((m) => `${m.role === "user" ? "User" : "EmoSense Assistant"}: ${m.content}`)
        .join("\n\n");

      const prompt = `You are EmoSense AI, an empathetic wellness synthesizer.
Analyze the complete multi-turn emotional assessment transcript below to produce a comprehensive, structured wellness report.

Assessment Transcript:
${transcriptText}

Requirements:
1. Synthesize all answers together across the entire conversation, taking into account shifts, nuances, or contradictions.
2. Do NOT invent missing information. If sleep, work pressures, or coping strategies were not discussed or skipped, return "not discussed" or "none explicitly identified".
3. Do NOT diagnose depression, anxiety, bipolar, or any clinical disorder. Never claim medical or psychiatric certainty.
4. Express appropriate uncertainty in observations: clearly communicate that conversational self-reports are subjective impressions for personal reflection.
5. Provide 2-4 practical, manageable, compassionate wellness next steps.

Return a clean JSON object with EXACTLY these fields:
{
  "overall_summary": "Concise 2-3 sentence overview of the user's self-reported feelings and experiences throughout the assessment.",
  "reported_mood": "Specific emotional words or feelings explicitly reported by the user (or 'not discussed').",
  "stress_level": {
    "rating": "low | mild | moderate | elevated | high",
    "score": 1-10,
    "explanation": "Cautious qualitative explanation based solely on what the user shared."
  },
  "key_stressors": ["Array of explicitly mentioned stressors or life pressures"],
  "sleep_and_energy": "Observations regarding sleep, rest, or physical energy if discussed, or 'not discussed'",
  "coping_strengths": ["Array of personal coping mechanisms, routines, or support systems identified by user"],
  "patterns_and_uncertainties": "Themes and connections noticed across answers, with uncertainty clearly and cautiously stated.",
  "personalized_next_steps": [
    "2 to 4 manageable, practical, compassionate non-clinical suggestions"
  ],
  "follow_up_question": "A gentle open-ended reflective question for continued personal thought.",
  "clinical_disclaimer": "EmoSense AI provides emotional wellness observations for self-reflection and personal tracking only. It is not a clinical assessment, medical diagnosis, or substitute for professional psychiatric or psychological care."
}`;

      for (const model of GEMINI_CANDIDATE_MODELS) {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  responseMimeType: "application/json",
                  temperature: 0.5,
                },
              }),
            }
          );

          if (response.ok) {
            const data = await response.json();
            const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
            const parsed = extractJson(rawJson);

            if (parsed && typeof parsed.overall_summary === "string") {
              const stressLevelObj =
                typeof parsed.stress_level === "object" && parsed.stress_level !== null
                  ? {
                      rating: parsed.stress_level.rating || "moderate",
                      score: Math.min(10, Math.max(1, parseInt(parsed.stress_level.score) || 5)),
                      explanation:
                        parsed.stress_level.explanation || "Qualitative estimate derived from conversation.",
                    }
                  : {
                      rating: "moderate",
                      score: 5,
                      explanation: "Estimated from conversational context.",
                    };

              const validReport = {
                overall_summary: parsed.overall_summary.trim(),
                reported_mood: parsed.reported_mood || "Reflective",
                stress_level: stressLevelObj,
                key_stressors: Array.isArray(parsed.key_stressors) && parsed.key_stressors.length > 0
                  ? parsed.key_stressors
                  : ["None explicitly identified"],
                sleep_and_energy: parsed.sleep_and_energy || "not discussed",
                coping_strengths: Array.isArray(parsed.coping_strengths) && parsed.coping_strengths.length > 0
                  ? parsed.coping_strengths
                  : ["Willingness to take intentional time for personal reflection"],
                patterns_and_uncertainties:
                  parsed.patterns_and_uncertainties ||
                  "Observations reflect this specific conversation; broader patterns may vary across different times.",
                personalized_next_steps:
                  Array.isArray(parsed.personalized_next_steps) && parsed.personalized_next_steps.length >= 2
                    ? parsed.personalized_next_steps
                    : [
                        "Dedicate a 10-minute quiet pause today without screens.",
                        "Notice any physical tension in your shoulders or breath and gently release it.",
                      ],
                follow_up_question:
                  parsed.follow_up_question ||
                  "What is one supportive thing you can do for yourself over the next 24 hours?",
                clinical_disclaimer: CLINICAL_DISCLAIMER,
                disclaimer: CLINICAL_DISCLAIMER,
                isCrisis: hasCrisis,
                crisisResources: hasCrisis ? CRISIS_RESOURCES : undefined,
                provider: "gemini",
                model,
                // Dual backwards-compatibility fields for legacy callers:
                overall_mood: (parsed.reported_mood || "calm").toLowerCase().includes("anxious")
                  ? "anxious"
                  : (parsed.reported_mood || "calm").toLowerCase().includes("stress")
                  ? "stressed"
                  : (parsed.reported_mood || "calm").toLowerCase().includes("sad")
                  ? "sad"
                  : (parsed.reported_mood || "calm").toLowerCase().includes("happy")
                  ? "happy"
                  : "calm",
                mood_score: Math.max(1, 11 - stressLevelObj.score),
                summary: parsed.overall_summary.trim(),
                recommendations: parsed.personalized_next_steps,
                observations: parsed.patterns_and_uncertainties,
                confidence: 85,
              };

              return validReport;
            }
          } else if (response.status !== 503) {
            break;
          }
        } catch (err) {
          console.warn(`[AI Assistant] Gemini assessment report attempt error (${model}):`, err.message);
          break;
        }
      }
    }

    // Fallback to local report synthesizer
    const localReport = localGenerateAssessmentReport(transcript);
    if (hasCrisis) {
      localReport.isCrisis = true;
      localReport.crisisResources = CRISIS_RESOURCES;
    }
    return localReport;
  },

  /**
   * Analyzes an entire conversation session to generate a structured summary,
   * overall mood, stress rating, recommendations, and disclaimer.
   * Leverages generateGuidedAssessmentReport with dual-compatibility output.
   */
  async analyzeConversation(messages = []) {
    return this.generateGuidedAssessmentReport(messages);
  },

  /**
   * Transcribes audio using configured server-side AI provider (Whisper or Gemini).
   * Returns { transcript, provider } or null if no server-side transcription service is configured.
   */
  async transcribeAudio(audioBuffer, mimeType = "audio/webm", filename = "recording.webm") {
    if (!audioBuffer || !Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
      throw new Error("Valid audio buffer is required for transcription");
    }

    // 1. OpenAI Whisper transcription
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log(`[AI Assistant] Transcribing audio via OpenAI Whisper (size: ${audioBuffer.length} bytes)`);
        const formData = new FormData();
        const blob = new Blob([audioBuffer], { type: mimeType });
        formData.append("file", blob, filename);
        formData.append("model", "whisper-1");

        const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          if (data && typeof data.text === "string") {
            return {
              transcript: data.text.trim(),
              provider: "openai-whisper",
            };
          }
        } else {
          const errText = await response.text();
          console.warn("[AI Assistant] OpenAI Whisper response error:", response.status, errText);
        }
      } catch (err) {
        console.warn("[AI Assistant] OpenAI Whisper failure:", err.message);
      }
    }

    // 2. Google Gemini 1.5 Flash Audio transcription
    if (process.env.GEMINI_API_KEY) {
      try {
        console.log(`[AI Assistant] Transcribing audio via Google Gemini 1.5 Flash (size: ${audioBuffer.length} bytes)`);
        const cleanMime = (mimeType || "audio/webm").split(";")[0].trim();
        const prompt = "Please transcribe all spoken words in this audio recording accurately. Return a JSON object with: { \"transcript\": \"exact spoken text\" }";

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      inlineData: {
                        mimeType: cleanMime,
                        data: audioBuffer.toString("base64"),
                      },
                    },
                    { text: prompt },
                  ],
                },
              ],
              generationConfig: { responseMimeType: "application/json" },
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawJson) {
            const parsed = JSON.parse(rawJson);
            if (parsed && typeof parsed.transcript === "string") {
              return {
                transcript: parsed.transcript.trim(),
                provider: "google-gemini",
              };
            }
          }
        } else {
          const errText = await response.text();
          console.warn("[AI Assistant] Gemini audio response error:", response.status, errText);
        }
      } catch (err) {
        console.warn("[AI Assistant] Gemini audio failure:", err.message);
      }
    }

    // No server-side audio transcription provider configured
    return null;
  },

  /**
   * Analyzes visible facial expressions in a captured image using a vision-capable server AI provider.
   * Supports Google Gemini (gemini-3.5-flash) and OpenAI Vision (GPT-4o-mini).
   * Distinguishes failure cases: missing API key, invalid API key, quota/billing, unsupported model, malformed request, network error.
   * Returns non-clinical, cautious observations and emotion metrics.
   * Zero persistent image storage: image buffer is processed in RAM and never written to disk or database.
   */
  async analyzeFaceImage(imageBuffer, mimeType = "image/jpeg", filename = "face-capture.jpg") {
    if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
      throw new Error("Valid image buffer is required for facial analysis");
    }

    const cleanMime = (mimeType || "image/jpeg").toLowerCase().split(";")[0].trim();
    const prompt = `You are a supportive, cautious wellness assistant analyzing visible facial expressions in a captured image for personal reflection.
IMPORTANT SAFETY GUIDELINES:
- Provide non-diagnostic observations about visible facial expressions only (e.g. brow tension, smile, eye tension, jaw position).
- Do NOT make clinical psychiatric diagnoses or definitive claims about internal mental states.
- Be supportive, cautious, and empathetic.
Return a valid JSON object matching:
{
  "dominant_emotion": "happy" | "calm" | "neutral" | "anxious" | "sad" | "stressed" | "angry",
  "confidence": number (0-100),
  "stress_level": number (1-10),
  "mood_score": number (1-10),
  "observations": "detailed supportive observations about visible facial cues detected",
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]
}`;

    // 1. Google Gemini Vision
    if (process.env.GEMINI_API_KEY) {
      let lastError = null;

      for (const model of GEMINI_CANDIDATE_MODELS) {
        try {
          // Safe diagnostic logging: records model and byte size (never logs key, image, or user data)
          console.log(`[AI Assistant] Analyzing face image via Google Gemini (model: ${model}, size: ${imageBuffer.length} bytes)`);

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        inlineData: {
                          mimeType: cleanMime,
                          data: imageBuffer.toString("base64"),
                        },
                      },
                      { text: prompt },
                    ],
                  },
                ],
                generationConfig: { responseMimeType: "application/json" },
              }),
            }
          );

          if (response.ok) {
            const data = await response.json();
            const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
            const parsed = extractJson(rawJson);

            if (parsed && typeof parsed.dominant_emotion === "string") {
              const emotion = parsed.dominant_emotion.toLowerCase();
              const confidence = Math.min(100, Math.max(0, parseFloat(parsed.confidence) || 75));
              const stressLevel = Math.min(10, Math.max(1, parseFloat(parsed.stress_level) || 5));
              const moodScore = Math.min(10, Math.max(1, parseFloat(parsed.mood_score) || 5));
              const observations = parsed.observations || "Visible facial expressions observed.";
              const recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];

              // Safe success log
              console.log(`[AI Assistant] Gemini Vision success (model: ${model}, dominantEmotion: ${emotion}, confidence: ${confidence})`);

              return {
                success: true,
                dominant_emotion: emotion,
                confidence,
                stress_level: stressLevel,
                mood_score: moodScore,
                observations,
                recommendations,
                visionProvider: "google-gemini",
                disclaimer: CLINICAL_DISCLAIMER,
              };
            }
          }

          // Handle non-200 responses with safe sanitized categorization
          let errorData = null;
          try {
            errorData = (await response.json())?.error;
          } catch {
            errorData = { message: await response.text() };
          }

          const categorized = categorizeGeminiError(response.status, errorData, null);
          lastError = categorized;

          // Safe diagnostic logging: records HTTP status & sanitized error category
          // NEVER logs API keys, image content, or sensitive user info
          console.warn(
            `[AI Assistant] Gemini Vision error: status=${response.status}, model=${model}, category=${categorized.category}, code=${categorized.code}`
          );

          // If the model is temporarily unavailable (503), try candidate fallback model; otherwise break
          if (response.status !== 503) {
            break;
          }
        } catch (err) {
          const categorized = categorizeGeminiError(null, null, err);
          lastError = categorized;
          console.warn(`[AI Assistant] Gemini Vision network error: category=network_error, message="${err.message}"`);
          break;
        }
      }

      if (lastError) {
        return {
          success: false,
          error: lastError,
        };
      }
    }

    // 2. OpenAI Vision (GPT-4o / GPT-4o-mini)
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log(`[AI Assistant] Analyzing face image via OpenAI Vision (size: ${imageBuffer.length} bytes)`);
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${cleanMime};base64,${imageBuffer.toString("base64")}`,
                    },
                  },
                ],
              },
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          const parsed = extractJson(content);
          if (parsed && typeof parsed.dominant_emotion === "string") {
            const emotion = parsed.dominant_emotion.toLowerCase();
            return {
              success: true,
              dominant_emotion: emotion,
              confidence: Math.min(100, Math.max(0, parseFloat(parsed.confidence) || 75)),
              stress_level: Math.min(10, Math.max(1, parseFloat(parsed.stress_level) || 5)),
              mood_score: Math.min(10, Math.max(1, parseFloat(parsed.mood_score) || 5)),
              observations: parsed.observations || "Visible facial expressions observed.",
              recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
              visionProvider: "openai-vision",
              disclaimer: CLINICAL_DISCLAIMER,
            };
          }
        } else {
          const errText = await response.text();
          console.warn("[AI Assistant] OpenAI Vision response error:", response.status, errText);
        }
      } catch (err) {
        console.warn("[AI Assistant] OpenAI Vision failure:", err.message);
      }
    }

    // 3. No vision-capable provider configured
    return {
      success: false,
      error: {
        category: "missing_api_key",
        code: "MISSING_API_KEY",
        status: 422,
        message:
          "Facial expression image analysis is currently unavailable. Please configure GEMINI_API_KEY or OPENAI_API_KEY with vision capabilities on the server.",
      },
    };
  },
};

export default aiService;
