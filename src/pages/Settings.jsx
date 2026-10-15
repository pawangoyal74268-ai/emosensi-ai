import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Moon,
  Sun,
  ShieldCheck,
  User,
  LogOut,
  LogIn,
  Heart,
  Brain,
  Trash2,
  Sparkles,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import apiClient from "@/api/apiClient";

export default function Settings() {
  const { user, isAuthenticated, logout, openAuthModal } = useAuth();
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });

  // Long-Term AI Memory state
  const [memories, setMemories] = useState([]);
  const [isLoadingMemories, setIsLoadingMemories] = useState(false);
  const [memoryError, setMemoryError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    localStorage.setItem("theme", darkMode ? "dark" : "light");
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  const fetchMemories = useCallback(async () => {
    if (!isAuthenticated) {
      setMemories([]);
      return;
    }
    setIsLoadingMemories(true);
    setMemoryError(null);
    try {
      const res = await apiClient.memory.list();
      if (res && Array.isArray(res.memories)) {
        setMemories(res.memories);
      } else {
        setMemories([]);
      }
    } catch (err) {
      console.warn("[Settings] Failed to fetch memories:", err);
      setMemoryError("Could not load AI memories. Please try again.");
    } finally {
      setIsLoadingMemories(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  const handleDeleteMemory = async (id) => {
    setDeletingId(id);
    try {
      await apiClient.memory.delete(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error("[Settings] Failed to delete memory:", err);
      alert("Failed to delete memory. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAllMemories = async () => {
    setIsClearing(true);
    try {
      await apiClient.memory.clearAll();
      setMemories([]);
      setShowClearConfirm(false);
    } catch (err) {
      console.error("[Settings] Failed to clear all memories:", err);
      alert("Failed to clear memories. Please try again.");
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5">
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
            Profile & Settings
          </h1>
          <p className="text-xs sm:text-sm text-[#697681] dark:text-white/60">
            Account preferences, security, and application display
          </p>
        </div>
      </div>

      {/* Account Profile Card */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#697681] dark:text-white/50 px-1">
          Account Profile
        </span>
        <div className="card-wellness p-5 space-y-4">
          {isAuthenticated ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#245746] text-[#DDE8DF] flex items-center justify-center font-bold text-lg shadow-sm">
                  {(user?.name || user?.email || "U")[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-heading font-bold text-sm text-[#182B2A] dark:text-white">
                    {user?.name || "EmoSense Member"}
                  </p>
                  <p className="text-xs text-[#697681] dark:text-white/60">{user?.email}</p>
                  <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#DDE8DF] text-[#245746] dark:bg-white/15 dark:text-[#88c5ad]">
                    HTTP-Only Session
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                className="rounded-2xl border-[#E9EAE7] dark:border-white/10 text-rose-600 hover:bg-rose-50 text-xs font-semibold h-10 px-3.5"
              >
                <LogOut className="w-3.5 h-3.5 mr-1.5" />
                Sign Out
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#F7F5F0] dark:bg-white/5 flex items-center justify-center text-[#697681]">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-xs sm:text-sm text-[#182B2A] dark:text-white">Guest Visitor</p>
                  <p className="text-[11px] text-[#697681] dark:text-white/60">
                    Sign in to sync your mood check-ins & appointments.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={openAuthModal}
                className="rounded-2xl bg-[#245746] hover:bg-[#1d4839] text-white text-xs font-bold h-10 px-4"
              >
                <LogIn className="w-3.5 h-3.5 mr-1.5" />
                Sign In
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* AI Long-Term Memory Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#697681] dark:text-white/50">
            What EmoSense Remembers (AI Memory)
          </span>
          {isAuthenticated && memories.length > 0 && !showClearConfirm && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:underline flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Clear All
            </button>
          )}
        </div>

        <div className="card-wellness p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F7F5F0] dark:bg-white/5 flex items-center justify-center text-[#245746] dark:text-[#88c5ad] flex-shrink-0">
              <Brain className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-xs sm:text-sm text-[#182B2A] dark:text-white">
                Personalized Long-Term Memory
              </p>
              <p className="text-[11px] text-[#697681] dark:text-white/60 mt-0.5 leading-relaxed">
                EmoSense remembers non-sensitive personal context (such as your current projects, learning goals, and conversation preferences) to provide continuity across different chat sessions.
              </p>
            </div>
            {isAuthenticated && (
              <button
                onClick={fetchMemories}
                disabled={isLoadingMemories}
                title="Refresh memories"
                aria-label="Refresh memories"
                className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-[#697681] dark:text-white/60 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMemories ? "animate-spin" : ""}`} />
              </button>
            )}
          </div>

          {!isAuthenticated ? (
            <div className="p-3.5 rounded-2xl bg-[#F7F5F0] dark:bg-white/5 border border-[#E9EAE7] dark:border-white/10 text-center">
              <p className="text-xs text-[#697681] dark:text-white/60">
                Sign in to view and manage your personalized AI memories.
              </p>
            </div>
          ) : (
            <>
              {/* Clear confirmation alert banner */}
              {showClearConfirm && (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 space-y-2">
                  <div className="flex items-start gap-2 text-rose-700 dark:text-rose-300">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <p className="text-xs font-semibold">
                      Are you sure you want to clear all remembered facts? This cannot be undone.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-1 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowClearConfirm(false)}
                      className="text-xs h-8 px-3 text-[#697681] hover:text-[#182B2A]"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleClearAllMemories}
                      disabled={isClearing}
                      className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold h-8 px-3 rounded-xl"
                    >
                      {isClearing ? "Clearing..." : "Yes, Clear All"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Memory List or States */}
              {isLoadingMemories && memories.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#697681] dark:text-white/50 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#245746] dark:text-[#88c5ad]" />
                  Loading your AI memories...
                </div>
              ) : memoryError ? (
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-xs">
                  {memoryError}
                </div>
              ) : memories.length === 0 ? (
                <div className="p-4 rounded-2xl bg-[#F7F5F0] dark:bg-white/5 border border-[#E9EAE7] dark:border-white/10 text-center space-y-1.5">
                  <Sparkles className="w-5 h-5 mx-auto text-[#245746] dark:text-[#88c5ad]" />
                  <p className="text-xs font-bold text-[#182B2A] dark:text-white">
                    No saved memories yet
                  </p>
                  <p className="text-[11px] text-[#697681] dark:text-white/50 max-w-xs mx-auto">
                    When you talk to EmoSense about ongoing projects, study goals, or preferences, important facts will appear here to personalize future conversations.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {memories.map((mem) => (
                    <div
                      key={mem.id}
                      className="p-3 rounded-2xl bg-[#F7F5F0] dark:bg-white/5 border border-[#E9EAE7] dark:border-white/10 flex items-start justify-between gap-3 group hover:border-[#245746]/30 transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#DDE8DF] text-[#245746] dark:bg-white/15 dark:text-[#88c5ad]">
                            {mem.category || "fact"}
                          </span>
                          <span className="text-[10px] text-[#697681] dark:text-white/40">
                            {new Date(mem.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-[#182B2A] dark:text-white leading-relaxed break-words">
                          {mem.content}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteMemory(mem.id)}
                        disabled={deletingId === mem.id}
                        title="Delete this memory"
                        aria-label="Delete this memory"
                        className="p-1.5 rounded-xl text-[#697681] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 dark:text-white/50 transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Privacy safeguards note */}
              <div className="pt-2 border-t border-[#E9EAE7] dark:border-white/10 flex items-start gap-2 text-[10px] text-[#697681] dark:text-white/50">
                <ShieldCheck className="w-3.5 h-3.5 text-[#245746] dark:text-[#88c5ad] flex-shrink-0 mt-0.5" />
                <p>
                  <strong>Privacy Safeguards:</strong> Passwords, API keys, and sensitive health diagnoses are strictly excluded from persistent memory. You can ask EmoSense to &ldquo;forget that&rdquo; in chat at any time.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Appearance & Theme */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#697681] dark:text-white/50 px-1">
          Appearance
        </span>
        <div className="card-wellness p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-[#F7F5F0] dark:bg-white/5 flex items-center justify-center text-[#182B2A] dark:text-white">
                {darkMode ? <Moon className="w-5 h-5 text-indigo-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
              </div>
              <div>
                <p className="font-bold text-xs sm:text-sm text-[#182B2A] dark:text-white">Theme Mode</p>
                <p className="text-[11px] text-[#697681] dark:text-white/60">
                  {darkMode ? "Dark forest theme active" : "Warm ivory theme active"}
                </p>
              </div>
            </div>
            <Switch checked={darkMode} onCheckedChange={setDarkMode} aria-label="Toggle dark mode" />
          </div>
        </div>
      </div>

      {/* Security & Clinical Privacy */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#697681] dark:text-white/50 px-1">
          Security & Privacy
        </span>
        <div className="card-wellness p-5 space-y-3.5 text-xs">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-[#245746] dark:text-[#88c5ad] flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#182B2A] dark:text-white">Per-User Data Isolation</p>
              <p className="text-[11px] text-[#697681] dark:text-white/60 mt-0.5">
                Every mood check-in, chat session, and personal AI memory is strictly scoped to your private account.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 pt-2 border-t border-[#E9EAE7] dark:border-white/10">
            <Heart className="w-4 h-4 text-[#245746] dark:text-[#88c5ad] flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#182B2A] dark:text-white">In-Memory Image & Voice Processing</p>
              <p className="text-[11px] text-[#697681] dark:text-white/60 mt-0.5">
                Camera captures and audio check-ins are evaluated in-memory and never written to permanent disk storage.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Clinical Disclaimer Box */}
      <div className="p-4 rounded-3xl bg-[#F7F5F0] dark:bg-white/5 border border-[#E9EAE7] dark:border-white/10 text-center space-y-1">
        <p className="text-xs font-bold text-[#182B2A] dark:text-white">Clinical Disclaimer</p>
        <p className="text-[11px] text-[#697681] dark:text-white/50 leading-relaxed">
          EmoSense AI provides supportive emotional insights for self-awareness. It does not offer clinical diagnoses or psychiatric evaluation. If you are in crisis, please seek immediate professional assistance or emergency health services.
        </p>
      </div>
    </div>
  );
}