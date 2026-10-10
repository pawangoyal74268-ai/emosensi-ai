import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { moodConfig } from "@/components/mood/MoodCard";
import { PenLine, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const moods = Object.keys(moodConfig);

export default function MoodLogger() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMood, setSelectedMood] = useState("neutral");
  const [moodScore, setMoodScore] = useState(5);
  const [stressLevel, setStressLevel] = useState(5);
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const saveMood = useMutation({
    mutationFn: (data) => base44.entities.MoodEntry.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["moodEntries"]);
      setIsOpen(false);
      setNotes("");
    }
  });

  const handleSubmit = () => {
    saveMood.mutate({
      mood: selectedMood,
      mood_score: moodScore,
      stress_level: stressLevel,
      source: "manual",
      notes
    });
  };

  return (
    <>
      {/* Trigger button */}
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center gap-4 p-5 rounded-3xl bg-white border border-slate-100 text-left group transition-all duration-300 hover:border-violet-200"
        style={{ boxShadow: "0 2px 20px -5px rgba(124,58,237,0.06)" }}
      >
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white" style={{ boxShadow: "0 4px 12px -2px rgba(124,58,237,0.25)" }}>
          <PenLine className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-slate-700">Log your mood</h3>
          <p className="text-sm text-slate-400">Quickly record how you feel right now</p>
        </div>
        <span className="text-sm text-violet-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          Open →
        </span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white rounded-3xl p-6 space-y-6"
              style={{ boxShadow: "0 20px 60px -10px rgba(124,58,237,0.15)" }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">How are you feeling?</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Take a moment to check in with yourself</p>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mood Selector */}
              <div className="grid grid-cols-4 gap-2.5">
                {moods.map((mood) => {
                  const config = moodConfig[mood];
                  return (
                    <button
                      key={mood}
                      onClick={() => setSelectedMood(mood)}
                      className={cn(
                        "flex flex-col items-center gap-1 p-3 rounded-2xl transition-all duration-200 border",
                        selectedMood === mood
                          ? cn("bg-gradient-to-br scale-105 border-transparent shadow-sm", config.color)
                          : "bg-slate-50 border-slate-100 hover:bg-slate-100"
                      )}
                    >
                      <span className="text-2xl">{config.emoji}</span>
                      <span className={cn("text-[11px] capitalize", selectedMood === mood ? "text-white font-semibold" : "text-slate-500")}>
                        {mood}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Mood Score */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-600 font-medium">Mood Score</label>
                  <span className="text-sm font-semibold text-violet-600">{moodScore}/10</span>
                </div>
                <Slider
                  value={[moodScore]}
                  onValueChange={(v) => setMoodScore(v[0])}
                  min={1}
                  max={10}
                  step={1}
                  className="cursor-pointer"
                />
              </div>

              {/* Stress Level */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-600 font-medium">Stress Level</label>
                  <span className="text-sm font-semibold text-rose-500">{stressLevel}/10</span>
                </div>
                <Slider
                  value={[stressLevel]}
                  onValueChange={(v) => setStressLevel(v[0])}
                  min={1}
                  max={10}
                  step={1}
                  className="cursor-pointer"
                />
              </div>

              {/* Notes */}
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add a note (optional)..."
                className="w-full p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-slate-700 placeholder:text-slate-400 text-sm focus:outline-none focus:border-violet-300 focus:bg-white resize-none transition-colors"
                rows={2}
              />

              <Button
                onClick={handleSubmit}
                disabled={saveMood.isPending}
                className="w-full rounded-2xl h-12 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white border-0"
              >
                {saveMood.isPending ? "Saving..." : (
                  <>
                    <Check className="w-4 h-4" />
                    Save Check-in
                  </>
                )}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}