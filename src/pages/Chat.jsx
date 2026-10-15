import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import apiClient from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  MoreVertical,
  Trash2,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  LogIn,
  Send,
  Mic,
  MicOff,
  PhoneCall,
  ExternalLink,
  RefreshCw,
  Headphones,
  Volume2,
  VolumeX,
  X,
  Plus,
  History as HistoryIcon,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ChatMessage from "@/components/chat/ChatMessage";
import MoodCard from "@/components/mood/MoodCard";
import StressIndicator from "@/components/mood/StressIndicator";
import { cn } from "@/lib/utils";

const ACTIVE_CHAT_SESSION_KEY = "emosense_active_chat_session";

const quickSuggestions = [
  "I've been feeling quite stressed lately",
  "How can I sleep better tonight?",
  "Help me structure a study schedule",
  "Explain how asynchronous programming works",
];

/** @type {import("@/types").ChatMessageItem} */
const INITIAL_GREETING = {
  id: "welcome-1",
  role: "assistant",
  content:
    "Hello! I'm EmoSense AI, your warm, thoughtful conversational companion. 🌿\n\nI can help with general questions, concepts, studying, writing, and everyday tasks, while also offering empathetic wellness support whenever you want to reflect. How can I help you today?",
  createdAt: new Date().toISOString(),
  suggestedActions: [],
};

