// Long-Term Personal Conversational Memory Service for EmoSense AI
// Securely manages user-scoped, non-sensitive preferences, projects, goals, and facts
// with deduplication, relevance retrieval, and forget commands.
import prisma from "../db.js";

// Stopwords to ignore during relevance matching
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
  "by", "from", "up", "about", "into", "over", "after", "is", "am", "are", "was",
  "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "can",
  "could", "should", "would", "will", "shall", "may", "might", "must", "that", "this",
  "these", "those", "i", "you", "he", "she", "it", "we", "they", "me", "him", "her",
  "us", "them", "my", "your", "his", "their", "our", "what", "which", "who", "when",
  "where", "why", "how", "all", "any", "both", "each", "few", "more", "most", "some",
  "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very"
]);

// Sensitive patterns that must NEVER become persistent memories
const SENSITIVE_PATTERNS = [
  /\bpassword\b/i,
  /\bsecret\b/i,
  /\btoken\b/i,
  /\bapi[_-]?key\b/i,
  /\bauth\b/i,
  /\bdiagnos(is|ed)\b/i,
  /\bprescription\b/i,
  /\bmedicat(ion|ed)\b/i,
  /\bclinically\b/i,
  /\bbipolar\b/i,
  /\bschizo\b/i,
  /\bsuicid\b/i,
  /\bself[_-]?harm\b/i,
  /\bcredit[_-]?card\b/i,
  /\bssn\b/i,
];

/**
 * Checks if candidate memory text contains sensitive personal or health details.
 */
export function isSensitiveMemory(text) {
  if (!text || typeof text !== "string") return true;
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Simple English stemmer for root matching (e.g. building -> build, learning -> learn, projects -> project)
 */
export function stemWord(word) {
  if (!word || word.length < 4) return word;
  return word
    .toLowerCase()
    .replace(/(?:ing|ies|es|ed|s)$/, (match) => {
      if (match === "ies") return "y";
      return "";
    })
    .replace(/(.)\1$/, "$1"); // remove duplicate trailing char e.g. buildd -> build
}

// Semantic topic clusters to recognize related terminology
const SEMANTIC_CLUSTERS = {
  project: new Set([
    "project", "projects", "build", "building", "built", "work", "working",
    "develop", "developing", "developer", "code", "coding", "coder",
    "app", "apps", "application", "website", "site", "software", "stack"
  ]),
  goal: new Set([
    "goal", "goals", "learn", "learning", "learned", "study", "studying",
    "studied", "course", "subject", "topics", "topic", "master", "mastering",
    "reading", "prepare", "preparing", "prep", "syllabus"
  ]),
  preference: new Set([
    "prefer", "preference", "preferences", "style", "format", "instruction",
    "instructions", "tone", "like"
  ]),
  task: new Set([
    "task", "tasks", "deadline", "deadlines", "exam", "exams", "test", "tests",
    "interview", "interviews", "presentation", "meeting", "due", "event", "events"
  ]),
};

/**
 * Extracts searchable significant tokens from text, with optional stemming.
 */
export function extractKeywords(text, stem = false) {
  if (!text || typeof text !== "string") return [];
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));

  return stem ? words.map(stemWord) : words;
}

/**
 * Retrieves the most relevant non-sensitive memories for the authenticated user
 * based on semantic topic intent, keyword stems, and user preferences.
 * Capped to max 4 to avoid overwhelming the model context window.
 */
