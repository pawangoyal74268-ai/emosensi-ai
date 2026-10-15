import { useState } from "react";
import apiClient from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  MessageCircle,
  Mic,
  Camera,
  Hand,
  FileText,
  TrendingUp,
  LogIn,
  Filter,
  ShieldCheck,
  Smile,
  Clock,
  ArrowRight,
  Trash2,
  Plus,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import MoodCard from "@/components/mood/MoodCard";
import MoodChart from "@/components/dashboard/MoodChart";
import { cn } from "@/lib/utils";

const filterOptions = [
  { value: "all", label: "All Sources", icon: Filter },
  { value: "chat", label: "AI Conversations", icon: MessageCircle },
  { value: "manual", label: "Check-in", icon: Hand },
  { value: "face", label: "Face Scan", icon: Camera },
  { value: "voice", label: "Voice", icon: Mic },
  { value: "text", label: "Journal Text", icon: FileText },
];

export default function History() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [filter, setFilter] = useState("all");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: moodEntries = [] } = useQuery({
    queryKey: ["moodEntries", isAuthenticated],
    queryFn: async () => {
      if (!isAuthenticated) return [];
      try {
        const res = await apiClient.moods.list({ limit: 100 });
        return res.entries || res.data || [];
      } catch (err) {
        console.warn("[History] Mood entries fetch notice:", err.message);
        return [];
      }
    },
  });

  const { data: chatSessions = [], isLoading: isLoadingChat } = useQuery({
    queryKey: ["chatSessions", isAuthenticated],
    queryFn: async () => {
      if (!isAuthenticated) return [];
      try {
        const res = await apiClient.chat.listSessions();
        return res.sessions || res.data || [];
      } catch (err) {
        console.warn("[History] Chat sessions fetch notice:", err.message);
        return [];
      }
    },
  });

  const handleDeleteSession = async (sessionId) => {
    try {
      await apiClient.chat.deleteSession(sessionId);
      queryClient.invalidateQueries({ queryKey: ["chatSessions"] });
      // If deleted session was stored as active in localStorage, clear it
      if (typeof window !== "undefined" && localStorage.getItem("emosense_active_chat_session") === sessionId) {
        localStorage.removeItem("emosense_active_chat_session");
      }
      toast.success("Conversation deleted.");
    } catch (err) {
      console.error("[History] Delete chat session error:", err.message);
      toast.error(err?.data?.error?.message || err?.message || "Failed to delete conversation.");
    }
  };

  const handleOpenConversation = (sessionId) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("emosense_active_chat_session", sessionId);
    }
    navigate(`/Chat?session=${sessionId}`);
  };

  const handleStartNewChat = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("emosense_active_chat_session");
    }
    navigate("/Chat");
  };

  const filteredEntries = filter === "all"
    ? moodEntries
    : moodEntries.filter((e) => e.source === filter);

  // Group by day
  const groupedEntries = filteredEntries.reduce((groups, entry) => {
    const date = format(new Date(entry.created_date), "yyyy-MM-dd");
    if (!groups[date]) groups[date] = [];
    groups[date].push(entry);
    return groups;
  }, {});

  // Compute metrics strictly from authenticated user data
  const totalCount = moodEntries.length;
  const avgStressNum = totalCount > 0
    ? moodEntries.reduce((acc, e) => acc + (e.stress_level || 5), 0) / totalCount
    : null;
  const avgStress = avgStressNum !== null ? avgStressNum.toFixed(1) : "—";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3.5">
        <Link to={createPageUrl("Home")}>
          <button
            className="w-10 h-10 rounded-2xl bg-white dark:bg-white/10 border border-[#E9EAE7] dark:border-white/10 flex items-center justify-center text-[#182B2A] dark:text-white hover:border-[#245746]/40 transition-colors shadow-sm active:scale-95"
            aria-label="Back to Home"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-heading font-bold text-[#182B2A] dark:text-white">
            Emotional History
          </h1>
          <p className="text-xs sm:text-sm text-[#697681] dark:text-white/60">
            Review past mood trends, stress indicators, and multimodal sessions
          </p>
        </div>
      </div>

      {!isAuthenticated && (
        <div className="p-4 rounded-2xl bg-[#DDE8DF]/70 dark:bg-[#1a2e26] border border-[#DDE8DF] dark:border-white/10 flex items-center justify-between gap-3 text-[#182B2A] dark:text-white text-xs sm:text-sm shadow-sm">
          <div className="flex items-center gap-2.5">
            <LogIn className="w-4 h-4 text-[#245746] dark:text-[#88c5ad] flex-shrink-0" />
            <span>Sign in to view your complete private history and personalized trends.</span>
          </div>
          <button
            onClick={openAuthModal}
            className="px-3 py-1.5 rounded-xl bg-[#245746] text-white text-xs font-semibold flex-shrink-0 active:scale-95"
          >
            Sign In
          </button>
        </div>
      )}

      {/* Summary Cards */}
      {totalCount > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="card-wellness p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#697681] dark:text-white/60">
              Total Records
            </span>
            <p className="text-2xl font-heading font-bold text-[#182B2A] dark:text-white mt-1">
              {totalCount}
            </p>
            <span className="text-[11px] text-[#245746] dark:text-[#88c5ad] font-medium">Logged check-ins</span>
          </div>

          <div className="card-wellness p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#697681] dark:text-white/60">
              Average Stress
            </span>
            <p className="text-2xl font-heading font-bold text-[#182B2A] dark:text-white mt-1">
              {avgStress} <span className="text-xs text-[#697681] font-normal">/ 10</span>
            </p>
            <span className="text-[11px] text-[#697681] dark:text-white/60">
              {avgStressNum !== null ? (avgStressNum <= 3.5 ? "Low range" : avgStressNum <= 6 ? "Moderate range" : "Elevated range") : "No records"}
            </span>
          </div>

          <div className="card-wellness p-4 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#697681] dark:text-white/60">
              Latest Emotion
            </span>
            <p className="text-2xl font-heading font-bold capitalize text-[#182B2A] dark:text-white mt-1">
              {moodEntries[0]?.mood || "—"}
            </p>
            <span className="text-[11px] text-[#697681] dark:text-white/60">
              via {moodEntries[0]?.source || "check-in"}
            </span>
          </div>
        </div>
      )}

      {/* Trend Chart */}
      <div className="card-wellness p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#245746] dark:text-[#88c5ad]" />
            <h2 className="text-sm font-heading font-bold text-[#182B2A] dark:text-white">
              Mood & Stress Progression
            </h2>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-[#697681] dark:text-white/60">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#245746] dark:bg-[#88c5ad]" />
              Mood
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#d97706]" />
              Stress
            </span>
          </div>
        </div>
        <MoodChart entries={moodEntries} />
      </div>

      {/* Filter Chips — Touch Friendly */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {filterOptions.map(({ value, label, icon: Icon }) => {
            const isActive = filter === value;
            return (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 min-h-[38px] active:scale-95",
                  isActive
                    ? "bg-[#245746] text-white shadow-xs"
                    : "bg-white dark:bg-white/10 text-[#697681] dark:text-white/70 border border-[#E9EAE7] dark:border-white/10 hover:border-[#245746]/30"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SAVED AI CONVERSATIONS VIEW (when filter === 'chat') */}
      {filter === "chat" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-[#245746] dark:text-[#88c5ad]" />
              <h2 className="text-sm font-heading font-bold text-[#182B2A] dark:text-white">
                Saved AI Conversations ({chatSessions.length})
              </h2>
            </div>
            <button
              onClick={handleStartNewChat}
              className="px-3 py-1.5 rounded-full bg-[#245746] hover:bg-[#1d4839] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 text-[#DDE8DF]" />
              <span>New Conversation</span>
            </button>
          </div>

          {chatSessions.length > 0 ? (
            <div className="space-y-3">
              {chatSessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => handleOpenConversation(session.id)}
                  className="card-wellness p-4 sm:p-5 flex flex-col gap-2.5 cursor-pointer hover:border-[#245746]/50 transition-all shadow-xs group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-2xl bg-[#DDE8DF] dark:bg-white/10 text-[#245746] dark:text-[#88c5ad] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                        <MessageCircle className="w-4 h-4" />
                      </div>
                      <h3 className="font-heading font-bold text-xs sm:text-sm text-[#182B2A] dark:text-white truncate group-hover:text-[#245746] dark:group-hover:text-[#88c5ad] transition-colors">
                        {session.title || "Conversational Reflection"}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {(session.messageCount > 0 || session.messages?.length > 0) && (
                        <span className="px-2 py-0.5 rounded-full bg-[#E9EAE7] dark:bg-white/10 text-[10px] font-semibold text-[#697681] dark:text-white/60">
                          {session.messageCount || session.messages?.length} messages
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(session.id);
                        }}
                        className="w-7 h-7 rounded-xl text-[#697681] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors"
                        title="Delete conversation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {session.preview && (
                    <p className="text-xs text-[#697681] dark:text-white/70 line-clamp-2 leading-relaxed">
                      {session.preview}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-[#697681] dark:text-white/50 pt-1 border-t border-[#E9EAE7]/50 dark:border-white/5">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{format(new Date(session.updatedAt || session.createdAt), "MMM d, yyyy • h:mm a")}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-[#245746] dark:text-[#88c5ad] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      Open conversation <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card-wellness p-8 text-center space-y-3">
              <MessageCircle className="w-8 h-8 mx-auto text-[#697681]/40" />
              <h3 className="text-sm font-bold text-[#182B2A] dark:text-white">
                No saved conversations yet
              </h3>
              <p className="text-xs text-[#697681] dark:text-white/60 max-w-sm mx-auto">
                Chat with the EmoSense AI assistant to explore concepts, discuss your feelings, or ask questions. All conversations are safely saved here.
              </p>
              <div className="pt-2">
                <Button
                  onClick={handleStartNewChat}
                  className="h-10 px-5 rounded-2xl bg-[#245746] text-white text-xs font-semibold"
                >
                  Start a Conversation
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent AI Conversations Section (when filter === 'all') */}
      {filter === "all" && chatSessions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#245746] dark:text-[#88c5ad]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#697681] dark:text-white/60">
                Recent AI Conversations
              </h2>
            </div>
            <button
              onClick={() => setFilter("chat")}
              className="text-xs font-semibold text-[#245746] dark:text-[#88c5ad] hover:underline flex items-center gap-1"
            >
              <span>View all ({chatSessions.length})</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2">
            {chatSessions.slice(0, 3).map((session) => (
              <div
                key={session.id}
                onClick={() => handleOpenConversation(session.id)}
                className="card-wellness p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer hover:border-[#245746]/50 transition-all shadow-xs group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-2xl bg-[#DDE8DF] dark:bg-white/10 text-[#245746] dark:text-[#88c5ad] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-heading font-bold text-xs text-[#182B2A] dark:text-white truncate group-hover:text-[#245746] dark:group-hover:text-[#88c5ad]">
                      {session.title || "Conversational Reflection"}
                    </h4>
                    {session.preview && (
                      <p className="text-[11px] text-[#697681] dark:text-white/60 truncate max-w-md">
                        {session.preview}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 text-right flex-shrink-0">
                  <span className="text-[10px] text-[#697681] dark:text-white/50 whitespace-nowrap">
                    {format(new Date(session.updatedAt || session.createdAt), "MMM d • h:mm a")}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#245746] dark:text-[#88c5ad] opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grouped Activity Cards (for all or specific non-chat filters) */}
      {filter !== "chat" && (
        Object.keys(groupedEntries).length > 0 ? (
          <div className="space-y-5">
            {Object.entries(groupedEntries).map(([dateStr, entries]) => (
              <div key={dateStr} className="space-y-2.5">
                <div className="flex items-center gap-2 px-1">
                  <Calendar className="w-3.5 h-3.5 text-[#697681]" />
                  <h3 className="text-xs font-bold text-[#697681] dark:text-white/60">
                    {format(new Date(dateStr), "EEEE, MMMM d, yyyy")}
                  </h3>
                </div>

                <div className="space-y-2">
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="card-wellness p-4 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <MoodCard
                          mood={entry.mood}
                          source={entry.source}
                          compact={true}
                        />
                        {entry.notes && (
                          <p className="text-[11px] text-[#697681] dark:text-white/60 line-clamp-1 italic hidden sm:inline">
                            "{entry.notes}"
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-right">
                        {entry.stress_level && (
                          <div className="hidden xs:block">
                            <span className="text-[10px] text-[#697681] dark:text-white/50 block">Stress</span>
                            <span className="font-bold text-[#182B2A] dark:text-white">{entry.stress_level}/10</span>
                          </div>
                        )}
                        <span className="text-[10px] text-[#697681] dark:text-white/50 whitespace-nowrap">
                          {format(new Date(entry.created_date), "h:mm a")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card-wellness p-8 text-center space-y-2">
            <Smile className="w-8 h-8 mx-auto text-[#697681]/40" />
            <h3 className="text-sm font-bold text-[#182B2A] dark:text-white">
              {filter === "all" ? "No mood records yet" : `No ${filter} entries found`}
            </h3>
            <p className="text-xs text-[#697681] dark:text-white/60 max-w-sm mx-auto">
              Log your daily check-in from the Home dashboard or try an AI scan to view your emotional history.
            </p>
            <div className="pt-2">
              <Link to={createPageUrl("Home")}>
                <Button className="h-10 px-5 rounded-2xl bg-[#245746] text-white text-xs font-semibold">
                  Go to Daily Check-in
                </Button>
              </Link>
            </div>
          </div>
        )
      )}

      {/* Safety Footer */}
      <div className="flex items-center justify-center gap-2 text-xs text-[#697681] dark:text-white/40 pt-2">
        <ShieldCheck className="w-4 h-4" />
        <span>All records are private and isolated to your authenticated account</span>
      </div>
    </div>
  );
}