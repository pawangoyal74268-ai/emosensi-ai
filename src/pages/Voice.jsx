import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Volume2, Activity, Gauge, RefreshCw, MessageSquare, ShieldCheck, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import VoiceAnalyzer from "@/components/voice/VoiceAnalyzer";
import MoodCard from "@/components/mood/MoodCard";
import StressIndicator from "@/components/mood/StressIndicator";

export default function Voice() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [analysisResult, setAnalysisResult] = useState(null);
  const queryClient = useQueryClient();

  const handleAnalysisComplete = (analysis) => {
    setAnalysisResult(analysis);
    queryClient.invalidateQueries({ queryKey: ["moodEntries"] });
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
    queryClient.invalidateQueries({ queryKey: ["assessments"] });
  };

  const resetAnalysis = () => {
    setAnalysisResult(null);
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
            Voice Emotion Analysis
          </h1>
          <p className="text-xs sm:text-sm text-[#697681] dark:text-white/60">
            Acoustic tone, pitch, and spoken sentiment reflection
          </p>
        </div>
      </div>

      {!isAuthenticated && (
        <div className="p-4 rounded-2xl bg-[#E4EDFC]/70 dark:bg-[#1a253a] border border-[#E4EDFC] dark:border-white/10 flex items-center justify-between gap-3 text-[#182B2A] dark:text-white text-xs sm:text-sm shadow-sm">
          <div className="flex items-center gap-2.5">
            <LogIn className="w-4 h-4 text-[#284f88] dark:text-[#a0c2f8] flex-shrink-0" />
            <span>Sign in to record and save voice assessments to your health history.</span>
          </div>
          <button
            onClick={openAuthModal}
            className="px-3 py-1.5 rounded-xl bg-[#245746] text-white text-xs font-semibold flex-shrink-0 active:scale-95"
          >
            Sign In
          </button>
        </div>
      )}

      {/* Analyzer or Results */}
      <AnimatePresence mode="wait">
        {!analysisResult ? (
          <motion.div
            key="analyzer"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-4"
          >
            <VoiceAnalyzer onAnalysisComplete={handleAnalysisComplete} />

            {/* Tips Card */}
            <div className="card-wellness p-6 space-y-3">
              <h3 className="text-sm font-heading font-bold text-[#182B2A] dark:text-white">
                Tips for Accurate Acoustic Reflection
              </h3>
              <ul className="space-y-2.5 text-xs text-[#697681] dark:text-white/70">
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#DDE8DF] text-[#245746] dark:bg-white/15 dark:text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                    1
                  </span>
                  <span>Speak naturally about what is genuinely on your mind today — pace and inflection help assess state.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#DDE8DF] text-[#245746] dark:bg-white/15 dark:text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                    2
                  </span>
                  <span>Record for 1–2 minutes in a quiet environment for optimal acoustic fidelity.</span>
                </li>
              </ul>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-5"
          >
            {/* Snapshot Banner */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-[#245746] to-[#1a3e32] text-white shadow-md space-y-3">
              <div className="flex items-center justify-between text-xs text-[#DDE8DF] uppercase tracking-wider font-semibold">
                <span>Vocal Sentiment Snapshot</span>
                <span>Confidence: {analysisResult.confidence}%</span>
              </div>
              <h2 className="text-3xl font-heading font-extrabold capitalize">
                {analysisResult.detected_mood}
              </h2>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10 text-xs text-white/80">
                <div>
                  <span className="text-[11px] text-[#DDE8DF]">Stress Assessment:</span>
                  <p className="text-base font-bold text-white mt-0.5">
                    {analysisResult.stress_level <= 3 ? "Low" : analysisResult.stress_level <= 5 ? "Moderate" : analysisResult.stress_level <= 7 ? "Elevated" : "High"} ({analysisResult.stress_level}/10)
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-[#DDE8DF]">Tone State:</span>
                  <p className="text-base font-bold text-white capitalize mt-0.5">
                    {analysisResult.detected_mood}
                  </p>
                </div>
              </div>
            </div>

            {/* Detected Mood & Stress */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="card-wellness p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#697681] dark:text-white/60 mb-3">
                  Detected Emotion
                </h3>
                <MoodCard mood={analysisResult.detected_mood} source="voice" />
              </div>

              <div className="card-wellness p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#697681] dark:text-white/60 mb-3">
                  Stress Assessment
                </h3>
                <StressIndicator level={analysisResult.stress_level} size="lg" />
              </div>
            </div>

            {/* Transcript */}
            {analysisResult.transcript && (
              <div className="card-wellness p-6 space-y-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#284f88] dark:text-[#a0c2f8]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#182B2A] dark:text-white">
                    Transcribed Speech
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-[#182B2A] dark:text-white/80 leading-relaxed italic bg-[#F7F5F0]/70 dark:bg-white/5 p-3.5 rounded-2xl border border-[#E9EAE7] dark:border-white/5">
                  "{analysisResult.transcript}"
                </p>
              </div>
            )}

            {/* Voice Metrics — Pitch, Energy, Tempo */}
            <div className="card-wellness p-6 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#182B2A] dark:text-white">
                Acoustic Signal Metrics
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3.5 rounded-2xl bg-[#E4EDFC]/60 dark:bg-white/5 border border-[#E4EDFC] dark:border-white/10">
                  <Volume2 className="w-5 h-5 mx-auto text-[#284f88] dark:text-[#a0c2f8] mb-1.5" />
                  <p className="text-lg font-heading font-bold text-[#182B2A] dark:text-white">
                    {Math.round(analysisResult.pitch || 0)}
                  </p>
                  <p className="text-[10px] text-[#697681] dark:text-white/50 mt-0.5">Pitch (Hz)</p>
                </div>
                <div className="text-center p-3.5 rounded-2xl bg-[#F7F5F0] dark:bg-white/5 border border-[#E9EAE7] dark:border-white/10">
                  <Activity className="w-5 h-5 mx-auto text-[#d97706] mb-1.5" />
                  <p className="text-lg font-heading font-bold text-[#182B2A] dark:text-white">
                    {Math.round(analysisResult.energy || 0)}
                  </p>
                  <p className="text-[10px] text-[#697681] dark:text-white/50 mt-0.5">Energy</p>
                </div>
                <div className="text-center p-3.5 rounded-2xl bg-[#DDE8DF]/60 dark:bg-white/5 border border-[#DDE8DF] dark:border-white/10">
                  <Gauge className="w-5 h-5 mx-auto text-[#245746] dark:text-[#88c5ad] mb-1.5" />
                  <p className="text-lg font-heading font-bold text-[#182B2A] dark:text-white">
                    {Math.round(analysisResult.tempo || 0)}
                  </p>
                  <p className="text-[10px] text-[#697681] dark:text-white/50 mt-0.5">Tempo (BPM)</p>
                </div>
              </div>
            </div>

            {/* Clinical Disclaimer */}
            <div className="p-4 rounded-2xl bg-[#F7F5F0] dark:bg-white/5 border border-[#E9EAE7] dark:border-white/10 text-[11px] text-[#697681] dark:text-white/50 text-center leading-relaxed">
              {analysisResult.disclaimer ||
                "This emotional assessment is intended for informational self-reflection and personal awareness. It is not medical or psychological diagnosis."}
            </div>

            {/* Analyze Again Action */}
            <div className="flex justify-center">
              <Button
                onClick={resetAnalysis}
                variant="outline"
                className="rounded-full px-6 h-11 border-[#E9EAE7] dark:border-white/10 text-[#182B2A] dark:text-white hover:bg-white dark:hover:bg-white/10 text-xs sm:text-sm font-semibold"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Analyze Again
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Safety Footer */}
      <div className="flex items-center justify-center gap-2 text-xs text-[#697681] dark:text-white/40">
        <ShieldCheck className="w-4 h-4" />
        <span>Audio recordings are processed in-memory and never permanently stored</span>
      </div>
    </div>
  );
}