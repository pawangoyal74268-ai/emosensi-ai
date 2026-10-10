import { motion } from "framer-motion";
import { MessageCircle, Mic, Camera, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const actions = [
  {
    icon: MessageCircle,
    label: "AI Chat",
    description: "Talk about your feelings",
    href: "Chat",
    iconBg: "from-violet-500 to-purple-600",
    tint: "bg-violet-50",
    hover: "hover:border-violet-200",
  },
  {
    icon: Mic,
    label: "Voice",
    description: "Analyze your voice",
    href: "Voice",
    iconBg: "from-sky-500 to-blue-600",
    tint: "bg-sky-50",
    hover: "hover:border-sky-200",
  },
  {
    icon: Camera,
    label: "Face Scan",
    description: "Detect emotions",
    href: "Face",
    iconBg: "from-indigo-500 to-violet-600",
    tint: "bg-indigo-50",
    hover: "hover:border-indigo-200",
  },
  {
    icon: Users,
    label: "Doctors",
    description: "Get professional help",
    href: "Doctors",
    iconBg: "from-teal-500 to-emerald-600",
    tint: "bg-teal-50",
    hover: "hover:border-teal-200",
  },
];

export default function QuickActions() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {actions.map((action, index) => (
        <motion.div
          key={action.label}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.08, duration: 0.4 }}
        >
          <Link to={createPageUrl(action.href)}>
            <motion.div
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              className={`relative overflow-hidden rounded-3xl p-5 bg-white border border-slate-100 ${action.hover} transition-all duration-300 h-full`}
              style={{ boxShadow: "0 2px 20px -5px rgba(124,58,237,0.06)" }}
            >
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${action.iconBg} flex items-center justify-center text-white mb-3`} style={{ boxShadow: "0 4px 12px -2px rgba(124,58,237,0.2)" }}>
                <action.icon className="w-6 h-6" strokeWidth={2} />
              </div>
              <h3 className="font-semibold text-slate-700 text-sm">{action.label}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{action.description}</p>
            </motion.div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}