export async function getRelevantMemories(userId, currentMessage = "", maxCount = 4) {
  if (!userId) return [];

  const userAudit = typeof userId === "string" ? `${userId.substring(0, 8)}...` : "authenticated";

  try {
    const allMemories = await prisma.userMemory.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 25, // Inspect recent 25
    });

    if (allMemories.length === 0) {
      console.log(`[MemoryService] Retrieved 0 relevant memory record(s) for user ${userAudit} (no stored memories)`);
      return [];
    }

    const lowerQuery = currentMessage.toLowerCase();
    const queryKeywords = extractKeywords(currentMessage, false);
    const queryStems = new Set(queryKeywords.map(stemWord));

    // Detect user query semantic intents
    const queryHasProjectIntent =
      queryKeywords.some((w) => SEMANTIC_CLUSTERS.project.has(w) || SEMANTIC_CLUSTERS.project.has(stemWord(w))) ||
      lowerQuery.includes("project") ||
      lowerQuery.includes("building") ||
      lowerQuery.includes("working on");

    const queryHasGoalIntent =
      queryKeywords.some((w) => SEMANTIC_CLUSTERS.goal.has(w) || SEMANTIC_CLUSTERS.goal.has(stemWord(w))) ||
      lowerQuery.includes("learning") ||
      lowerQuery.includes("studying") ||
      lowerQuery.includes("goal");

    const queryHasPreferenceIntent =
      queryKeywords.some((w) => SEMANTIC_CLUSTERS.preference.has(w) || SEMANTIC_CLUSTERS.preference.has(stemWord(w))) ||
      lowerQuery.includes("prefer");

    const queryHasTaskIntent =
      queryKeywords.some((w) => SEMANTIC_CLUSTERS.task.has(w) || SEMANTIC_CLUSTERS.task.has(stemWord(w))) ||
      lowerQuery.includes("exam") ||
      lowerQuery.includes("deadline") ||
      lowerQuery.includes("interview");

    const isGeneralMemoryQuery =
      lowerQuery.includes("what do you remember") ||
      lowerQuery.includes("what do you know about me") ||
      lowerQuery.includes("tell me about myself") ||
      lowerQuery.includes("who am i") ||
      lowerQuery.includes("my background") ||
      lowerQuery.includes("saved memories");

    // Score memories:
    // +6 points for matching semantic topic intent (project, goal, task, preference)
    // +3 points for each keyword stem match
    // +5 points if general memory inquiry
    // +1.5 points for general preference (only if relevant or general query)
    const scored = allMemories.map((mem) => {
      let score = 0;
      const memKeywords = extractKeywords(mem.content, false);
      const memStems = memKeywords.map(stemWord);

      // Keyword stem matching
      const stemMatches = memStems.filter((stem) => queryStems.has(stem));
      score += stemMatches.length * 3;

      // Exact keyword matching in content
      const exactMatches = memKeywords.filter((kw) => queryKeywords.includes(kw));
      score += exactMatches.length * 2;

      // Semantic category matching
      if (mem.category === "project" && queryHasProjectIntent) {
        score += 6;
      }
      if ((mem.category === "goal" || mem.category === "learning") && queryHasGoalIntent) {
        score += 6;
      }
      if (mem.category === "preference" && queryHasPreferenceIntent) {
        score += 6;
      }
      if (mem.category === "task" && queryHasTaskIntent) {
        score += 6;
      }

      // General personal recall queries retrieve all key active facts
      if (isGeneralMemoryQuery) {
        score += 5;
      }

      return { mem, score };
    });

    // Threshold: only return memories with solid relevance (score >= 4.0)
    // Unrelated questions (e.g. arithmetic, science, general chat) score 0 and are omitted.
    const filtered = scored
      .filter((item) => item.score >= 4.0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxCount)
      .map((item) => item.mem);

    // Safe diagnostic log (Requirement 4)
    console.log(
      `[MemoryService] Retrieved ${filtered.length} relevant memory record(s) for user ${userAudit} (queryTokens: ${queryKeywords.length}, intents: ${[
        queryHasProjectIntent && "project",
        queryHasGoalIntent && "goal",
        queryHasPreferenceIntent && "preference",
        queryHasTaskIntent && "task",
        isGeneralMemoryQuery && "general",
      ].filter(Boolean).join(",") || "none"})`
    );

    // Touch lastRecalledAt for retrieved memories asynchronously
    if (filtered.length > 0) {
      const ids = filtered.map((m) => m.id);
      prisma.userMemory
        .updateMany({
          where: { id: { in: ids } },
          data: { lastRecalledAt: new Date() },
        })
        .catch((err) => console.warn("[MemoryService] lastRecalledAt update notice:", err.message));
    }

    return filtered;
  } catch (error) {
    console.error("[MemoryService] getRelevantMemories error:", error.message);
    return [];
  }
}

/**
 * Checks if the user message is an explicit request to forget or remove a memory.
 * Examples: "forget that I'm learning Java", "forget about my project", "forget that", "clear my memories"
 */
