import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Sparkles, FileText, Send, RefreshCw, ShieldCheck, LogIn, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import apiClient from "@/api/apiClient";
import MoodCard from "@/components/mood/MoodCard";
import StressIndicator from "@/components/mood/StressIndicator";

const prompts = [
  "Today was overwhelming because...",
  "I'm feeling grateful for...",
  "Lately I have been worrying about...",
  "I felt a wave of calm when...",
];

export default function Text() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [text, setText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  const handleAnalyze = async () => {
    if (!isAuthenticated) {
      toast.error("Please sign in to analyze your journal thoughts.");
      openAuthModal();
      return;
    }

    if (!text.trim() || text.trim().length < 10) {
      toast.error("Please enter at least 10 characters to perform analysis.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const res = await apiClient.analysis.analyzeText({
        text: text.trim(),
        saveMood: true,
        title: "Text Journal Analysis",
      });

      if (res && (res.analysis || res.data)) {
        const result = res.analysis || res.data;
        setAnalysisResult(result);
        queryClient.invalidateQueries({ queryKey: ["moodEntries"] });
        queryClient.invalidateQueries({ queryKey: ["analytics"] });
        toast.success("Text emotion analysis complete!");
      } else {
        throw new Error("No analysis data returned from server.");
      }
    } catch (err) {
      console.error("[Text Analysis] Error:", err);
      const msg = err?.data?.error?.message || err?.message || "Text analysis failed. Please verify your backend server.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setAnalysisResult(null);
    setText("");
    setError(null);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3.5">
        <Link to={createPageUrl("Home")}>
          <button
            className="w-10 h-10 rounded-2xl bg-white dark:bg-white/10 border border-[#E9EAE7] dark:border-white/10 flex items-center justify-center text-[#182B2A] dark:text-white hover:border-[#245746]/40 transition-colors shadow-sm active:scale-95"
            aria-label="Back to Home"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-heading font-bold text-[#182B2A] dark:text-white">
            Text Emotion Analysis
          </h1>
          <p className="text-xs sm:text-sm text-[#697681] dark:text-white/60">
            Journal your feelings and understand emotional patterns
          </p>
        </div>
      </div>

      {!isAuthenticated && (
        <div className="p-4 rounded-2xl bg-[#EEE8FA]/70 dark:bg-[#231b31] border border-[#EEE8FA] dark:border-white/10 flex items-center justify-between gap-3 text-[#182B2A] dark:text-white text-xs sm:text-sm shadow-sm">
          <div className="flex items-center gap-2.5">
            <LogIn className="w-4 h-4 text-[#553385] dark:text-[#c4a6fb] flex-shrink-0" />
            <span>Sign in to analyze and record emotional journal entries to your health profile.</span>
          </div>
          <button
            onClick={openAuthModal}
            className="px-3 py-1.5 rounded-xl bg-[#245746] text-white text-xs font-semibold flex-shrink-0 active:scale-95"
          >
            Sign In
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {!analysisResult ? (
          <motion.div
            key="input-form"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-4"
          >
            {/* Journal Input Card */}
            <div className="card-wellness p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#245746] dark:text-[#88c5ad]">
                  <FileText className="w-4 h-4" />
                  <span>Journal Expression</span>
                </div>
                <span className={`text-xs font-mono ${text.length > 800 ? "text-amber-600" : "text-[#697681]"}`}>
                  {text.length} / 1000
                </span>
              </div>

              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 1000))}
                placeholder="Write about what happened today, what's weighing on your mind, or how your body feels right now..."
                rows={6}
                className="w-full rounded-2xl border-[#E9EAE7] dark:border-white/10 bg-[#F7F5F0]/60 dark:bg-black/20 text-[#182B2A] dark:text-white placeholder:text-[#697681]/60 focus-visible:ring-[#245746] p-4 text-sm leading-relaxed resize-none"
              />

              {/* Inspiration Prompts */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-[#697681] dark:text-white/50">
                  Try a starter prompt:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {prompts.map((p) => (
                    <button
                      key={p}
                      onClick={() => setText((prev) => (prev ? `${prev} ${p}` : p))}
                      className="text-[11px] px-3 py-1 rounded-full bg-[#F7F5F0] dark:bg-white/5 text-[#182B2A] dark:text-white/80 border border-[#E9EAE7] dark:border-white/10 hover:border-[#245746]/40 transition-colors text-left"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Analyze Action */}
              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing || text.trim().length < 10}
                className="w-full h-12 rounded-2xl bg-[#245746] hover:bg-[#1d4839] text-white font-semibold text-sm shadow-sm transition-all"
              >
                {isAnalyzing ? (
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 animate-spin" />
                    <span>Analyzing sentiment & tone...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    <span>Analyze My Thoughts</span>
                  </div>
                )}
              </Button>
            </div>

            {/* How it works info */}
            <div className="card-wellness p-5 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-[#EEE8FA] text-[#553385] flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xs font-bold text-[#182B2A] dark:text-white">Empathetic NLP Interpretation</h2>
                <p className="text-xs text-[#697681] dark:text-white/60 leading-relaxed">
                  Our emotion AI analyzes vocabulary, cognitive load, and subtle emotional cues to reflect your dominant state and suggest actionable wellness practices.
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="analysis-results"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-5"
          >
            {/* Hero Result Banner */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-[#245746] to-[#1a3e32] text-white shadow-md space-y-3">
              <div className="flex items-center justify-between text-xs text-[#DDE8DF] uppercase tracking-wider font-semibold">
                <span>Dominant Emotion Detected</span>
                <span>Confidence: {analysisResult.confidence || 85}%</span>
              </div>
              <h2 className="text-3xl font-heading font-extrabold capitalize">
                {analysisResult.dominant_emotion || analysisResult.detected_mood || "Reflective"}
              </h2>
              {analysisResult.emotional_tone && (
                <p className="text-sm text-white/90 leading-relaxed bg-white/10 p-3 rounded-2xl">
                  "{analysisResult.emotional_tone}"
                </p>
              )}
            </div>

            {/* Mood & Stress Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="card-wellness p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#697681] dark:text-white/60 mb-3">
                  Mood Classification
                </h3>
                <MoodCard
                  mood={analysisResult.dominant_emotion || analysisResult.detected_mood || "neutral"}
                  source="text"
                />
              </div>

              <div className="card-wellness p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#697681] dark:text-white/60 mb-3">
                  Stress Assessment
                </h3>
                <StressIndicator level={analysisResult.stress_level || 4} size="lg" />
              </div>
            </div>

            {/* Recommendations */}
            {Array.isArray(analysisResult.recommendations) && analysisResult.recommendations.length > 0 && (
              <div className="card-wellness p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#245746] dark:text-[#88c5ad]" />
                  <h3 className="text-sm font-bold text-[#182B2A] dark:text-white">
                    Self-Care & Grounding Suggestions
                  </h3>
                </div>
                <ul className="space-y-2.5">
                  {analysisResult.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2.5 text-xs sm:text-sm text-[#182B2A] dark:text-white/80 leading-relaxed">
                      <span className="w-5 h-5 rounded-full bg-[#DDE8DF] text-[#245746] dark:bg-white/15 dark:text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                        {index + 1}
                      </span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Clinical Disclaimer */}
            <div className="p-4 rounded-2xl bg-[#F7F5F0] dark:bg-white/5 border border-[#E9EAE7] dark:border-white/10 text-[11px] text-[#697681] dark:text-white/50 text-center leading-relaxed">
              {analysisResult.disclaimer ||
                "This emotional assessment is intended for informational self-reflection and personal awareness. It is not medical or psychological diagnosis."}
            </div>

            {/* Reset Action */}
            <div className="flex justify-center">
              <Button
                onClick={handleReset}
                variant="outline"
                className="rounded-full px-6 h-11 border-[#E9EAE7] dark:border-white/10 text-[#182B2A] dark:text-white hover:bg-white dark:hover:bg-white/10"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Write Another Entry
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Safety Footer */}
      <div className="flex items-center justify-center gap-2 text-xs text-[#697681] dark:text-white/40">
        <ShieldCheck className="w-4 h-4" />
        <span>Your journal entries are encrypted and private to your account</span>
      </div>
    </div>
  );
}
