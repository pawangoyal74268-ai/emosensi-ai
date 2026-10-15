// EmoSense AI — Core Application Types & API Contracts

export type MoodType = "happy" | "calm" | "neutral" | "anxious" | "sad" | "stressed" | "angry";
export type MoodSource = "manual" | "chat" | "voice" | "face";
export type ConsultationType = "video" | "phone" | "in-person";
export type AppointmentStatus = "scheduled" | "completed" | "cancelled";

/**
 * Standard Mood Record matching backend Prisma model and formatMoodEntry output.
 */
export interface MoodEntry {
  id: string;
  userId: string;
  mood: MoodType | string;
  moodScore: number;
  mood_score: number;
  stressLevel: number;
  stress_level: number;
  source: MoodSource | string;
  notes: string;
  tags?: string | null;
  voiceAnalysis?: {
    pitch?: number;
    energy?: number;
    tempo?: number;
    duration?: number;
    [key: string]: unknown;
  } | null;
  faceAnalysis?: {
    dominantEmotion?: string;
    confidence?: number;
    stressLevel?: number;
    [key: string]: unknown;
  } | null;
  createdAt: string;
  created_date: string;
}

/**
 * Input payload for creating a mood check-in.
 */
export interface MoodCheckinInput {
  mood: MoodType | string;
  stressLevel?: number;
  stress_level?: number;
  moodScore?: number;
  mood_score?: number;
  source?: MoodSource | string;
  notes?: string;
}

/**
 * AI Analysis Result returned from /api/analysis/{text|voice|face}
 */
export interface EmotionalAnalysisResult {
  dominant_emotion?: string;
  detected_mood?: string;
  emotional_tone?: string;
  sentiment?: string;
  confidence?: number;
  stress_level?: number;
  transcript?: string;
  image?: string;
  summary?: string;
  key_themes?: string[];
  recommendations?: string[];
  [key: string]: unknown;
}

/**
 * Doctor record matching backend Prisma Doctor model.
 */
export interface Doctor {
  id: string;
  name: string;
  specialization: string;
  photo_url?: string | null;
  consultation_fee: number;
  consultationFee?: number;
  bio?: string | null;
  languages?: string[];
  availableSlots?: string[];
  createdAt?: string;
}

/**
 * Appointment booking record matching backend Prisma Appointment model.
 */
export interface Appointment {
  id: string;
  userId: string;
  doctorId: string;
  doctor_id: string;
  doctor_name: string;
  date: string;
  time: string;
  type: ConsultationType;
  notes?: string | null;
  status: AppointmentStatus;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Input payload for booking an appointment.
 */
export interface AppointmentCreateInput {
  doctor_id: string;
  doctor_name: string;
  date: string;
  time: string;
  type: ConsultationType | string;
  notes?: string;
}

/**
 * Comprehensive Mood & Stress Analytics shape from /api/analytics
 */
export interface AnalyticsData {
  periodDays: number;
  totalEntries: number;
  averageStress: number | null;
  averageMoodScore: number | null;
  wellnessScore: number | null;
  stressClassification: string;
  latestMood: string | null;
  moodDistribution: Record<MoodType | string, number>;
  sourceDistribution: Record<MoodSource | string, number>;
  stressDistribution: {
    low: number;
    moderate: number;
    elevated: number;
    high: number;
  };
  dailyTrends?: Array<{
    date: string;
    avgStress: number;
    moodScore: number;
    count: number;
  }>;
}

/**
 * Chat Message item in state and history.
 */
export interface ChatMessageItem {
  id: string;
  role: "user" | "assistant" | "system" | string;
  content: string;
  detectedMood?: string;
  detectedStress?: number;
  suggestedActions?: string[];
  provider?: string;
  createdAt?: string;
}

/**
 * Active AI provider state in Chat.
 */
export interface ActiveProviderInfo {
  provider: string;
  model: string;
  fallback?: boolean;
}

/**
 * Long-term persistent AI memory item.
 */
export interface UserMemoryItem {
  id: string;
  userId: string;
  category: "preference" | "project" | "goal" | "task" | "learning" | "wellness" | "fact" | string;
  content: string;
  confidence: number;
  sourceSessionId?: string | null;
  lastRecalledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryListResponse {
  success: boolean;
  memories: UserMemoryItem[];
  count: number;
}

/**
 * Generic API error with HTTP status and code.
 */
export interface AppError extends Error {
  status?: number;
  code?: string;
  data?: unknown;
}