export function detectForgetIntent(message) {
  if (!message || typeof message !== "string") return null;
  const lower = message.trim().toLowerCase();

  const forgetPrefixes = [
    "forget that",
    "forget about",
    "forget what i said about",
    "forget my",
    "remove memory",
    "delete memory",
    "stop remembering",
    "don't remember that",
    "dont remember that",
  ];

  for (const prefix of forgetPrefixes) {
    if (lower.startsWith(prefix) || lower.includes(prefix)) {
      const target = lower.split(prefix)[1]?.trim().replace(/^about\s+/i, "") || "";
      return {
        isForget: true,
        targetTopic: target,
      };
    }
  }

  if (lower === "forget everything" || lower === "clear all memories" || lower === "forget that") {
    return {
      isForget: true,
      targetTopic: "recent",
    };
  }

  return null;
}

/**
 * Handles explicit forget requests.
 */
export async function handleForgetCommand(userId, targetTopic = "") {
  if (!userId) {
    return {
      success: false,
      deletedCount: 0,
      message: "Unable to process forget request without authentication.",
    };
  }

  const cleanTopic = (targetTopic || "")
    .trim()
    .toLowerCase()
    .replace(/^forget\s+(about\s+|that\s+|my\s+)?/i, "")
    .trim();

  try {
    if (
      !cleanTopic ||
      cleanTopic === "recent" ||
      cleanTopic === "that" ||
      cleanTopic === "everything" ||
      cleanTopic === "all"
    ) {
      // Clear all memories if requested
      if (cleanTopic === "everything" || cleanTopic === "all") {
        const count = await prisma.userMemory.deleteMany({ where: { userId } });
        return {
          success: true,
          deletedCount: count.count,
          message: `I've cleared all ${count.count} saved memories for you.`,
        };
      }

      // Delete the single most recently updated memory
      const latest = await prisma.userMemory.findFirst({
        where: { userId },
        orderBy: { updatedAt: "desc" },
      });
      if (latest) {
        await prisma.userMemory.delete({ where: { id: latest.id } });
        return {
          success: true,
          deletedCount: 1,
          removedFact: latest.content,
          message: `I've forgotten that for you: "${latest.content}".`,
        };
      }
      return {
        success: true,
        deletedCount: 0,
        message: "I didn't find any saved memories to forget.",
      };
    }

    // Find memories matching the target topic keywords
    const keywords = extractKeywords(cleanTopic);
    const userMems = await prisma.userMemory.findMany({ where: { userId } });

    const matchingIds = [];
    for (const mem of userMems) {
      const lower = mem.content.toLowerCase();
      if (keywords.some((kw) => lower.includes(kw))) {
        matchingIds.push(mem.id);
      }
    }

    if (matchingIds.length > 0) {
      await prisma.userMemory.deleteMany({
        where: { id: { in: matchingIds } },
      });
      return {
        success: true,
        deletedCount: matchingIds.length,
        message: `I've removed ${matchingIds.length} remembered item${matchingIds.length > 1 ? "s" : ""} matching your request.`,
      };
    }

    // Fallback: if no keyword match found, delete the most recent memory
    const latest = await prisma.userMemory.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
    if (latest) {
      await prisma.userMemory.delete({ where: { id: latest.id } });
      return {
        success: true,
        deletedCount: 1,
        removedFact: latest.content,
        message: `I've forgotten that for you: "${latest.content}".`,
      };
    }

    return {
      success: true,
      deletedCount: 0,
      message: "I couldn't find any saved memories matching that topic.",
    };
  } catch (error) {
    console.error("[MemoryService] handleForgetCommand error:", error.message);
    return {
      success: false,
      error: error.message,
      message: "I ran into an issue while trying to remove that memory.",
    };
  }
}

/**
 * Lightweight heuristic memory extractor:
 * Identifies persistent, non-sensitive personal facts (projects, preferences, learning goals, tasks)
 * from conversation exchanges across multi-sentence messages.
 */
