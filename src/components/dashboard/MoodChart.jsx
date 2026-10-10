import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

const moodToScore = {
  happy: 9,
  calm: 7,
  neutral: 5,
  anxious: 4,
  sad: 3,
  stressed: 2,
  angry: 1,
};

export default function MoodChart({ entries = [] }) {
  const chartData = useMemo(() => {
    return entries
      .slice(-14)
      .map((entry) => ({
        date: format(new Date(entry.created_date), "MMM d"),
        mood: moodToScore[entry.mood] || 5,
        stress: entry.stress_level || 5,
        moodLabel: entry.mood,
      }))
      .reverse();
  }, [entries]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="bg-white px-4 py-3 rounded-2xl border border-slate-100" style={{ boxShadow: "0 4px 20px -4px rgba(124,58,237,0.1)" }}>
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <p className="text-xs text-slate-500 capitalize mt-1.5 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-violet-500" />
          Mood: {payload[0]?.payload?.moodLabel}
        </p>
        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-400" />
          Stress: {payload[1]?.value}/10
        </p>
      </div>
    );
  };

  if (chartData.length === 0) {
    return (
      <div className="h-[200px] flex flex-col items-center justify-center gap-2 text-slate-400">
        <p className="text-sm">No mood data yet</p>
        <p className="text-xs text-slate-300">Start tracking to see your trends</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25}/>
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="stressGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'Plus Jakarta Sans' }}
        />
        <YAxis
          domain={[0, 10]}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'Plus Jakarta Sans' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="mood"
          stroke="#8b5cf6"
          strokeWidth={2.5}
          fill="url(#moodGradient)"
          dot={false}
          activeDot={{ r: 5, fill: "#8b5cf6", strokeWidth: 0 }}
        />
        <Area
          type="monotone"
          dataKey="stress"
          stroke="#f43f5e"
          strokeWidth={2}
          fill="url(#stressGradient)"
          dot={false}
          activeDot={{ r: 5, fill: "#f43f5e", strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}