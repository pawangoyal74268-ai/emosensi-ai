import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import apiClient, { ApiError } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Sparkles,
  TrendingUp,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Smile
} from "lucide-react";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import QuickActions from "@/components/dashboard/QuickActions";
import MoodChart from "@/components/dashboard/MoodChart";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const moodChoices = [
  { id: "happy", label: "Happy", emoji: "😊", bg: "hover:bg-amber-50 active:bg-amber-100", activeBg: "bg-amber-100 text-amber-900 border-amber-300 shadow-sm" },
  { id: "calm", label: "Calm", emoji: "😌", bg: "hover:bg-teal-50 active:bg-teal-100", activeBg: "bg-teal-100 text-teal-900 border-teal-300 shadow-sm" },
  { id: "neutral", label: "Neutral", emoji: "😐", bg: "hover:bg-slate-100 active:bg-slate-200", activeBg: "bg-slate-200 text-slate-800 border-slate-300 shadow-sm" },
  { id: "sad", label: "Sad", emoji: "😢", bg: "hover:bg-blue-50 active:bg-blue-100", activeBg: "bg-blue-100 text-blue-900 border-blue-300 shadow-sm" },
  { id: "anxious", label: "Anxious", emoji: "😰", bg: "hover:bg-purple-50 active:bg-purple-100", activeBg: "bg-purple-100 text-purple-900 border-purple-300 shadow-sm" },
  { id: "stressed", label: "Stressed", emoji: "😫", bg: "hover:bg-rose-50 active:bg-rose-100", activeBg: "bg-rose-100 text-rose-900 border-rose-300 shadow-sm" },
];

