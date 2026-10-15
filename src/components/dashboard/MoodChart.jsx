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
      .slice(0, 14)
      .map((entry) => ({
        date: format(new Date(entry.created_date), "MMM d"),
        mood: moodToScore[entry.mood] || 5,
        stress: entry.stress_level || 5,
        moodLabel: entry.mood,
      }))
      .reverse();
  }, [entries]);

  /**
   * @param {{
   *   active?: boolean;
   *   payload?: Array<{ value?: any; payload?: { moodLabel?: string } }>;
   *   label?: string | number;
   * }} props
   */
  const CustomTooltip = ({ active = false, payload = [], label = "" }) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="bg-white dark:bg-[#14231f] px-3.5 py-2.5 rounded-2xl border border-[#E9EAE7] dark:border-white/10 shadow-md">
        <p className="text-xs font-bold text-[#182B2A] dark:text-white">{label}</p>
        <div className="mt-1.5 space-y-1">
          <p className="text-[11px] text-[#697681] dark:text-white/70 capitalize flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#245746] dark:bg-[#88c5ad]" />
            <span>Mood: <strong className="text-[#182B2A] dark:text-white">{payload[0]?.payload?.moodLabel}</strong></span>
          </p>
          <p className="text-[11px] text-[#697681] dark:text-white/70 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#d97706]" />
            <span>Stress: <strong className="text-[#182B2A] dark:text-white">{payload[1]?.value}/10</strong></span>
          </p>
        </div>
      </div>
    );
  };

  if (chartData.length === 0) {
    return (
      <div className="h-[180px] flex flex-col items-center justify-center text-center p-4 bg-[#F7F5F0]/60 dark:bg-white/5 rounded-2xl border border-dashed border-[#E9EAE7] dark:border-white/10">
        <p className="text-xs font-semibold text-[#182B2A] dark:text-white">No historical mood check-ins yet</p>
        <p className="text-[11px] text-[#697681] dark:text-white/60 mt-0.5">
          Log your mood daily or perform an AI scan to track your emotional journey over time.
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={190}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
        <defs>
          <linearGradient id="wellnessMoodGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#245746" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#245746" stopOpacity={0.0} />
          </linearGradient>
          <linearGradient id="wellnessStressGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#d97706" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#d97706" stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: '#697681', fontFamily: 'Plus Jakarta Sans' }}
        />
        <YAxis
          domain={[0, 10]}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: '#697681', fontFamily: 'Plus Jakarta Sans' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="mood"
          stroke="#245746"
          strokeWidth={2.5}
          fill="url(#wellnessMoodGrad)"
          dot={false}
          activeDot={{ r: 4.5, fill: "#245746", strokeWidth: 2, stroke: "#fff" }}
        />
        <Area
          type="monotone"
          dataKey="stress"
          stroke="#d97706"
          strokeWidth={2}
          fill="url(#wellnessStressGrad)"
          dot={false}
          activeDot={{ r: 4, fill: "#d97706", strokeWidth: 2, stroke: "#fff" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}