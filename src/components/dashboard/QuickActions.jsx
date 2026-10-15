import { motion } from "framer-motion";
import { FileText, Mic, Camera, MessageCircle, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const actions = [
  {
    icon: FileText,
    label: "Text Analysis",
    description: "Reflect via journal notes",
    href: "Text",
    bg: "bg-[#EEE8FA] dark:bg-[#281f3b]",
    accent: "text-[#553385] dark:text-[#c4a6fb]",
    iconBg: "bg-white/80 dark:bg-white/10",
  },
  {
    icon: Mic,
    label: "Voice Analysis",
    description: "Speech tone & acoustics",
    href: "Voice",
    bg: "bg-[#E4EDFC] dark:bg-[#17253b]",
    accent: "text-[#284f88] dark:text-[#a0c2f8]",
    iconBg: "bg-white/80 dark:bg-white/10",
  },
  {
    icon: Camera,
    label: "Face Analysis",
    description: "Vision emotion scan",
    href: "Face",
    bg: "bg-[#DDE8DF] dark:bg-[#1a2d26]",
    accent: "text-[#245746] dark:text-[#88c5ad]",
    iconBg: "bg-white/80 dark:bg-white/10",
  },
  {
    icon: MessageCircle,
    label: "AI Chat Assistant",
    description: "Empathetic companion",
    href: "Chat",
    bg: "bg-white dark:bg-[#14231f]",
    accent: "text-[#245746] dark:text-[#88c5ad]",
    iconBg: "bg-[#DDE8DF] dark:bg-white/10",
  },
];

export default function QuickActions() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between px-0.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#697681] dark:text-white/60">
          AI Analysis Shortcuts
        </h2>
        <Link
          to={createPageUrl("Analysis")}
          className="text-xs font-semibold text-[#245746] dark:text-[#88c5ad] hover:underline"
        >
          View all →
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <motion.div
              key={action.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link to={createPageUrl(action.href)} className="block h-full focus:outline-none">
                <div
                  className={`p-4 sm:p-4.5 rounded-3xl border border-[#E9EAE7] dark:border-white/10 ${action.bg} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between h-full group`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className={`w-10 h-10 rounded-2xl ${action.iconBg} ${action.accent} flex items-center justify-center shadow-xs transition-transform group-hover:scale-105`}
                    >
                      <Icon className="w-5 h-5 stroke-[2px]" />
                    </div>
                    <div className="w-6 h-6 rounded-full bg-white/70 dark:bg-white/10 flex items-center justify-center text-[#697681] dark:text-white/60 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <div>
                    <h3 className="font-heading font-bold text-xs sm:text-sm text-[#182B2A] dark:text-white leading-tight">
                      {action.label}
                    </h3>
                    <p className="text-[11px] text-[#697681] dark:text-white/60 mt-0.5 leading-snug line-clamp-1">
                      {action.description}
                    </p>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}