export default function Home() {
  const { user: authUser, isAuthenticated, openAuthModal } = useAuth();
  const queryClient = useQueryClient();

  // Mood Check-in state
  const [selectedMood, setSelectedMood] = useState("calm");
  const [stressLevel, setStressLevel] = useState(3);
  const [moodNote, setMoodNote] = useState("");
  const [isCheckinSaved, setIsCheckinSaved] = useState(false);

  // Queries
  const { data: moodEntries = [] } = useQuery({
    queryKey: ["moodEntries", isAuthenticated],
    queryFn: async () => {
      if (!isAuthenticated) return [];
      try {
        const res = await apiClient.moods.list({ limit: 30 });
        return res.entries || res.data || [];
      } catch (err) {
        console.warn("[Home] Mood entries fetch notice:", err.message);
        return [];
      }
    },
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments", isAuthenticated],
    queryFn: async () => {
      if (!isAuthenticated) return [];
      try {
        const res = await apiClient.appointments.list({ status: "scheduled", limit: 3 });
        return res.appointments || res.data || [];
      } catch (err) {
        console.warn("[Home] Appointments fetch notice:", err.message);
        return [];
      }
    },
  });

  // Save Mood Check-in Mutation
  const saveMoodMutation = useMutation({
    mutationFn: /** @param {import('@/types').MoodCheckinInput} data */ async (data) => {
      if (!isAuthenticated) {
        throw new ApiError("Please sign in to record your daily check-in.", 401);
      }
      return await apiClient.moods.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moodEntries"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      setIsCheckinSaved(true);
      setMoodNote("");
      toast.success("Daily mood check-in recorded!");
      setTimeout(() => setIsCheckinSaved(false), 4000);
    },
    onError: (err) => {
      const appErr = /** @type {import('@/types').AppError} */ (err);
      if (appErr?.status === 401) {
        toast.error("Please sign in to save your mood check-in.");
        openAuthModal();
      } else {
        toast.error(appErr?.message || "Failed to record mood check-in.");
      }
    },
  });

  const handleSaveMood = (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    // Calculate a balanced 1-10 mood score based on choice
    /** @type {Record<string, number>} */
    const moodScores = { happy: 9, calm: 8, neutral: 6, sad: 4, anxious: 3, stressed: 2 };
    saveMoodMutation.mutate({
      mood: selectedMood,
      mood_score: moodScores[selectedMood] || 6,
      stress_level: stressLevel,
      source: "manual",
      notes: moodNote.trim() || undefined,
    });
  };

  // Metrics (computed strictly from real data)
  const totalEntries = moodEntries.length;
  const latestMood = moodEntries[0];
  const avgStressNum = totalEntries > 0
    ? moodEntries.reduce((sum, e) => sum + (e.stress_level || 5), 0) / totalEntries
    : null;
  const averageStress = avgStressNum !== null ? avgStressNum.toFixed(1) : null;

  const stressTier = avgStressNum !== null
    ? (avgStressNum <= 3.5 ? "Low Stress" : avgStressNum <= 5.5 ? "Moderate" : avgStressNum <= 7.5 ? "Elevated" : "High")
    : null;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const displayName = authUser?.name
    ? authUser.name.split(" ")[0]
    : (authUser?.email ? authUser.email.split("@")[0] : "");

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-6">
      {/* A. Welcome Section with Soothing Landscape Artwork */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#245746] via-[#225040] to-[#173a2f] text-white p-6 sm:p-8 shadow-md"
      >
        {/* Subtle decorative background artwork — gentle rolling hills & sun */}
        <div className="absolute inset-0 pointer-events-none opacity-20 dark:opacity-15 overflow-hidden">
          <svg
            className="absolute bottom-0 right-0 w-full sm:w-[480px] h-full object-cover"
            viewBox="0 0 500 240"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
          >
            <circle cx="410" cy="70" r="50" fill="#FCE7C8" />
            <path
              d="M0 240C90 200 180 230 270 210C360 190 430 220 500 240V240H0Z"
              fill="#DDE8DF"
              fillOpacity="0.8"
            />
            <path
              d="M0 240C120 180 230 210 330 170C410 140 460 180 500 240V240H0Z"
              fill="#F7F5F0"
              fillOpacity="0.4"
            />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2 max-w-lg">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-[#DDE8DF] text-[11px] font-semibold backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5 text-[#DDE8DF]" />
              <span>Daily Emotional Self-Care</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight">
              {getGreeting()}{displayName ? `, ${displayName}` : ""}
            </h1>
            <p className="text-xs sm:text-sm text-white/85 leading-relaxed">
              Take a gentle breath. Check in with how you are truly feeling right now, without judgment.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1 sm:pt-0">
            <Link to={createPageUrl("Chat")}>
              <button
                className="h-10 px-4 rounded-full bg-[#DDE8DF] text-[#245746] text-xs font-bold shadow-sm hover:bg-white transition-all active:scale-95 flex items-center gap-2"
              >
                <span>Talk with AI</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* B. AI Analysis Shortcuts */}
      <QuickActions />

      {/* C. Daily Mood Check-in Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card-wellness p-5 sm:p-7 space-y-5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#DDE8DF] text-[#245746] flex items-center justify-center font-bold">
              <Smile className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-heading font-bold text-[#182B2A] dark:text-white">
                Daily Mood Check-in
              </h2>
              <p className="text-xs text-[#697681] dark:text-white/60">
                How is your emotional landscape right now?
              </p>
            </div>
          </div>
          {latestMood && (
            <span className="hidden xs:inline-block text-[11px] text-[#697681] dark:text-white/50">
              Last tracked {format(new Date(latestMood.created_date), "MMM d")}
            </span>
          )}
        </div>

        {/* 6 Mood Choices */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-2.5">
          {moodChoices.map((choice) => {
            const isSelected = selectedMood === choice.id;
            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => setSelectedMood(choice.id)}
                className={cn(
                  "flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-150 min-h-[68px] focus:outline-none",
                  isSelected
                    ? choice.activeBg
                    : "bg-[#F7F5F0]/60 dark:bg-white/5 border-[#E9EAE7] dark:border-white/10 text-[#182B2A] dark:text-white " + choice.bg
                )}
                aria-pressed={isSelected}
              >
                <span className="text-2xl sm:text-3xl transition-transform active:scale-125 mb-1">
                  {choice.emoji}
                </span>
                <span className="text-[11px] font-semibold capitalize leading-none">
                  {choice.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Interactive Stress Slider */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-[#182B2A] dark:text-white font-semibold">Perceived Stress Level</span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#DDE8DF]/60 dark:bg-white/10 text-[#245746] dark:text-[#88c5ad] font-bold">
              {stressLevel} / 10 • {stressLevel <= 3 ? "Low" : stressLevel <= 5 ? "Moderate" : stressLevel <= 7 ? "Elevated" : "High"}
            </span>
          </div>
          <Slider
            value={[stressLevel]}
            onValueChange={(val) => setStressLevel(val[0])}
            min={1}
            max={10}
            step={1}
            className="py-1"
          />
          <div className="flex justify-between text-[10px] text-[#697681] dark:text-white/50">
            <span>Relaxed (1)</span>
            <span>Balanced (5)</span>
            <span>Overwhelmed (10)</span>
          </div>
        </div>

        {/* Optional Note Field */}
        <div className="space-y-1.5">
          <label htmlFor="mood-note-input" className="text-xs font-medium text-[#697681] dark:text-white/60">
            Add a personal note or reflection (optional):
          </label>
          <input
            id="mood-note-input"
            type="text"
            value={moodNote}
            onChange={(e) => setMoodNote(e.target.value.slice(0, 200))}
            placeholder="e.g. Taking time for a walk, feeling peaceful..."
            className="w-full h-11 px-4 rounded-2xl bg-[#F7F5F0]/70 dark:bg-black/20 border border-[#E9EAE7] dark:border-white/10 text-xs sm:text-sm text-[#182B2A] dark:text-white placeholder:text-[#697681]/60 focus:outline-none focus:border-[#245746]"
          />
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between pt-1">
          {isCheckinSaved ? (
            <div className="inline-flex items-center gap-2 text-xs font-bold text-[#245746] dark:text-[#88c5ad]">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Check-in saved to your health history!</span>
            </div>
          ) : (
            <p className="text-[11px] text-[#697681] dark:text-white/50">
              Recorded in your private wellness log
            </p>
          )}

          <Button
            onClick={handleSaveMood}
            disabled={saveMoodMutation.isPending}
            className="h-11 px-6 rounded-2xl bg-[#245746] hover:bg-[#1d4839] text-white text-xs font-bold shadow-sm transition-all active:scale-95 min-h-[44px]"
          >
            {saveMoodMutation.isPending ? "Saving..." : "Save Today's Mood"}
          </Button>
        </div>
      </motion.div>

      {/* D. Weekly Mood Trends */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="card-wellness p-5 sm:p-7 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#E4EDFC] text-[#284f88] flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-heading font-bold text-[#182B2A] dark:text-white">
                Weekly Mood Trends
              </h2>
              <p className="text-xs text-[#697681] dark:text-white/60">
                Tracked from your authentic check-ins and scans
              </p>
            </div>
          </div>

          {/* Genuine Real Metrics */}
          {totalEntries > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <span className="px-3 py-1 rounded-full bg-[#DDE8DF]/50 dark:bg-white/10 text-[#245746] dark:text-[#88c5ad] font-semibold">
                Avg Stress: {averageStress}/10 ({stressTier})
              </span>
              <span className="text-[#697681] dark:text-white/50">
                {totalEntries} check-in{totalEntries > 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        <MoodChart entries={moodEntries} />
      </motion.div>

      {/* E. Recent Activity & F. Upcoming Appointments (Responsive 2-column on larger screens) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* E. Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card-wellness p-5 space-y-3.5 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#245746] dark:text-[#88c5ad]" />
                <h3 className="text-sm font-heading font-bold text-[#182B2A] dark:text-white">
                  Recent Activity
                </h3>
              </div>
              <Link
                to={createPageUrl("History")}
                className="text-xs font-semibold text-[#245746] dark:text-[#88c5ad] hover:underline"
              >
                All history →
              </Link>
            </div>

            {moodEntries.length > 0 ? (
              <div className="space-y-2">
                {moodEntries.slice(0, 3).map((entry) => {
                  const matchChoice = moodChoices.find((c) => c.id === entry.mood);
                  return (
                    <div
                      key={entry.id}
                      className="p-3 rounded-2xl bg-[#F7F5F0]/80 dark:bg-white/5 border border-[#E9EAE7] dark:border-white/5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">
                          {matchChoice?.emoji || "✨"}
                        </span>
                        <div>
                          <p className="font-bold text-[#182B2A] dark:text-white capitalize">
                            {entry.mood}
                          </p>
                          <p className="text-[10px] text-[#697681] dark:text-white/60 capitalize">
                            via {entry.source || "check-in"} • Stress: {entry.stress_level || 5}/10
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] text-[#697681] dark:text-white/50">
                        {format(new Date(entry.created_date), "MMM d, h:mm a")}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center rounded-2xl bg-[#F7F5F0]/50 dark:bg-white/5 border border-dashed border-[#E9EAE7] dark:border-white/10 text-xs text-[#697681] dark:text-white/60 space-y-1">
                <p className="font-semibold text-[#182B2A] dark:text-white">No activity records yet</p>
                <p className="text-[11px]">Save a mood check-in or complete an AI face/voice scan to begin.</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* F. Upcoming Appointments */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="card-wellness p-5 space-y-3.5 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#284f88] dark:text-[#a0c2f8]" />
                <h3 className="text-sm font-heading font-bold text-[#182B2A] dark:text-white">
                  Upcoming Consultations
                </h3>
              </div>
              <Link
                to={createPageUrl("Doctors")}
                className="text-xs font-semibold text-[#245746] dark:text-[#88c5ad] hover:underline"
              >
                Find doctor →
              </Link>
            </div>

            {appointments.length > 0 ? (
              <div className="space-y-2">
                {appointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="p-3.5 rounded-2xl bg-[#E4EDFC]/40 dark:bg-white/5 border border-[#E4EDFC] dark:border-white/10 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <p className="font-bold text-[#182B2A] dark:text-white">
                        {apt.doctor_name || "Specialist Consultation"}
                      </p>
                      <p className="text-[11px] text-[#697681] dark:text-white/60">
                        {format(new Date(apt.date), "EEE, MMM d")} at {apt.time}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#245746] text-white capitalize">
                      {apt.type || "Video"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center rounded-2xl bg-[#F7F5F0]/50 dark:bg-white/5 border border-dashed border-[#E9EAE7] dark:border-white/10 text-xs text-[#697681] dark:text-white/60 space-y-2">
                <p className="font-semibold text-[#182B2A] dark:text-white">No upcoming sessions</p>
                <p className="text-[11px]">Connect with licensed psychologists, counselors, and wellness coaches.</p>
                <Link to={createPageUrl("Doctors")} className="inline-block pt-1">
                  <button className="h-8 px-3.5 rounded-full bg-[#245746] text-white text-[11px] font-bold">
                    Browse Specialists
                  </button>
                </Link>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Trust & Clinical Disclaimer Footer */}
      <div className="flex items-center justify-center gap-2 py-2 text-xs text-[#697681] dark:text-white/50 text-center">
        <ShieldCheck className="w-4 h-4 text-[#245746] dark:text-[#88c5ad]" />
        <span>EmoSense AI is for wellness self-awareness and does not provide clinical diagnoses.</span>
      </div>
    </div>
  );
}