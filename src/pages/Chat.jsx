import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MoreVertical, Trash2, CheckCircle2, Loader2, Sparkles, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ChatMessage from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import MoodCard from "@/components/mood/MoodCard";
import StressIndicator from "@/components/mood/StressIndicator";

const quickSuggestions = [
  "I'm feeling stressed",
  "Help me relax",
  "Why do I feel anxious?",
  "Give me a breathing exercise",
];

export default function Chat() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: "assistant",
      content: "Hello! I'm EmoSense, your wellness companion. 💙\n\nI'm here to listen and help you understand your emotions. How are you feeling today? Feel free to share whatever is on your mind.",
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sessionResult, setSessionResult] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const saveMoodMutation = useMutation({
    mutationFn: (moodData) => base44.entities.MoodEntry.create(moodData),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["moodEntries"] }),
  });

  const analyzeAndRespond = async (userMessage) => {
    setIsTyping(true);
    setShowSuggestions(false);

    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are EmoSense, an empathetic AI companion focused on emotional wellness and mental health support.

The user just said: "${userMessage}"

Previous conversation context: ${JSON.stringify(messages.slice(-4).map(m => ({ role: m.role, content: m.content.substring(0, 100) })))}

Provide a warm, supportive response that:
1. Acknowledges their feelings
2. Asks follow-up questions to understand them better
3. Offers gentle support and validation

CRITICAL - MATCH YOUR RESPONSE LENGTH TO THE USER'S MESSAGE:
- If the user sends a short or casual message (1-2 sentences), reply in 1-3 sentences. Keep it natural and conversational, like texting a friend.
- If the user shares something longer or asks for deeper support, you may respond with a bit more detail, but still keep it concise.
- NEVER write long paragraphs or essays for simple messages. A short "hi" or "I'm okay" deserves a short, warm reply.
- Be genuinely supportive and never dismissive. Keep the conversation flowing naturally.`,
        response_json_schema: {
          type: "object",
          properties: {
            response: { type: "string", description: "Your empathetic response to the user" }
          }
        }
      });

      setMessages(prev => [...prev, {
        id: Date.now(),
        role: "assistant",
        content: response.response,
      }]);

    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: "assistant",
        content: "I'm here for you. Please try sharing that again — I want to make sure I understand how you're feeling.",
      }]);
    }

    setIsTyping(false);
  };

  const completeSession = async () => {
    if (messages.length <= 1) return;

    setIsAnalyzing(true);

    try {
      const conversationText = messages
        .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n\n");

      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a mental health AI analyzing a complete conversation to provide insights.

Full conversation:
${conversationText}

Analyze the ENTIRE conversation and provide:
1. Overall detected mood throughout the conversation
2. Average stress level (1-10)
3. Mood score indicating overall emotional positivity (1-10)
4. A thoughtful summary of their emotional state
5. Supportive recommendations
6. Whether professional help might be beneficial`,
        response_json_schema: {
          type: "object",
          properties: {
            overall_mood: {
              type: "string",
              enum: ["happy", "calm", "neutral", "anxious", "sad", "stressed", "angry"]
            },
            stress_level: { type: "number", description: "1-10" },
            mood_score: { type: "number", description: "1-10" },
            summary: { type: "string", description: "Thoughtful summary of their emotional journey" },
            recommendations: {
              type: "array",
              items: { type: "string" },
              description: "3-5 supportive recommendations"
            },
            suggest_professional_help: { type: "boolean" }
          }
        }
      });

      const session = await base44.entities.ChatSession.create({
        title: `Chat Session - ${new Date().toLocaleDateString()}`,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: new Date().toISOString(),
        })),
        overall_mood: analysis.overall_mood,
        session_summary: analysis.summary,
      });

      await saveMoodMutation.mutateAsync({
        mood: analysis.overall_mood,
        mood_score: analysis.mood_score,
        stress_level: analysis.stress_level,
        source: "chat",
        notes: analysis.summary.substring(0, 200),
      });

      setSessionResult(analysis);

    } catch (error) {
      console.error("Error analyzing session:", error);
    }

    setIsAnalyzing(false);
  };

  const handleSend = async (content) => {
    const userMessage = {
      id: Date.now(),
      role: "user",
      content,
    };

    setMessages(prev => [...prev, userMessage]);
    await analyzeAndRespond(content);
  };

  const handleVoiceStart = () => {
    setIsRecording(true);
  };

  const handleVoiceStop = () => {
    setIsRecording(false);
    handleSend("I'm feeling a bit overwhelmed today.");
  };

  const clearChat = () => {
    setMessages([{
      id: 1,
      role: "assistant",
      content: "Hello! I'm EmoSense, your wellness companion. 💙\n\nI'm here to listen and help you understand your emotions. How are you feeling today? Feel free to share whatever is on your mind.",
    }]);
    setShowSuggestions(true);
  };

  if (sessionResult) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-violet-50/50 via-white to-purple-50/30 px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-3"
          >
            <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center" style={{ boxShadow: "0 8px 24px -4px rgba(124,58,237,0.3)" }}>
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Session Complete</h1>
            <p className="text-slate-500">Here's your emotional wellness analysis</p>
          </motion.div>

          {/* Overall Mood */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="rounded-3xl bg-white border border-slate-100 p-6" style={{ boxShadow: "0 2px 20px -5px rgba(124,58,237,0.06)" }}>
              <h3 className="font-semibold text-slate-700 mb-4">Overall Mood</h3>
              <MoodCard mood={sessionResult.overall_mood} score={sessionResult.mood_score} source="chat" />
            </div>
          </motion.div>

          {/* Stress Level */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className="rounded-3xl bg-white border border-slate-100 p-6" style={{ boxShadow: "0 2px 20px -5px rgba(124,58,237,0.06)" }}>
              <h3 className="font-semibold text-slate-700 mb-4">Stress Level</h3>
              <StressIndicator level={sessionResult.stress_level} size="lg" />
            </div>
          </motion.div>

          {/* Summary */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="rounded-3xl bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 p-6">
              <h3 className="font-semibold text-slate-700 mb-3">Session Summary</h3>
              <p className="text-slate-600 leading-relaxed text-sm">{sessionResult.summary}</p>
            </div>
          </motion.div>

          {/* Recommendations */}
          {sessionResult.recommendations?.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <div className="rounded-3xl bg-white border border-slate-100 p-6" style={{ boxShadow: "0 2px 20px -5px rgba(124,58,237,0.06)" }}>
                <h3 className="font-semibold text-slate-700 mb-4">Recommendations</h3>
                <ul className="space-y-3">
                  {sessionResult.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-3 text-sm text-slate-600">
                      <span className="w-6 h-6 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5">
                        {index + 1}
                      </span>
                      <span className="leading-relaxed">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}

          {/* Professional Help */}
          {sessionResult.suggest_professional_help && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div className="rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 p-6">
                <h3 className="font-semibold text-amber-800 mb-2">Consider Professional Support</h3>
                <p className="text-amber-700 text-sm mb-4 leading-relaxed">
                  Based on our conversation, speaking with a mental health professional could be beneficial.
                </p>
                <Link to={createPageUrl("Doctors")}>
                  <Button className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 border-0 h-11">
                    Browse Available Doctors
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 rounded-2xl h-11 border-slate-200 text-slate-600 hover:bg-slate-50"
              onClick={() => navigate(createPageUrl("Home"))}
            >
              Go to Dashboard
            </Button>
            <Button
              className="flex-1 rounded-2xl h-11 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 border-0"
              onClick={() => {
                setSessionResult(null);
                clearChat();
              }}
            >
              Start New Chat
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-violet-50/40 via-white to-purple-50/20">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-4 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={createPageUrl("Home")}>
              <Button variant="ghost" size="icon" className="rounded-full text-slate-500 hover:bg-slate-50">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              {/* AI Orb */}
              <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center" style={{ boxShadow: "0 4px 12px -2px rgba(124,58,237,0.25)" }}>
                <motion.div
                  animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="w-5 h-5 rounded-full bg-white/30"
                />
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute inset-0 rounded-2xl border-2 border-violet-300/40"
                />
              </div>
              <div>
                <h1 className="font-semibold text-slate-800">EmoSense AI</h1>
                <p className="text-xs text-slate-400">Your wellness companion</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 1 && !isAnalyzing && (
              <Button
                onClick={completeSession}
                size="sm"
                className="rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 border-0"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Complete Session
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full text-slate-400 hover:bg-slate-50">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={clearChat} className="text-rose-600">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear Chat
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-5">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message.content}
              isUser={message.role === "user"}
            />
          ))}

          {isTyping && (
            <ChatMessage
              message=""
              isUser={false}
              isTyping={true}
            />
          )}

          {/* Quick Suggestions */}
          {showSuggestions && messages.length <= 1 && !isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="pt-2"
            >
              <p className="text-xs text-slate-400 font-medium mb-3 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Quick suggestions
              </p>
              <div className="flex flex-wrap gap-2">
                {quickSuggestions.map((suggestion) => (
                  <motion.button
                    key={suggestion}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleSend(suggestion)}
                    className="px-4 py-2.5 rounded-2xl bg-white border border-slate-100 text-sm text-slate-600 hover:border-violet-200 hover:text-violet-600 transition-all"
                    style={{ boxShadow: "0 2px 8px -2px rgba(124,58,237,0.05)" }}
                  >
                    {suggestion}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {isAnalyzing && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 py-12"
            >
              <div className="relative">
                <motion.div
                  animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-full bg-violet-200"
                  style={{ width: 80, height: 80, left: -8, top: -8 }}
                />
                <Loader2 className="w-16 h-16 text-violet-500 animate-spin relative" />
              </div>
              <div className="text-center">
                <p className="text-slate-600 font-medium">Analyzing your conversation...</p>
                <p className="text-sm text-slate-400 mt-1">This may take a moment</p>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 py-4 bg-white/80 backdrop-blur-xl border-t border-slate-100">
        <div className="max-w-2xl mx-auto">
          <ChatInput
            onSend={handleSend}
            onVoiceStart={handleVoiceStart}
            onVoiceStop={handleVoiceStop}
            isRecording={isRecording}
            disabled={isTyping || isAnalyzing}
          />
          <div className="flex items-center justify-center gap-1.5 mt-3">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-300" />
            <p className="text-[11px] text-slate-400">Your conversations are private and secure</p>
          </div>
        </div>
      </div>
    </div>
  );
}