export default function Chat() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionQueryId = searchParams.get("session");

  /** @type {[import("@/types").ChatMessageItem[], React.Dispatch<React.SetStateAction<import("@/types").ChatMessageItem[]>>]} */
  const [messages, setMessages] = useState(() => {
    const hasTarget =
      typeof window !== "undefined" &&
      (new URLSearchParams(window.location.search).get("session") ||
        localStorage.getItem(ACTIVE_CHAT_SESSION_KEY));
    // If a saved session exists, start with empty list until restored to prevent default welcome message flash
    return hasTarget ? [] : [INITIAL_GREETING];
  });
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [sessionSummary, setSessionSummary] = useState(null);
  const [activeSessionId, setActiveSessionId] = useState(() => {
    return (
      (typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("session")) ||
      (typeof window !== "undefined" &&
        localStorage.getItem(ACTIVE_CHAT_SESSION_KEY)) ||
      null
    );
  });
  const [showSuggestions, setShowSuggestions] = useState(() => {
    return !(
      typeof window !== "undefined" &&
      (new URLSearchParams(window.location.search).get("session") ||
        localStorage.getItem(ACTIVE_CHAT_SESSION_KEY))
    );
  });
  const [crisisAlert, setCrisisAlert] = useState(null);
  const [speakingMessageId, setSpeakingMessageId] = useState(null);

  // Conversational Voice Mode State
  const [isVoiceModeOpen, setIsVoiceModeOpen] = useState(false);
  const [voiceModeState, setVoiceModeState] = useState("idle"); // "idle" | "listening" | "processing" | "speaking"
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceAssistantReply, setVoiceAssistantReply] = useState("");

  const [activeProviderInfo, setActiveProviderInfo] = useState({
    provider: "google-gemini",
    model: "gemini-3.1-flash-lite",
    fallback: false,
  });

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const voiceModeRecognitionRef = useRef(null);
  const isSendingRef = useRef(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Clean up audio and recognition on unmount
  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      if (voiceModeRecognitionRef.current) {
        try {
          voiceModeRecognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  // Restore persistent session on mount or when ?session= param changes
  useEffect(() => {
    if (!isAuthenticated) return;

    const targetSessionId = sessionQueryId || localStorage.getItem(ACTIVE_CHAT_SESSION_KEY);
    if (!targetSessionId) {
      if (messages.length === 0) {
        setMessages([INITIAL_GREETING]);
        setShowSuggestions(true);
      }
      return;
    }

    let isMounted = true;
    const restoreSession = async () => {
      setIsLoadingSession(true);
      try {
        const res = await apiClient.chat.getSession(targetSessionId);
        if (!isMounted) return;

        if (res?.session) {
          setActiveSessionId(res.session.id);
          localStorage.setItem(ACTIVE_CHAT_SESSION_KEY, res.session.id);
          if (sessionQueryId !== res.session.id) {
            setSearchParams({ session: res.session.id }, { replace: true });
          }

          if (Array.isArray(res.session.messages) && res.session.messages.length > 0) {
            const restored = res.session.messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              detectedMood: m.detectedMood,
              detectedStress: m.detectedStress,
              suggestedActions: [],
              createdAt: m.createdAt,
            }));
            setMessages(restored);
            setShowSuggestions(false);
          } else {
            setMessages([INITIAL_GREETING]);
            setShowSuggestions(true);
          }
        }
      } catch (err) {
        console.warn("[Chat] Session restore failed, starting fresh:", err.message);
        if (!isMounted) return;
        localStorage.removeItem(ACTIVE_CHAT_SESSION_KEY);
        setSearchParams({}, { replace: true });
        setActiveSessionId(null);
        setMessages([INITIAL_GREETING]);
        setShowSuggestions(true);
      } finally {
        if (isMounted) setIsLoadingSession(false);
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, [sessionQueryId, isAuthenticated]);

  // Stop active speech playback
  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMessageId(null);
    if (isVoiceModeOpen && voiceModeState === "speaking") {
      setVoiceModeState("idle");
    }
  };

  // Play assistant message aloud via window.speechSynthesis
  const handleSpeakMessage = (text, messageId) => {
    if (!("speechSynthesis" in window)) {
      toast.info("Speech synthesis is not supported in this browser.");
      return;
    }

    if (speakingMessageId === messageId) {
      stopSpeaking();
      return;
    }

    stopSpeaking();

    const cleanText = (text || "")
      .replace(/[*_#`~]/g, "")
      .replace(/•/g, "")
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const naturalVoice =
      voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Natural") ||
            v.name.includes("Google") ||
            v.name.includes("Samantha") ||
            v.name.includes("Daniel") ||
            v.name.includes("Karen") ||
            v.name.includes("Zira"))
      ) || voices.find((v) => v.lang.startsWith("en"));

    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    utterance.onstart = () => {
      setSpeakingMessageId(messageId);
    };

    utterance.onend = () => {
      setSpeakingMessageId(null);
      if (isVoiceModeOpen) {
        setVoiceModeState("idle");
      }
    };

    utterance.onerror = () => {
      setSpeakingMessageId(null);
      if (isVoiceModeOpen) {
        setVoiceModeState("idle");
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  // Send message to conversational Gemini assistant
  const handleSendMessage = async (textToSend, options = {}) => {
    const text = (textToSend || inputText).trim();
    if (!text || isTyping || isSendingRef.current) return;

    if (!isAuthenticated) {
      toast.info("Please sign in to chat with the EmoSense AI companion.");
      if (openAuthModal) openAuthModal();
      return;
    }

    isSendingRef.current = true;
    setShowSuggestions(false);
    setInputText("");

    const userMessageId = `user-${Date.now()}`;
    const userMessage = {
      id: userMessageId,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };

    const previousHistory = messages.filter((m) => m && m.content);
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    try {
      // Format clean history array for backend (up to 12 turns)
      const historyPayload = previousHistory.slice(-12).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await apiClient.chat.sendMessage({
        message: text,
        history: historyPayload,
        sessionId: activeSessionId,
      });

      if (res && res.reply) {
        if (res.sessionId && res.sessionId !== activeSessionId) {
          setActiveSessionId(res.sessionId);
          localStorage.setItem(ACTIVE_CHAT_SESSION_KEY, res.sessionId);
          setSearchParams({ session: res.sessionId }, { replace: true });
          queryClient.invalidateQueries({ queryKey: ["chatSessions"] });
        }

        const assistantMsgId = res.messageId || `assistant-${Date.now()}`;
        const assistantMessage = {
          id: assistantMsgId,
          role: "assistant",
          content: res.reply,
          detectedMood: res.detectedMood,
          detectedStress: res.detectedStress,
          suggestedActions: res.suggestedActions || [],
          provider: res.provider,
          createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        if (res.provider) {
          setActiveProviderInfo({
            provider: res.provider,
            model: res.model,
            fallback: res.fallback,
          });
        }

        if (res.isCrisis) {
          setCrisisAlert({
            isCrisis: true,
            crisisResources: res.crisisResources,
          });
        }

        // Handle voice mode spoken output
        if (options.speakResponse) {
          setVoiceAssistantReply(res.reply);
          setVoiceModeState("speaking");
          handleSpeakMessage(res.reply, assistantMsgId);
        }

        return res;
      } else {
        throw new Error("Empty response from AI assistant.");
      }
    } catch (err) {
      console.error("[Chat] Send message notice:", err.message);
      toast.error(err?.data?.error?.message || err?.message || "Unable to reach EmoSense AI backend.");

      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content:
            "I ran into a temporary issue connecting with the AI engine. Please ensure your backend server is running and try again in a moment.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsTyping(false);
      isSendingRef.current = false;
      if (options.speakResponse && voiceModeState !== "speaking") {
        setVoiceModeState("idle");
      }
    }
  };

  // Optional: Complete & Summarize Session (user chooses when to summarize)
  const handleSummarizeSession = async () => {
    const userMsgs = messages.filter((m) => m.role === "user");
    if (userMsgs.length === 0) {
      toast.info("Have a short conversation first before generating a session reflection.");
      return;
    }

    if (!isAuthenticated) {
      toast.info("Please sign in to save your session summary.");
      if (openAuthModal) openAuthModal();
      return;
    }

    setIsSummarizing(true);

    try {
      let currentSessionId = activeSessionId;
      if (!currentSessionId) {
        const sRes = await apiClient.chat.createSession();
        currentSessionId = sRes?.session?.id;
        if (currentSessionId) setActiveSessionId(currentSessionId);
      }

      if (currentSessionId) {
        const completeRes = await apiClient.chat.completeSession(currentSessionId, { messages });
        if (completeRes && completeRes.analysis) {
          queryClient.invalidateQueries({ queryKey: ["moodEntries"] });
          queryClient.invalidateQueries({ queryKey: ["analytics"] });
          queryClient.invalidateQueries({ queryKey: ["chatSessions"] });
          setSessionSummary(completeRes.analysis);
          toast.success("Session reflection generated and saved to your wellness profile!");
        }
      }
    } catch (err) {
      console.error("[Chat] Complete session failed:", err.message);
      toast.error(err?.data?.error?.message || err?.message || "Failed to summarize session.");
    } finally {
      setIsSummarizing(false);
    }
  };

  // Clear or Start New Conversation
  const handleStartNewChat = () => {
    stopSpeaking();
    localStorage.removeItem(ACTIVE_CHAT_SESSION_KEY);
    setSearchParams({}, { replace: true });
    setActiveSessionId(null);
    setMessages([INITIAL_GREETING]);
    setShowSuggestions(true);
    setCrisisAlert(null);
    setSessionSummary(null);
    setVoiceTranscript("");
    setVoiceAssistantReply("");
  };

  const handleClearChat = () => {
    handleStartNewChat();
    toast.success("Started a new conversation.");
  };

  // Web Speech API Voice Dictation in Chat Input Composer
  const handleVoiceToggle = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.info("Speech recognition is not supported in this browser. Please type your message.");
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event) => {
        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        const text = (final || interim).trim();
        if (text) {
          setInputText((prev) => (prev ? `${prev} ${text}` : text));
        }
      };

      recognition.onerror = (event) => {
        console.warn("[Chat] Voice input notice:", event.error);
        if (event.error === "not-allowed") {
          toast.error("Microphone permission was denied. Please allow microphone access in your browser settings.");
        } else if (event.error !== "no-speech") {
          toast.info(`Voice recognition note: ${event.error}`);
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn("[Chat] Voice input failed:", err.message);
      setIsRecording(false);
    }
  };

  // Conversational Voice Mode Handlers
  const startVoiceModeListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.info("Speech recognition is not supported in this browser.");
      return;
    }

    stopSpeaking();

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setVoiceModeState("listening");
        setVoiceTranscript("");
      };

      recognition.onresult = (event) => {
        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        setVoiceTranscript((final || interim).trim());
      };

      recognition.onerror = (event) => {
        console.warn("[VoiceMode] Speech error:", event.error);
        if (event.error === "not-allowed") {
          toast.error("Microphone access was denied. Please enable microphone permissions in your browser.");
        }
        setVoiceModeState("idle");
      };

      recognition.onend = async () => {
        if (voiceTranscript && voiceTranscript.trim().length > 0) {
          setVoiceModeState("processing");
          const spoken = voiceTranscript.trim();
          await handleSendMessage(spoken, { speakResponse: true });
        } else {
          setVoiceModeState("idle");
        }
      };

      voiceModeRecognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn("[VoiceMode] Start failed:", err.message);
      setVoiceModeState("idle");
    }
  };

  const stopVoiceModeListening = () => {
    if (voiceModeRecognitionRef.current) {
      try {
        voiceModeRecognitionRef.current.stop();
      } catch {}
    }
  };

  const handleOpenVoiceMode = () => {
    if (!isAuthenticated) {
      toast.info("Please sign in to start conversational voice mode.");
      if (openAuthModal) openAuthModal();
      return;
    }
    setIsVoiceModeOpen(true);
    setVoiceTranscript("");
    setVoiceAssistantReply("");
    setVoiceModeState("idle");
  };

  const handleCloseVoiceMode = () => {
    stopSpeaking();
    stopVoiceModeListening();
    setIsVoiceModeOpen(false);
    setVoiceModeState("idle");
  };

  const hasUserMessages = messages.some((m) => m.role === "user");

  // ==========================================
  // VIEW: SESSION SUMMARY SCREEN
  // (Rendered when user explicitly chooses "Summarize & Reflect")
  // ==========================================
  if (sessionSummary) {
    const reportedMood =
      sessionSummary.reported_mood || sessionSummary.overall_mood || "calm";
    const moodScore = sessionSummary.mood_score || 7;
    const stressScore =
      typeof sessionSummary.stress_level === "object"
        ? sessionSummary.stress_level.score
        : sessionSummary.stress_level || 4;
    const stressRating =
      typeof sessionSummary.stress_level === "object"
        ? sessionSummary.stress_level.rating
        : "moderate";
    const summaryText =
      sessionSummary.overall_summary || sessionSummary.summary;
    const recommendations =
      sessionSummary.personalized_next_steps || sessionSummary.recommendations || [];

    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-5">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2"
        >
          <div className="w-14 h-14 mx-auto rounded-3xl bg-[#245746] text-white flex items-center justify-center shadow-md">
            <CheckCircle2 className="w-7 h-7 text-[#DDE8DF]" />
          </div>
          <h1 className="text-2xl font-heading font-extrabold text-[#182B2A] dark:text-white">
            Conversational Session Summary
          </h1>
          <p className="text-xs sm:text-sm text-[#697681] dark:text-white/60">
            Recorded in your personal wellness profile
          </p>
        </motion.div>

        {/* Mood & Stress Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card-wellness p-5 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#697681] dark:text-white/60 mb-1">
              Observed Mood
            </h3>
            <MoodCard
              mood={
                reportedMood.toLowerCase().includes("anxious")
                  ? "anxious"
                  : reportedMood.toLowerCase().includes("stress")
                  ? "stressed"
                  : reportedMood.toLowerCase().includes("sad")
                  ? "sad"
                  : reportedMood.toLowerCase().includes("happy")
                  ? "happy"
                  : "calm"
              }
              score={moodScore}
              source="chat"
            />
          </div>

          <div className="card-wellness p-5 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#697681] dark:text-white/60">
                Stress Level
              </h3>
              <span className="text-[11px] font-bold capitalize px-2 py-0.5 rounded-full bg-[#E4EDFC] text-[#335C67] dark:bg-white/10 dark:text-white">
                {stressRating}
              </span>
            </div>
            <StressIndicator level={stressScore} size="lg" />
          </div>
        </div>

        {/* Reflection Card */}
        <div className="card-wellness p-6 space-y-2 border-l-4 border-l-[#245746]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#245746] dark:text-[#88c5ad]">
            Conversational Reflection
          </h3>
          <p className="text-xs sm:text-sm text-[#182B2A] dark:text-white/90 leading-relaxed font-medium">
            {summaryText}
          </p>
        </div>

        {/* Next Steps */}
        {Array.isArray(recommendations) && recommendations.length > 0 && (
          <div className="card-wellness p-6 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#182B2A] dark:text-white">
              Self-Care Next Steps
            </h3>
            <ul className="space-y-2.5">
              {recommendations.map((rec, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2.5 text-xs sm:text-sm text-[#182B2A] dark:text-white/80 leading-relaxed"
                >
                  <span className="w-5 h-5 rounded-full bg-[#DDE8DF] text-[#245746] dark:bg-white/15 dark:text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Clinical Disclaimer */}
        <div className="p-4 rounded-2xl bg-[#F7F5F0] dark:bg-white/5 border border-[#E9EAE7] dark:border-white/10 text-[11px] text-[#697681] dark:text-white/50 text-center leading-relaxed">
          {sessionSummary.clinical_disclaimer ||
            sessionSummary.disclaimer ||
            "EmoSense AI provides emotional wellness observations for self-reflection only. It is not a clinical assessment, medical diagnosis, or substitute for professional psychiatric or psychological care."}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1 rounded-2xl h-11 border-[#E9EAE7] dark:border-white/10 text-[#182B2A] dark:text-white hover:bg-white text-xs font-semibold"
            onClick={() => navigate(createPageUrl("Home"))}
          >
            Back to Dashboard
          </Button>

          <Button
            className="flex-1 rounded-2xl h-11 bg-[#245746] hover:bg-[#1d4839] text-white text-xs font-semibold shadow-xs"
            onClick={() => {
              setSessionSummary(null);
              handleClearChat();
            }}
          >
            Start New Conversation
          </Button>

          <Link to={createPageUrl("Doctors")} className="inline-block">
            <Button
              variant="outline"
              className="w-full sm:w-auto rounded-2xl h-11 border-[#E9EAE7] dark:border-white/10 text-[#182B2A] dark:text-white hover:bg-white text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <span>Browse Therapists</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW: MAIN CONVERSATIONAL CHAT SCREEN
  // ==========================================
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex flex-col min-h-[calc(100vh-140px)]">
      {/* Sub-Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E9EAE7] dark:border-white/10">
        <div className="flex items-center gap-3">
          <Link to={createPageUrl("Home")}>
            <button
              className="w-9 h-9 rounded-2xl bg-white dark:bg-white/10 border border-[#E9EAE7] dark:border-white/10 flex items-center justify-center text-[#182B2A] dark:text-white hover:border-[#245746]/40 transition-colors shadow-xs active:scale-95"
              aria-label="Back to Home"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-2xl bg-[#245746] text-white flex items-center justify-center font-bold shadow-xs">
              <Sparkles className="w-4 h-4 text-[#DDE8DF]" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-sm text-[#182B2A] dark:text-white flex items-center gap-1.5">
                <span>EmoSense Assistant</span>
              </h1>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  {activeProviderInfo.fallback
                    ? "Local Core Engine • Offline Mode"
                    : "Active • Powered by Google Gemini"}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* New Chat Button */}
          <button
            type="button"
            onClick={handleStartNewChat}
            className="h-8 px-2.5 sm:px-3 rounded-full bg-white dark:bg-white/10 hover:bg-[#F7F5F0] dark:hover:bg-white/20 text-[#182B2A] dark:text-white border border-[#E9EAE7] dark:border-white/10 text-[11px] font-bold transition-all flex items-center gap-1.5 shadow-xs active:scale-95"
            title="Start new conversation"
          >
            <Plus className="w-3.5 h-3.5 text-[#245746] dark:text-[#88c5ad]" />
            <span className="hidden sm:inline">New Chat</span>
          </button>

          {/* Conversational Voice Mode Launcher */}
          <button
            type="button"
            onClick={handleOpenVoiceMode}
            className="h-8 px-3 rounded-full bg-[#245746] hover:bg-[#1d4839] text-white text-[11px] font-bold transition-all flex items-center gap-1.5 shadow-xs active:scale-95"
            title="Start conversational voice companion"
          >
            <Headphones className="w-3.5 h-3.5 text-[#DDE8DF]" />
            <span className="hidden sm:inline">Voice Mode</span>
          </button>

          {hasUserMessages && (
            <button
              onClick={handleSummarizeSession}
              disabled={isSummarizing || isTyping}
              className="h-8 px-3 rounded-full bg-[#DDE8DF] text-[#245746] hover:bg-[#245746] hover:text-white text-[11px] font-bold transition-all flex items-center gap-1.5 shadow-xs active:scale-95 disabled:opacity-50"
            >
              {isSummarizing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Summarizing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Summarize</span>
                </>
              )}
            </button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="w-8 h-8 rounded-full text-[#697681] hover:text-[#182B2A] hover:bg-white dark:hover:bg-white/10 flex items-center justify-center transition-colors"
                aria-label="Chat options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleStartNewChat} className="text-xs">
                <Plus className="w-3.5 h-3.5 mr-2" />
                <span>New Conversation</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(createPageUrl("History"))} className="text-xs">
                <HistoryIcon className="w-3.5 h-3.5 mr-2" />
                <span>View Chat History</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleClearChat} className="text-rose-600 text-xs">
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                <span>Clear Conversation</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Guest Notice if Not Authenticated */}
      {!isAuthenticated && (
        <div className="my-3 p-3 rounded-2xl bg-[#EEE8FA]/70 dark:bg-[#201830] border border-[#EEE8FA] dark:border-white/10 flex items-center justify-between gap-2 text-xs text-[#182B2A] dark:text-white">
          <div className="flex items-center gap-2">
            <LogIn className="w-3.5 h-3.5 text-[#553385] dark:text-[#c4a6fb] flex-shrink-0" />
            <span>Sign in to save chat sessions and log reflections.</span>
          </div>
          <button
            onClick={openAuthModal}
            className="px-2.5 py-1 rounded-xl bg-[#245746] text-white text-[11px] font-bold flex-shrink-0"
          >
            Sign In
          </button>
        </div>
      )}

      {/* Immediate Crisis Notice Banner if Triggered */}
      {crisisAlert && (
        <div className="my-3 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 space-y-2">
          <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-xs">
            <PhoneCall className="w-4 h-4 text-rose-600" />
            <span>Immediate Support Resources (Free, Confidential, 24/7)</span>
          </div>
          <p className="text-xs text-rose-900/80 dark:text-rose-200/80 leading-relaxed">
            You don&apos;t have to go through this alone. Compassionate human help is available right now:
          </p>
          <div className="flex flex-wrap gap-2 text-xs font-semibold pt-1">
            <span className="px-3 py-1 rounded-xl bg-white dark:bg-rose-900/50 text-rose-700 dark:text-rose-200 border border-rose-200">
              Call or Text 988 (Suicide & Crisis Lifeline)
            </span>
            <span className="px-3 py-1 rounded-xl bg-white dark:bg-rose-900/50 text-rose-700 dark:text-rose-200 border border-rose-200">
              Text HOME to 741741 (Crisis Text Line)
            </span>
          </div>
        </div>
      )}

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3.5 min-h-[300px]">
        {isLoadingSession && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3 text-center">
            <RefreshCw className="w-6 h-6 animate-spin text-[#245746] dark:text-[#88c5ad]" />
            <p className="text-xs text-[#697681] dark:text-white/60">Restoring conversation history...</p>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg.content}
              isUser={msg.role === "user"}
              onSpeak={msg.role === "assistant" ? () => handleSpeakMessage(msg.content, msg.id) : undefined}
              isSpeaking={speakingMessageId === msg.id}
              suggestedActions={msg.suggestedActions}
              onActionClick={(action) => handleSendMessage(action)}
            />
          ))
        )}

        {isTyping && (
          <ChatMessage
            message=""
            isUser={false}
            isTyping={true}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestion Chips (shown at start) */}
      {showSuggestions && messages.length <= 2 && (
        <div className="py-2 space-y-1.5">
          <p className="text-[11px] font-semibold text-[#697681] dark:text-white/50 px-1">
            Suggested thoughts:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {quickSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleSendMessage(suggestion)}
                className="text-[11px] px-3 py-1.5 rounded-full bg-white dark:bg-white/10 text-[#182B2A] dark:text-white/90 border border-[#E9EAE7] dark:border-white/10 hover:border-[#245746]/40 transition-all text-left shadow-xs active:scale-95"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Sticky Input Composer */}
      <div className="sticky bottom-0 pt-2 pb-1 bg-[#F7F5F0]/95 dark:bg-[#0c1714]/95 backdrop-blur-md">
        {/* Live Dictation Active Indicator */}
        {isRecording && (
          <div className="mb-2 p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <span>Listening... words appear in the input box. You can edit them before sending.</span>
            </div>
            <button
              type="button"
              onClick={handleVoiceToggle}
              className="px-2.5 py-1 rounded-xl bg-white dark:bg-white/10 text-xs font-semibold text-[#182B2A] dark:text-white shadow-2xs hover:bg-[#DDE8DF]"
            >
              Done
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative w-full"
        >
          <div className="flex items-center gap-1.5 p-1.5 bg-white dark:bg-[#14231f] rounded-3xl border border-[#E9EAE7] dark:border-white/10 shadow-sm transition-colors">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Message EmoSense... share what's on your mind"
              disabled={isTyping}
              className="flex-1 px-4 py-3 bg-transparent text-xs sm:text-sm text-[#182B2A] dark:text-white placeholder:text-[#697681]/60 focus:outline-none min-h-[44px]"
            />

            <div className="flex items-center gap-1 pr-1">
              <button
                type="button"
                onClick={handleVoiceToggle}
                className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center transition-colors min-h-[40px] min-w-[40px] active:scale-95",
                  isRecording
                    ? "bg-rose-100 text-rose-600 dark:bg-rose-950/40"
                    : "text-[#697681] hover:text-[#182B2A] hover:bg-[#F7F5F0] dark:hover:bg-white/10"
                )}
                aria-label={isRecording ? "Stop voice dictation" : "Dictate voice message"}
                title={isRecording ? "Stop listening" : "Voice dictation"}
              >
                {isRecording ? <MicOff className="w-4 h-4 text-rose-600" /> : <Mic className="w-4 h-4" />}
              </button>

              <Button
                type="submit"
                disabled={!inputText.trim() || isTyping}
                className="w-10 h-10 rounded-2xl p-0 bg-[#245746] hover:bg-[#1d4839] text-white flex items-center justify-center border-0 shadow-xs disabled:opacity-40 min-h-[40px] min-w-[40px] active:scale-95"
                aria-label="Send message"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </Button>
            </div>
          </div>
        </form>

        <div className="text-[10px] text-center text-[#697681] dark:text-white/40 pt-1.5 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3 h-3 text-[#245746] dark:text-[#88c5ad]" />
          <span>Non-clinical guidance • Supportive conversational reflection</span>
        </div>
      </div>

      {/* ========================================== */}
      {/* CONVERSATIONAL VOICE MODE MODAL OVERLAY */}
      {/* ========================================== */}
      <AnimatePresence>
        {isVoiceModeOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg rounded-3xl bg-[#F7F5F0] dark:bg-[#111e1a] border border-[#E9EAE7] dark:border-white/10 p-6 sm:p-8 shadow-2xl space-y-6 text-center relative"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={handleCloseVoiceMode}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white dark:bg-white/10 flex items-center justify-center text-[#697681] hover:text-[#182B2A] dark:text-white/60 dark:hover:text-white transition-colors"
                aria-label="Exit voice mode"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Header */}
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DDE8DF] dark:bg-white/10 text-[#245746] dark:text-[#88c5ad] text-xs font-bold">
                  <Headphones className="w-3.5 h-3.5" />
                  <span>Conversational Voice Companion</span>
                </div>
                <h2 className="text-xl font-heading font-extrabold text-[#182B2A] dark:text-white">
                  EmoSense Voice Mode
                </h2>
                <p className="text-xs text-[#697681] dark:text-white/60">
                  Turn-based spoken conversation powered by Google Gemini
                </p>
              </div>

              {/* Central Orb / Voice Visualizer */}
              <div className="py-4 flex flex-col items-center justify-center">
                <div className="relative flex items-center justify-center">
                  {voiceModeState === "listening" && (
                    <motion.div
                      animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0.1, 0.5] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute w-36 h-36 rounded-full bg-rose-500/20"
                    />
                  )}
                  {voiceModeState === "speaking" && (
                    <motion.div
                      animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.15, 0.5] }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute w-36 h-36 rounded-full bg-emerald-500/20"
                    />
                  )}
                  <button
                    type="button"
                    onClick={
                      voiceModeState === "speaking"
                        ? stopSpeaking
                        : voiceModeState === "listening"
                        ? stopVoiceModeListening
                        : startVoiceModeListening
                    }
                    className={cn(
                      "w-24 h-24 rounded-full flex flex-col items-center justify-center shadow-lg transition-all active:scale-95 text-white z-10",
                      voiceModeState === "listening"
                        ? "bg-rose-600 hover:bg-rose-700 ring-4 ring-rose-200 dark:ring-rose-900/50"
                        : voiceModeState === "processing"
                        ? "bg-[#335C67] animate-pulse"
                        : voiceModeState === "speaking"
                        ? "bg-emerald-600 hover:bg-emerald-700 ring-4 ring-emerald-200 dark:ring-emerald-900/50"
                        : "bg-[#245746] hover:bg-[#1d4839]"
                    )}
                  >
                    {voiceModeState === "listening" ? (
                      <>
                        <Mic className="w-8 h-8 animate-bounce" />
                        <span className="text-[10px] font-bold mt-1">Listening</span>
                      </>
                    ) : voiceModeState === "processing" ? (
                      <>
                        <RefreshCw className="w-8 h-8 animate-spin" />
                        <span className="text-[10px] font-bold mt-1">Thinking</span>
                      </>
                    ) : voiceModeState === "speaking" ? (
                      <>
                        <Volume2 className="w-8 h-8 animate-pulse" />
                        <span className="text-[10px] font-bold mt-1">Speaking</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-8 h-8" />
                        <span className="text-[10px] font-bold mt-1">Tap to Speak</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="mt-4 text-xs font-semibold text-[#182B2A] dark:text-white">
                  {voiceModeState === "listening"
                    ? "Listening to you... Tap to finish"
                    : voiceModeState === "processing"
                    ? "Processing with Gemini AI..."
                    : voiceModeState === "speaking"
                    ? "EmoSense is speaking... Tap button to pause"
                    : "Tap the mic when you're ready to speak"}
                </p>
              </div>

              {/* Live / Recent Transcript Box */}
              {(voiceTranscript || voiceAssistantReply) && (
                <div className="text-left p-4 rounded-2xl bg-white dark:bg-[#162520] border border-[#E9EAE7] dark:border-white/10 space-y-2.5 max-h-48 overflow-y-auto">
                  {voiceTranscript && (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#697681] dark:text-white/50">You:</span>
                      <p className="text-xs text-[#182B2A] dark:text-white font-medium">{voiceTranscript}</p>
                    </div>
                  )}
                  {voiceAssistantReply && (
                    <div className="pt-2 border-t border-[#E9EAE7]/60 dark:border-white/5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#245746] dark:text-[#88c5ad]">EmoSense:</span>
                      <p className="text-xs text-[#182B2A] dark:text-white/90 leading-relaxed">{voiceAssistantReply}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Controls */}
              <div className="flex items-center justify-center gap-3 pt-1">
                {voiceModeState === "speaking" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={stopSpeaking}
                    className="rounded-2xl border-[#E9EAE7] text-xs font-bold gap-1.5"
                  >
                    <VolumeX className="w-3.5 h-3.5" />
                    <span>Mute Audio</span>
                  </Button>
                )}

                {voiceModeState === "idle" && (
                  <Button
                    size="sm"
                    onClick={startVoiceModeListening}
                    className="rounded-2xl bg-[#245746] hover:bg-[#1d4839] text-white text-xs font-bold gap-1.5"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Speak Next Turn</span>
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseVoiceMode}
                  className="rounded-2xl text-xs text-[#697681] hover:text-[#182B2A] font-semibold"
                >
                  Exit to Text Chat
                </Button>
              </div>

              {/* Honest architecture notice */}
              <p className="text-[10px] text-[#697681] dark:text-white/40">
                Turn-based conversational audio using browser Web Speech API & Google Gemini.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}