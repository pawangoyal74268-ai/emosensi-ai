import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";

export default function ChatMessage({ message, isUser, isTyping }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      {/* Avatar */}
      <div className={cn(
        "flex-shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center",
        isUser
          ? "bg-gradient-to-br from-violet-500 to-purple-600"
          : "bg-gradient-to-br from-teal-400 to-cyan-500"
      )} style={{ boxShadow: isUser ? "0 2px 8px -2px rgba(139,92,246,0.3)" : "0 2px 8px -2px rgba(20,184,166,0.3)" }}>
        {isUser ? (
          <User className="w-4.5 h-4.5 text-white" />
        ) : (
          <Bot className="w-4.5 h-4.5 text-white" />
        )}
      </div>

      <div className={cn("flex-1 max-w-[80%]", isUser && "flex flex-col items-end")}>
        <div className={cn(
          "px-4 py-3 rounded-3xl",
          isUser
            ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-tr-md"
            : "bg-white border border-slate-100 text-slate-700 rounded-tl-md"
        )} style={!isUser ? { boxShadow: "0 2px 12px -4px rgba(124,58,237,0.06)" } : {}}>
          {isTyping ? (
            <div className="flex items-center gap-1.5 py-1.5">
              <motion.span
                animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                className="w-2 h-2 bg-violet-400 rounded-full"
              />
              <motion.span
                animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                className="w-2 h-2 bg-violet-400 rounded-full"
              />
              <motion.span
                animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                className="w-2 h-2 bg-violet-400 rounded-full"
              />
            </div>
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}