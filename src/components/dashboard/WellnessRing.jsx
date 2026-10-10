import { motion } from "framer-motion";

export default function WellnessRing({ score = 0, size = 180, label = "Wellness Score", sublabel }) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const getColor = () => {
    if (score >= 70) return { stroke: "#8b5cf6", text: "text-violet-600", bg: "from-violet-400 to-purple-500" };
    if (score >= 40) return { stroke: "#f59e0b", text: "text-amber-600", bg: "from-amber-400 to-orange-500" };
    return { stroke: "#f43f5e", text: "text-rose-600", bg: "from-rose-400 to-pink-500" };
  };

  const color = getColor();

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="absolute inset-0 -rotate-90" width={size} height={size}>
        <defs>
          <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color.stroke} stopOpacity="0.8" />
            <stop offset="100%" stopColor={color.stroke} stopOpacity="1" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f1f0f7"
          strokeWidth="10"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#ringGradient)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className={`text-4xl font-bold ${color.text}`}
        >
          {Math.round(score)}%
        </motion.span>
        {sublabel && (
          <span className="text-xs text-slate-400 mt-1">{sublabel}</span>
        )}
      </div>
    </div>
  );
}