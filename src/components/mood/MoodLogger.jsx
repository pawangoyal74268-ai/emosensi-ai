import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient, { ApiError } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { moodConfig } from "@/components/mood/MoodCard";
import { PenLine, X, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const moods = Object.keys(moodConfig);

export default function MoodLogger() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMood, setSelectedMood] = useState("calm");
  const [moodScore, setMoodScore] = useState(7);
  const [stressLevel, setStressLevel] = useState(3);
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const saveMood = useMutation({
    mutationFn: /** @param {import('@/types').MoodCheckinInput} data */ async (data) => {
      if (!isAuthenticated) {
        throw new ApiError("Please sign in to log your mood.", 401);
      }
      return await apiClient.moods.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moodEntries"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      setIsOpen(false);
      setNotes("");
      toast.success("Mood check-in recorded successfully!");
    },
    onError: (err) => {
      const appErr = /** @type {import('@/types').AppError} */ (err);
      if (appErr?.status === 401) {
        toast.error("Please sign in to record a mood check-in.");
        openAuthModal();
      } else {
        toast.error(appErr?.message || "Failed to save mood check-in.");
      }
    },
  });

  const handleSubmit = () => {
    saveMood.mutate({
      mood: selectedMood,
      mood_score: moodScore,
      stress_level: stressLevel,
      source: "manual",
      notes: notes.trim() || undefined,
    });
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center gap-3.5 p-4 sm:p-5 card-wellness text-left group transition-all duration-200 hover:-translate-y-0.5 focus:outline-none"
      >
        <div className="w-11 h-11 rounded-2xl bg-[#DDE8DF] text-[#245746] dark:bg-white/10 dark:text-[#88c5ad] flex items-center justify-center flex-shrink-0">
          <PenLine className="w-5 h-5 stroke-[2px]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-bold text-sm text-[#182B2A] dark:text-white">Quick Mood Check-in</h3>
          <p className="text-xs text-[#697681] dark:text-white/60 truncate">Log how you are feeling right now in seconds</p>
        </div>
        <span className="text-xs font-bold text-[#245746] dark:text-[#88c5ad] opacity-0 group-hover:opacity-100 transition-opacity">
          Open →
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white dark:bg-[#14231f] rounded-3xl p-6 space-y-5 border border-[#E9EAE7] dark:border-white/10 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-heading font-bold text-[#182B2A] dark:text-white">
                    How are you feeling?
                  </h2>
                  <p className="text-xs text-[#697681] dark:text-white/60">Take a moment to check in with yourself</p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-full text-[#697681] hover:text-[#182B2A] hover:bg-[#F7F5F0] dark:hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mood Selector */}
              <div className="grid grid-cols-4 gap-2">
                {moods.slice(0, 6).map((mood) => {
                  const config = moodConfig[mood];
                  const isSelected = selectedMood === mood;
                  return (
                    <button
                      key={mood}
                      type="button"
                      onClick={() => setSelectedMood(mood)}
                      className={cn(
                        "flex flex-col items-center gap-1 p-2.5 rounded-2xl transition-all border text-xs min-h-[58px]",
                        isSelected
                          ? "border-[#245746] bg-[#DDE8DF]/70 text-[#245746] dark:bg-white/15 dark:text-white font-bold"
                          : "border-[#E9EAE7] dark:border-white/10 bg-[#F7F5F0]/60 dark:bg-white/5 text-[#697681] dark:text-white/70"
                      )}
                    >
                      <span className="text-xl">{config?.emoji || "✨"}</span>
                      <span className="capitalize text-[10px]">{mood}</span>
                    </button>
                  );
                })}
              </div>

              {/* Mood Score */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-[#182B2A] dark:text-white">Mood Score</span>
                  <span className="text-[#245746] dark:text-[#88c5ad] font-bold">{moodScore}/10</span>
                </div>
                <Slider
                  value={[moodScore]}
                  onValueChange={(v) => setMoodScore(v[0])}
                  min={1}
                  max={10}
                  step={1}
                />
              </div>

              {/* Stress Level */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-[#182B2A] dark:text-white">Stress Level</span>
                  <span className="text-[#d97706] font-bold">{stressLevel}/10</span>
                </div>
                <Slider
                  value={[stressLevel]}
                  onValueChange={(v) => setStressLevel(v[0])}
                  min={1}
                  max={10}
                  step={1}
                />
              </div>

              {/* Notes */}
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 200))}
                placeholder="Add a thought or observation (optional)..."
                className="w-full p-3 rounded-2xl bg-[#F7F5F0]/70 dark:bg-black/20 border border-[#E9EAE7] dark:border-white/10 text-xs sm:text-sm text-[#182B2A] dark:text-white placeholder:text-[#697681]/60 focus:outline-none focus:border-[#245746] resize-none"
                rows={2}
              />

              <Button
                onClick={handleSubmit}
                disabled={saveMood.isPending}
                className="w-full rounded-2xl h-11 bg-[#245746] hover:bg-[#1d4839] text-white text-xs font-bold shadow-xs min-h-[44px]"
              >
                {saveMood.isPending ? "Saving..." : (
                  <>
                    <Check className="w-4 h-4 mr-1.5" />
                    Save Check-in
                  </>
                )}
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}