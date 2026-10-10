import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function StressIndicator({ level = 5, size = "md" }) {
  const getColor = () => {
    if (level <= 3) return { gradient: "from-emerald-400 to-teal-400", text: "text-emerald-600", label: "Low Stress", dot: "bg-emerald-500" };
    if (level <= 5) return { gradient: "from-amber-400 to-yellow-400", text: "text-amber-600", label: "Moderate", dot: "bg-amber-500" };
    if (level <= 7) return { gradient: "from-orange-400 to-rose-400", text: "text-orange-600", label: "Elevated", dot: "bg-orange-500" };
    return { gradient: "from-rose-500 to-red-500", text: "text-rose-600", label: "High Stress", dot: "bg-rose-500" };
  };

  const config = getColor();
  const percentage = (level / 10) * 100;
  const sizeClass = size === "lg" ? "h-3" : size === "sm" ? "h-1.5" : "h-2";

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("w-2 h-2 rounded-full", config.dot)} />
          <span className={cn("text-sm font-medium", config.text)}>{config.label}</span>
        </div>
        <span className="text-sm text-slate-400 font-medium">{level}/10</span>
      </div>

      <div className={cn("w-full bg-slate-100 rounded-full overflow-hidden", sizeClass)}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={cn("h-full rounded-full bg-gradient-to-r", config.gradient)}
        />
      </div>
    </div>
  );
}