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
    <form onSubmit={handleSubmit} className="relative">
      <div className="flex items-center gap-2 p-2 bg-white rounded-3xl border border-slate-100" style={{ boxShadow: "0 4px 20px -4px rgba(124,58,237,0.08)" }}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Share how you're feeling..."
          disabled={disabled}
          className="flex-1 px-4 py-3 bg-transparent text-slate-700 placeholder:text-slate-400 focus:outline-none text-sm"
        />

        <div className="flex items-center gap-1.5 pr-1">
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={isRecording ? onVoiceStop : onVoiceStart}
            className={cn(
              "p-3 rounded-2xl transition-all",
              isRecording
                ? "bg-rose-50 text-rose-500"
                : "bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            )}
          >
            {isRecording ? (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <MicOff className="w-5 h-5" />
              </motion.div>
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </motion.button>

          <Button
            type="submit"
            disabled={!message.trim() || disabled}
            className="rounded-2xl w-11 h-11 p-0 bg-gradient-to-br from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 border-0"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {isRecording && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -top-12 left-0 right-0 flex items-center justify-center"
        >
          <div className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-full text-sm" style={{ boxShadow: "0 4px 12px -2px rgba(244,63,94,0.3)" }}>
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="w-2 h-2 bg-white rounded-full"
            />
            Recording... Tap to stop
          </div>
        </motion.div>
      )}
    </form>
  );
}