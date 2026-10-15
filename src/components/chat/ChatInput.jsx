import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ChatInput({ onSend, onVoiceStart, onVoiceStop, isRecording, disabled }) {
  const [message, setMessage] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <div className="flex items-center gap-1.5 p-1.5 bg-white dark:bg-[#14231f] rounded-3xl border border-[#E9EAE7] dark:border-white/10 shadow-sm transition-colors">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Share what is on your mind..."
          disabled={disabled}
          className="flex-1 px-4 py-3 bg-transparent text-xs sm:text-sm text-[#182B2A] dark:text-white placeholder:text-[#697681]/60 focus:outline-none min-h-[44px]"
        />

        <div className="flex items-center gap-1 pr-1">
          {onVoiceStart && (
            <button
              type="button"
              onClick={isRecording ? onVoiceStop : onVoiceStart}
              className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center transition-colors min-h-[40px] min-w-[40px] active:scale-95",
                isRecording
                  ? "bg-rose-100 text-rose-600 dark:bg-rose-950/40"
                  : "text-[#697681] hover:text-[#182B2A] hover:bg-[#F7F5F0] dark:hover:bg-white/10"
              )}
              aria-label={isRecording ? "Stop voice input" : "Voice input"}
            >
              {isRecording ? (
                <MicOff className="w-4 h-4 text-rose-600" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
          )}

          <Button
            type="submit"
            disabled={!message.trim() || disabled}
            className="w-10 h-10 rounded-2xl p-0 bg-[#245746] hover:bg-[#1d4839] text-white flex items-center justify-center border-0 shadow-xs disabled:opacity-40 min-h-[40px] min-w-[40px] active:scale-95"
            aria-label="Send message"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </Button>
        </div>
      </div>

      {isRecording && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -top-11 left-0 right-0 flex items-center justify-center"
        >
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-rose-600 text-white rounded-full text-xs font-medium shadow-md">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span>Listening... Tap microphone to stop</span>
          </div>
        </motion.div>
      )}
    </form>
  );
}