import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Sparkles, TrendingUp, Calendar, Brain, Settings, ShieldCheck } from "lucide-react";
import { createPageUrl } from "@/utils";
import MoodCard, { moodConfig } from "@/components/mood/MoodCard";
import StressIndicator from "@/components/mood/StressIndicator";
import MoodChart from "@/components/dashboard/MoodChart";
import QuickActions from "@/components/dashboard/QuickActions";
import MoodLogger from "@/components/mood/MoodLogger";
import WellnessRing from "@/components/dashboard/WellnessRing";

export default function Home() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: moodEntries = [] } = useQuery({
    queryKey: ["moodEntries"],
    queryFn: () => base44.entities.MoodEntry.list("-created_date", 30),
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments"],
    queryFn: () => base44.entities.Appointment.filter({ status: "scheduled" }, "-date", 3),
  });

  const latestMood = moodEntries[0];
  const averageStress = moodEntries.length > 0
    ? Math.round(moodEntries.reduce((acc, e) => acc + (e.stress_level || 5), 0) / moodEntries.length)
    : null;
  const wellnessScore = averageStress !== null
    ? Math.round(100 - (averageStress * 7) + (latestMood?.mood_score ? (latestMood.mood_score - 5) * 3 : 0))
    : null;
  const clampedScore = wellnessScore !== null ? Math.max(15, Math.min(100, wellnessScore)) : null;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50/50 via-white to-purple-50/30">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between"
        >
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
              {getGreeting()}{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""} ✨
            </h1>
            <p className="text-slate-500">How are you feeling today?</p>
          </div>
          <Link to={createPageUrl("Settings")}>
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="p-3 rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-violet-600 hover:border-violet-200 transition-all"
              style={{ boxShadow: "0 2px 12px -3px rgba(124,58,237,0.08)" }}
            >
              <Settings className="w-5 h-5" />
            </motion.button>
          </Link>
        </motion.div>

        {/* Wellness Summary */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="rounded-3xl bg-white border border-slate-100 p-6 md:p-8" style={{ boxShadow: "0 4px 30px -8px rgba(124,58,237,0.08)" }}>
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-shrink-0">
                <WellnessRing
                  score={clampedScore || 0}
                  size={160}
                  sublabel={clampedScore !== null ? "Emotional Score" : "No data yet"}
                />
              </div>
              <div className="flex-1 space-y-4 w-full">
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Your Emotional Wellness</p>
                  <h2 className="text-2xl font-bold text-slate-800 mt-1 capitalize">
                    {latestMood ? latestMood.mood : "Not tracked yet"}
                  </h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-violet-50/60 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Brain className="w-4 h-4 text-violet-500" />
                      <span className="text-xs text-slate-500 font-medium">Stress Level</span>
                    </div>
                    <p className="text-lg font-bold text-slate-700">
                      {averageStress !== null ? (averageStress <= 3 ? "Low" : averageStress <= 5 ? "Moderate" : averageStress <= 7 ? "Elevated" : "High") : "—"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-teal-50/60 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-teal-500" />
                      <span className="text-xs text-slate-500 font-medium">Mood Score</span>
                    </div>
                    <p className="text-lg font-bold text-slate-700">
                      {latestMood?.mood_score ? `${latestMood.mood_score}/10` : "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <QuickActions />

        {/* Mood Logger */}
        <MoodLogger />

        {/* Mood Trends */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="rounded-3xl bg-white border border-slate-100 p-6" style={{ boxShadow: "0 2px 20px -5px rgba(124,58,237,0.06)" }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-violet-500" />
                <h2 className="font-semibold text-slate-700">Mood Trends</h2>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                  Mood
                </span>
                <span className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  Stress
                </span>
              </div>
            </div>
            <MoodChart entries={moodEntries} />
          </div>
        </motion.div>

        {/* Current Mood & Stress */}
        <div className="grid md:grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 }}
          >
            <div className="rounded-3xl bg-white border border-slate-100 p-6 h-full" style={{ boxShadow: "0 2px 20px -5px rgba(124,58,237,0.06)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-5 h-5 text-violet-500" />
                <h2 className="font-semibold text-slate-700">Current Mood</h2>
              </div>
              {latestMood ? (
                <MoodCard
                  mood={latestMood.mood}
                  score={latestMood.mood_score}
                  source={latestMood.source}
                  date={format(new Date(latestMood.created_date), "MMM d, h:mm a")}
                />
              ) : (
                <div className="text-center py-6">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                  <p className="text-sm text-slate-400">No mood tracked yet</p>
                  <p className="text-xs text-slate-300 mt-1">Use chat, voice, or face analysis to start</p>
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="rounded-3xl bg-white border border-slate-100 p-6 h-full" style={{ boxShadow: "0 2px 20px -5px rgba(124,58,237,0.06)" }}>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-rose-400" />
                <h2 className="font-semibold text-slate-700">Stress Level</h2>
              </div>
              {averageStress !== null ? (
                <div className="space-y-3">
                  <StressIndicator level={averageStress} size="lg" />
                  <p className="text-xs text-slate-400">
                    Based on your last {Math.min(moodEntries.length, 7)} entries
                  </p>
                </div>
              ) : (
                <div className="text-center py-6">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                  <p className="text-sm text-slate-400">No data available yet</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Upcoming Appointments */}
        {appointments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <div className="rounded-3xl bg-white border border-slate-100 p-6" style={{ boxShadow: "0 2px 20px -5px rgba(124,58,237,0.06)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-teal-500" />
                <h2 className="font-semibold text-slate-700">Upcoming Appointments</h2>
              </div>
              <div className="space-y-3">
                {appointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center justify-between p-4 rounded-2xl bg-teal-50/60 border border-teal-100"
                  >
                    <div>
                      <p className="font-medium text-slate-700">{apt.doctor_name}</p>
                      <p className="text-sm text-slate-500">
                        {format(new Date(apt.date), "EEEE, MMM d")} at {apt.time}
                      </p>
                    </div>
                    <span className="text-xs px-3 py-1 bg-teal-500 text-white rounded-full capitalize font-medium">
                      {apt.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Privacy indicator */}
        <div className="flex items-center justify-center gap-2 pt-2 pb-2">
          <ShieldCheck className="w-4 h-4 text-slate-300" />
          <p className="text-xs text-slate-400">Your data is private and securely stored</p>
        </div>
      </div>
    </div>
  );
}