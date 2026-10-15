import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Sparkles, User, Volume2, VolumeX, ArrowRight } from "lucide-react";

/**
 * @param {{
 *   message: string;
 *   isUser?: boolean;
 *   isTyping?: boolean;
 *   onSpeak?: (text: string) => void;
 *   isSpeaking?: boolean;
 *   suggestedActions?: string[];
 *   onActionClick?: (action: string) => void;
 * }} props
 */
export default function ChatMessage({
  message,
  isUser = false,
  isTyping = false,
  onSpeak,
  isSpeaking = false,
  suggestedActions = [],
  onActionClick,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("flex gap-2.5 sm:gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-2xl flex items-center justify-center shadow-xs",
          isUser
            ? "bg-[#245746] text-white"
            : "bg-[#DDE8DF] dark:bg-white/15 text-[#245746] dark:text-[#88c5ad]"
        )}
      >
        {isUser ? (
          <User className="w-4 h-4" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
      </div>

      <div className={cn("flex-1 max-w-[85%] sm:max-w-[78%]", isUser && "flex flex-col items-end")}>
        <div
          className={cn(
            "px-4 py-3 rounded-3xl text-xs sm:text-sm leading-relaxed transition-colors relative group",
            isUser
              ? "bg-[#245746] text-white rounded-tr-md shadow-xs"
              : "bg-white dark:bg-[#152420] border border-[#E9EAE7] dark:border-white/10 text-[#182B2A] dark:text-white rounded-tl-md shadow-xs"
          )}
        >
          {isTyping ? (
            <div className="flex items-center gap-1.5 py-1 px-1">
              <motion.span
                animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                className="w-2 h-2 bg-[#245746] dark:bg-[#88c5ad] rounded-full"
              />
              <motion.span
                animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                className="w-2 h-2 bg-[#245746] dark:bg-[#88c5ad] rounded-full"
              />
              <motion.span
                animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                className="w-2 h-2 bg-[#245746] dark:bg-[#88c5ad] rounded-full"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <p className="whitespace-pre-wrap">{message}</p>

              {/* Spoken AI Response Control for Assistant Messages */}
              {!isUser && onSpeak && (
                <div className="pt-1 flex items-center justify-between border-t border-[#E9EAE7]/60 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => onSpeak(message)}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full transition-all active:scale-95",
                      isSpeaking
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 animate-pulse"
                        : "text-[#697681] hover:text-[#245746] dark:text-white/60 dark:hover:text-[#88c5ad] hover:bg-[#F7F5F0] dark:hover:bg-white/5"
                    )}
                    aria-label={isSpeaking ? "Stop spoken audio" : "Listen to spoken response"}
                    title={isSpeaking ? "Stop speaking" : "Read aloud"}
                  >
                    {isSpeaking ? (
                      <>
                        <VolumeX className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Speaking... tap to stop</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Listen</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dynamic Context-Aware Suggestion Chips */}
        {!isUser && !isTyping && suggestedActions && suggestedActions.length > 0 && onActionClick && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1 }}
            className="flex flex-wrap gap-1.5 pt-2 max-w-full"
          >
            {suggestedActions.map((action, idx) => (
              <button
                key={`${action}-${idx}`}
                type="button"
                onClick={() => onActionClick(action)}
                className="inline-flex items-center gap-1 text-[11px] font-medium px-3 py-1.5 rounded-full bg-white dark:bg-[#182723] text-[#182B2A] dark:text-white/90 border border-[#E9EAE7] dark:border-white/10 hover:border-[#245746]/60 hover:bg-[#DDE8DF]/40 dark:hover:bg-white/10 transition-all text-left shadow-2xs active:scale-95 group"
              >
                <span>{action}</span>
                <ArrowRight className="w-3 h-3 text-[#245746] dark:text-[#88c5ad] opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-transform" />
              </button>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}