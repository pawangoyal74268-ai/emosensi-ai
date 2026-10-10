import { useState } from "react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { ArrowLeft, Calendar, MessageCircle, Mic, Camera, Hand, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import MoodCard from "@/components/mood/MoodCard";
import StressIndicator from "@/components/mood/StressIndicator";
import MoodChart from "@/components/dashboard/MoodChart";

const sourceIcons = {
  chat: MessageCircle,
  voice: Mic,
  face: Camera,
  manual: Hand,
};

const sourceColors = {
  chat: "bg-violet-50 text-violet-600",
  voice: "bg-sky-50 text-sky-600",
  face: "bg-indigo-50 text-indigo-600",
  manual: "bg-amber-50 text-amber-600",
};

export default function History() {
  const [filter, setFilter] = useState("all");

  const { data: moodEntries = [], isLoading } = useQuery({
    queryKey: ["moodEntries"],
    queryFn: () => base44.entities.MoodEntry.list("-created_date", 100),
  });

  const filteredEntries = filter === "all"
    ? moodEntries
    : moodEntries.filter(e => e.source === filter);

  const groupedEntries = filteredEntries.reduce((groups, entry) => {
    const date = format(new Date(entry.created_date), "yyyy-MM-dd");
    if (!groups[date]) groups[date] = [];
    groups[date].push(entry);
    return groups;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50/50 via-white to-purple-50/30">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to={createPageUrl("Home")}>
            <Button variant="ghost" size="icon" className="rounded-full bg-white border border-slate-100 text-slate-500 hover:text-violet-600" style={{ boxShadow: "0 2px 8px -2px rgba(124,58,237,0.06)" }}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Mood History</h1>
            <p className="text-sm text-slate-500">Track your emotional journey</p>
          </div>
        </div>

        {/* Trend Chart */}
        {moodEntries.length > 0 && (
          <div className="rounded-3xl bg-white border border-slate-100 p-6" style={{ boxShadow: "0 2px 20px -5px rgba(124,58,237,0.06)" }}>
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-5 h-5 text-violet-500" />
              <h2 className="font-semibold text-slate-700">Emotional Trend</h2>
            </div>
            <MoodChart entries={moodEntries} />
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { value: "all", label: "All" },
            { value: "chat", label: "Chat", icon: MessageCircle },
            { value: "voice", label: "Voice", icon: Mic },
            { value: "face", label: "Face", icon: Camera },
          ].map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              variant={filter === value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(value)}
              className={`rounded-full border-0 ${
                filter === value
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white"
                  : "bg-white text-slate-500 hover:bg-slate-50"
              }`}
              style={filter === value ? {} : { boxShadow: "0 2px 8px -2px rgba(124,58,237,0.05)" }}
            >
              {Icon && <Icon className="w-4 h-4 mr-1.5" />}
              {label}
            </Button>
          ))}
        </div>

        {/* Entries */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-white rounded-3xl animate-pulse" style={{ boxShadow: "0 2px 20px -5px rgba(124,58,237,0.06)" }} />
            ))}
          </div>
        ) : Object.keys(groupedEntries).length > 0 ? (
          <div className="space-y-6">
            {Object.entries(groupedEntries).map(([date, entries]) => (
              <motion.div
                key={date}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <Calendar className="w-4 h-4 text-slate-300" />
                  <h2 className="text-sm font-semibold text-slate-500">
                    {format(new Date(date), "EEEE, MMMM d, yyyy")}
                  </h2>
                </div>

                <div className="space-y-3">
                  {entries.map((entry) => {
                    const SourceIcon = sourceIcons[entry.source] || Hand;
                    return (
                      <div
                        key={entry.id}
                        className="bg-white rounded-3xl border border-slate-100 p-5 transition-all hover:shadow-md"
                        style={{ boxShadow: "0 2px 16px -4px rgba(124,58,237,0.05)" }}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`p-2.5 rounded-2xl ${sourceColors[entry.source] || "bg-slate-50 text-slate-500"}`}>
                            <SourceIcon className="w-5 h-5" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-4 mb-3">
                              <MoodCard mood={entry.mood} compact />
                              <span className="text-xs text-slate-400 flex-shrink-0">
                                {format(new Date(entry.created_date), "h:mm a")}
                              </span>
                            </div>

                            {entry.stress_level && (
                              <StressIndicator level={entry.stress_level} size="sm" />
                            )}

                            {entry.notes && (
                              <p className="mt-3 text-sm text-slate-500 line-clamp-2 leading-relaxed">
                                {entry.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-3xl" style={{ boxShadow: "0 2px 20px -5px rgba(124,58,237,0.06)" }}>
            <div className="w-16 h-16 mx-auto mb-4 rounded-3xl bg-violet-50 flex items-center justify-center">
              <Calendar className="w-8 h-8 text-violet-300" />
            </div>
            <p className="text-slate-500 font-medium">No emotional history yet</p>
            <p className="text-sm text-slate-400 mt-1 mb-6">
              Your emotional journey will appear here
            </p>
            <Link to={createPageUrl("Home")}>
              <Button className="rounded-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 border-0">
                Take your first assessment
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}