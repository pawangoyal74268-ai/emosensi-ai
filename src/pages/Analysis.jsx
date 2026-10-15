import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Camera, Mic, FileText, MessageCircle, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

const analysisModes = [
  {
    title: "Face Emotion Scan",
    description: "Analyze visible facial expressions, eyebrow tension, and smile cues for emotional self-reflection.",
    path: "Face",
    icon: Camera,
    badge: "Vision AI",
    cardBg: "bg-[#DDE8DF]/40 dark:bg-[#1a2d26]",
    accentBg: "bg-[#DDE8DF] text-[#245746] dark:bg-[#245746] dark:text-[#DDE8DF]",
    pill: "Fast • 5-sec scan",
  },
  {
    title: "Voice Analysis",
    description: "Capture speech sentiment, tone acoustics, and vocal rhythm with automated audio reflection.",
    path: "Voice",
    icon: Mic,
    badge: "Acoustic & Speech",
    cardBg: "bg-[#E4EDFC]/50 dark:bg-[#17253b]",
    accentBg: "bg-[#E4EDFC] text-[#284f88] dark:bg-[#203c68] dark:text-[#E4EDFC]",
    pill: "1-2 min check-in",
  },
  {
    title: "Text Analysis",
    description: "Express your thoughts freely in writing and discover underlying emotional nuances and coping strategies.",
    path: "Text",
    icon: FileText,
    badge: "Sentiment NLP",
    cardBg: "bg-[#EEE8FA]/60 dark:bg-[#281f3b]",
    accentBg: "bg-[#EEE8FA] text-[#553385] dark:bg-[#3d275e] dark:text-[#EEE8FA]",
    pill: "Journal reflection",
  },
  {
    title: "AI Chat Companion",
    description: "Have a real-time, empathetic conversation about your day with guided breathing and grounding tips.",
    path: "Chat",
    icon: MessageCircle,
    badge: "Interactive Chat",
    cardBg: "bg-white dark:bg-[#162723]",
    accentBg: "bg-[#245746] text-white dark:bg-[#88c5ad] dark:text-[#162723]",
    pill: "Always available",
  },
];

export default function Analysis() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      {/* Page Header */}
      <div className="space-y-1.5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DDE8DF] dark:bg-white/10 text-[#245746] dark:text-[#88c5ad] text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Multimodal Emotion Hub</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-[#182B2A] dark:text-white">
          AI Analysis Hub
        </h1>
        <p className="text-sm text-[#697681] dark:text-white/60 max-w-xl">
          Choose how you’d like to explore your feelings today — via facial expressions, spoken voice, journal text, or supportive chat.
        </p>
      </div>

      {/* Grid of 4 Analysis Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {analysisModes.map((mode, index) => {
          const Icon = mode.icon;
          return (
            <motion.div
              key={mode.path}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
            >
              <Link
                to={createPageUrl(mode.path)}
                className={`group block p-6 rounded-3xl border border-[#E9EAE7] dark:border-white/10 ${mode.cardBg} transition-all duration-200 hover:-translate-y-1 hover:shadow-lg focus:outline-none`}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-2xl ${mode.accentBg} flex items-center justify-center shadow-sm`}>
                    <Icon className="w-6 h-6 stroke-[2px]" />
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/80 dark:bg-black/20 text-[#182B2A] dark:text-white border border-[#E9EAE7] dark:border-white/5">
                    {mode.pill}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-heading font-bold text-[#182B2A] dark:text-white group-hover:text-[#245746] dark:group-hover:text-[#88c5ad] transition-colors">
                      {mode.title}
                    </h2>
                  </div>
                  <p className="text-xs text-[#697681] dark:text-white/70 leading-relaxed min-h-[38px]">
                    {mode.description}
                  </p>
                </div>

                <div className="mt-5 pt-3.5 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-xs font-semibold text-[#245746] dark:text-[#88c5ad]">
                  <span>Begin Assessment</span>
                  <div className="w-7 h-7 rounded-full bg-white dark:bg-white/10 flex items-center justify-center transition-transform group-hover:translate-x-1">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Trust & Clinical Disclaimer */}
      <div className="p-5 rounded-3xl bg-white dark:bg-[#14231f] border border-[#E9EAE7] dark:border-white/10 flex items-start gap-3.5 shadow-sm">
        <div className="w-10 h-10 rounded-2xl bg-[#DDE8DF] text-[#245746] flex items-center justify-center flex-shrink-0 mt-0.5">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#182B2A] dark:text-white">
            Clinical & Privacy Commitment
          </h3>
          <p className="text-xs text-[#697681] dark:text-white/60 leading-relaxed">
            All assessments are strictly for personal self-reflection and emotional wellness awareness. EmoSense AI does not provide medical diagnoses. Camera images and voice recordings are processed in-memory and never sold or shared.
          </p>
        </div>
      </div>
    </div>
  );
}