export function extractCandidateFacts(userMessage) {
  if (!userMessage || typeof userMessage !== "string") return [];
  const text = userMessage.trim();

  // Guard against sensitive topics, crisis, or very short messages
  if (text.length < 8 || isSensitiveMemory(text)) {
    return [];
  }

  // If the message is purely a question (starts with question words and ends with ?), skip fact extraction
  if (/^(?:what|who|where|when|why|how|do|does|did|can|could|is|are|am|should|would)\b/i.test(text) && text.includes("?")) {
    return [];
  }

  const candidates = [];

  // Protect technical abbreviations with periods (e.g., Node.js, Vue.js, React.js, .NET)
  const protectedText = text.replace(/\b([a-zA-Z0-9]+)\.([a-zA-Z0-9]+)\b/g, "$1___DOT___$2");

  // Split into sentences or independent clauses
  const segments = protectedText
    .split(/(?<=[.!?])\s+|\n+|(?<=[,;])\s+(?=(?:i am|i'm|currently|i also|i'm also|my project|my goal|i want))/i)
    .map((s) => s.replace(/___DOT___/g, ".").trim())
    .filter((s) => s.length > 5);

  for (const segment of segments) {
    // Skip if segment is a question
    if (segment.includes("?") && /^(?:what|who|where|how|why|do|can|could|is|are)\b/i.test(segment)) {
      continue;
    }

    // 1. Projects & Work
    // e.g. "I'm building EmoSense AI, a mental wellness app using React and Node.js"
    // e.g. "I am working on building a modern React portfolio site with Tailwind CSS"
    // e.g. "My project is an e-commerce website"
    const projectMatch =
      segment.match(/(?:i am|i'm|currently|we are|we're|i've been)\s+(?:also\s+)?(?:building|working on|developing|creating|coding|designing|making)\s+([^.!\n]+)/i) ||
      segment.match(/(?:my\s+(?:current\s+)?project\s+is|my\s+app\s+is)\s+([^.!\n]+)/i) ||
      segment.match(/(?:i\s+work\s+on|working\s+on)\s+([^.!\n]+)/i);

    if (projectMatch && projectMatch[1]) {
      let fact = projectMatch[1].trim().replace(/^[:\s-]+/, "");
      fact = fact.replace(/^(?:a|an|the|my)\s+/i, "");
      fact = fact.replace(/[.!,;]+$/, "").trim();
      if (fact.length > 3 && fact.length < 180 && !isSensitiveMemory(fact)) {
        candidates.push({
          category: "project",
          content: `User is building: ${fact}`,
        });
      }
    }

    // 2. Learning Goals & Topics
    // e.g. "I'm also learning Python for data science"
    // e.g. "I am studying machine learning"
    // e.g. "I want to learn French"
    const learningMatch =
      segment.match(/(?:i am|i'm|want to|planning to|currently|i've been)\s+(?:also\s+)?(?:learning|studying|mastering|reading about|preparing for|taking a course in|diving into)\s+([^.!\n]+)/i) ||
      segment.match(/(?:my\s+(?:learning\s+)?goal\s+is|my\s+goal\s+is\s+to\s+learn)\s+([^.!\n]+)/i) ||
      segment.match(/(?:learning|studying)\s+([a-zA-Z0-9\s#+.-]+(?:\s+for\s+[a-zA-Z0-9\s#+.-]+)?)/i);

    if (learningMatch && learningMatch[1]) {
      let fact = learningMatch[1].trim().replace(/^[:\s-]+/, "");
      fact = fact.replace(/^(?:a|an|the|my)\s+/i, "");
      fact = fact.replace(/[.!,;]+$/, "").trim();
      if (fact.length > 2 && fact.length < 180 && !isSensitiveMemory(fact)) {
        candidates.push({
          category: "goal",
          content: `User is learning: ${fact}`,
        });
      }
    }

    // 3. Explicit Communication & Help Preferences
    // e.g. "I prefer concise code examples"
    // e.g. "Please always explain things simply"
    const prefMatch =
      segment.match(/(?:i prefer|please always|i like when you|keep your answers|explain with|don't give me|do not give me)\s+([^.!\n]+)/i) ||
      segment.match(/(?:my preference is|i'd prefer)\s+([^.!\n]+)/i);

    if (prefMatch && prefMatch[1]) {
      let fact = prefMatch[1].trim().replace(/^[:\s-]+/, "");
      fact = fact.replace(/[.!,;]+$/, "").trim();
      if (fact.length > 4 && fact.length < 180 && !isSensitiveMemory(fact)) {
        candidates.push({
          category: "preference",
          content: `User preference: ${fact}`,
        });
      }
    }

    // 4. Upcoming Deadlines or Important Life Events
    // e.g. "I have an interview next Monday"
    // e.g. "My exam deadline is next week"
    const eventMatch = segment.match(/(?:i have|my)\s+(?:an?\s+)?(?:interview|exam|presentation|deadline|launch|meeting|submission)\s+([^.!\n]+)/i);

    if (eventMatch && eventMatch[0]) {
      let fact = eventMatch[0].trim().replace(/^[:\s-]+/, "");
      fact = fact.replace(/[.!,;]+$/, "").trim();
      if (fact.length > 4 && fact.length < 180 && !isSensitiveMemory(fact)) {
        candidates.push({
          category: "task",
          content: `User upcoming event/task: ${fact}`,
        });
      }
    }
  }

  // Diagnostic log (Requirement 4)
  console.log(`[MemoryService] Extraction attempted (msgLength: ${text.length}): ${candidates.length} candidate fact(s) found`);

  return candidates;
}

/**
 * Saves candidate facts to database for authenticated user, with deduplication.
 */
export async function saveCandidateMemories(userId, arg2, arg3) {
  const candidates = Array.isArray(arg2) ? arg2 : Array.isArray(arg3) ? arg3 : [];
  const sessionId = typeof arg2 === "string" ? arg2 : typeof arg3 === "string" ? arg3 : null;
  if (!userId || candidates.length === 0) return [];

  const userAudit = typeof userId === "string" ? `${userId.substring(0, 8)}...` : "authenticated";
  const saved = [];

  for (const candidate of candidates) {
    if (!candidate.content || isSensitiveMemory(candidate.content)) continue;

    try {
      const keywords = extractKeywords(candidate.content, false);

      // Check for existing memory with high keyword overlap in the same category
      const existingMemories = await prisma.userMemory.findMany({
        where: {
          userId,
          category: candidate.category || "general",
        },
      });

      let duplicateFound = null;
      for (const existing of existingMemories) {
        const existingKws = extractKeywords(existing.content, false);
        const overlap = keywords.filter((kw) => existingKws.includes(kw));
        // If 70% or at least 2 distinct keywords overlap, treat as update to same memory
        if (overlap.length >= 2 || (keywords.length <= 2 && overlap.length >= 1)) {
          duplicateFound = existing;
          break;
        }
      }

      if (duplicateFound) {
        // Update existing memory
        const updated = await prisma.userMemory.update({
          where: { id: duplicateFound.id },
          data: {
            content: candidate.content,
            sourceSessionId: sessionId || duplicateFound.sourceSessionId,
            updatedAt: new Date(),
          },
        });
        saved.push(updated);
      } else {
        // Create new memory
        const created = await prisma.userMemory.create({
          data: {
            userId,
            category: candidate.category || "general",
            content: candidate.content,
            sourceSessionId: sessionId || null,
          },
        });
        saved.push(created);
      }
    } catch (err) {
      console.warn("[MemoryService] Save memory notice:", err.message);
    }
  }

  // Diagnostic log (Requirement 4)
  console.log(`[MemoryService] Saved ${saved.length} memory record(s) for user ${userAudit}`);

  return saved;
}

/**
 * Lists all stored memories for a user.
 */
export async function listUserMemories(userId) {
  if (!userId) return [];
  return prisma.userMemory.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Deletes a single user memory verifying ownership.
 */
export async function deleteUserMemory(userId, memoryId) {
  if (!userId || !memoryId) return false;
  const memory = await prisma.userMemory.findUnique({
    where: { id: memoryId },
  });
  if (!memory || memory.userId !== userId) return false;

  await prisma.userMemory.delete({
    where: { id: memoryId },
  });
  return true;
}

/**
 * Clears all memories for a user.
 */
export async function clearAllUserMemories(userId) {
  if (!userId) return 0;
  const result = await prisma.userMemory.deleteMany({
    where: { userId },
  });
  return result.count;
}

export default {
  getRelevantMemories,
  detectForgetIntent,
  handleForgetCommand,
  extractCandidateFacts,
  saveCandidateMemories,
  listUserMemories,
  deleteUserMemory,
  clearAllUserMemories,
  isSensitiveMemory,
};
