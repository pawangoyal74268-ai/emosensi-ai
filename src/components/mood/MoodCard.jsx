import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const moodConfig = {
  happy: { emoji: "😊", color: "from-amber-400 to-orange-400", bg: "bg-amber-50", text: "text-amber-700", soft: "text-amber-600" },
  calm: { emoji: "😌", color: "from-teal-400 to-cyan-400", bg: "bg-teal-50", text: "text-teal-700", soft: "text-teal-600" },
  neutral: { emoji: "😐", color: "from-slate-400 to-gray-400", bg: "bg-slate-50", text: "text-slate-600", soft: "text-slate-500" },
  anxious: { emoji: "😰", color: "from-violet-400 to-purple-400", bg: "bg-violet-50", text: "text-violet-700", soft: "text-violet-600" },
  sad: { emoji: "😢", color: "from-blue-400 to-indigo-400", bg: "bg-blue-50", text: "text-blue-700", soft: "text-blue-600" },
  stressed: { emoji: "😫", color: "from-rose-400 to-pink-400", bg: "bg-rose-50", text: "text-rose-700", soft: "text-rose-600" },
  angry: { emoji: "😠", color: "from-red-400 to-orange-400", bg: "bg-red-50", text: "text-red-700", soft: "text-red-600" },
};

export default function MoodCard({ mood, score, source, date, onClick, compact = false }) {
  const config = moodConfig[mood] || moodConfig.neutral;

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-2xl transition-all",
        config.bg,
        compact ? "p-3" : "p-5"
      )}
    >
      <div className="relative flex items-center gap-4">
        <div className={cn(
          "flex items-center justify-center rounded-2xl bg-gradient-to-br",
          config.color,
          compact ? "w-11 h-11 text-2xl" : "w-14 h-14 text-3xl",
          "shadow-sm"
        )}>
          {config.emoji}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className={cn("font-semibold capitalize", config.text, compact ? "text-sm" : "text-base")}>
            {mood}
          </h3>
          {score && (
            <p className="text-xs text-slate-500 mt-0.5">Score: {score}/10</p>
          )}
          {source && (
            <p className="text-[11px] text-slate-400 capitalize mt-0.5">via {source}</p>
          )}
        </div>

        {date && (
          <p className="text-[11px] text-slate-400 whitespace-nowrap">{date}</p>
        )}
      </div>
    </motion.div>
  );
}

export { moodConfig };