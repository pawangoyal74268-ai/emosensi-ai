import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, RefreshCw, Sparkles, LogIn, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import FaceAnalyzer from "@/components/face/FaceAnalyzer";
import MoodCard from "@/components/mood/MoodCard";
import StressIndicator from "@/components/mood/StressIndicator";

export default function Face() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [analysisResult, setAnalysisResult] = useState(null);
  const queryClient = useQueryClient();

  const handleAnalysisComplete = (analysis) => {
    setAnalysisResult(analysis);
    // Invalidate caches to refresh history and trends immediately
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
            Face Emotion Analysis
          </h1>
          <p className="text-xs sm:text-sm text-[#697681] dark:text-white/60">
            Vision-powered emotional cues and tension detection
          </p>
        </div>
      </div>

      {!isAuthenticated && (
        <div className="p-4 rounded-2xl bg-[#DDE8DF]/70 dark:bg-[#1a2e26] border border-[#DDE8DF] dark:border-white/10 flex items-center justify-between gap-3 text-[#182B2A] dark:text-white text-xs sm:text-sm shadow-sm">
          <div className="flex items-center gap-2.5">
            <LogIn className="w-4 h-4 text-[#245746] dark:text-[#88c5ad] flex-shrink-0" />
            <span>Sign in to scan and automatically record facial emotion assessments.</span>
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
            <FaceAnalyzer onAnalysisComplete={handleAnalysisComplete} />

            {/* How It Works */}
            <div className="card-wellness p-6 flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-[#DDE8DF] text-[#245746] flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-heading font-bold text-[#182B2A] dark:text-white">
                  How Expression Analysis Works
                </h3>
                <p className="text-xs text-[#697681] dark:text-white/60 leading-relaxed">
                  Our vision-capable AI observes eyebrow tension, eye relaxation, smile warmth, and jaw clenching to offer non-judgmental wellness reflections on your current state.
                </p>
              </div>
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
            <div className="p-6 rounded-3xl bg-gradient-to-br from-[#245746] to-[#18392f] text-white shadow-md space-y-3">
              <div className="flex items-center justify-between text-xs text-[#DDE8DF] uppercase tracking-wider font-semibold">
                <span>Facial Sentiment Snapshot</span>
                <span>Confidence: {analysisResult.confidence}%</span>
              </div>
              <h2 className="text-3xl font-heading font-extrabold capitalize">
                {analysisResult.dominant_emotion}
              </h2>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10 text-xs text-white/80">
                <div>
                  <span className="text-[11px] text-[#DDE8DF]">Stress Assessment:</span>
                  <p className="text-base font-bold text-white mt-0.5">
                    {analysisResult.stress_level <= 3 ? "Low" : analysisResult.stress_level <= 5 ? "Moderate" : analysisResult.stress_level <= 7 ? "Elevated" : "High"} ({analysisResult.stress_level}/10)
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-[#DDE8DF]">Dominant State:</span>
                  <p className="text-base font-bold text-white capitalize mt-0.5">
                    {analysisResult.dominant_emotion}
                  </p>
                </div>
              </div>
            </div>

            {/* In-memory Image Preview */}
            {analysisResult.image && (
              <div className="card-wellness overflow-hidden p-2">
                <img src={analysisResult.image} alt="Face Scan Capture" className="w-full aspect-video object-cover rounded-2xl" />
              </div>
            )}

            {/* Mood Card & Stress Indicator */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="card-wellness p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#697681] dark:text-white/60 mb-3">
                  Detected Emotion
                </h3>
                <MoodCard mood={analysisResult.dominant_emotion} source="face" />
              </div>

              <div className="card-wellness p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#697681] dark:text-white/60 mb-3">
                  Stress Assessment
                </h3>
                <StressIndicator level={analysisResult.stress_level} size="lg" />
              </div>
            </div>

            {/* Visible Observations */}
            {analysisResult.observations && (
              <div className="card-wellness p-6 bg-[#DDE8DF]/30 dark:bg-white/5 space-y-2 border-[#DDE8DF] dark:border-white/10">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#245746] dark:text-[#88c5ad]">
                  Visible Expression Observations
                </h3>
                <p className="text-xs sm:text-sm text-[#182B2A] dark:text-white/80 leading-relaxed">
                  {analysisResult.observations}
                </p>
              </div>
            )}

            {/* Self-Care Recommendations */}
            {Array.isArray(analysisResult.recommendations) && analysisResult.recommendations.length > 0 && (
              <div className="card-wellness p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#245746] dark:text-[#88c5ad]" />
                  <h3 className="text-sm font-bold text-[#182B2A] dark:text-white">
                    Actionable Self-Care Suggestions
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

            {/* Scan Again Action */}
            <div className="flex justify-center">
              <Button
                onClick={resetAnalysis}
                variant="outline"
                className="rounded-full px-6 h-11 border-[#E9EAE7] dark:border-white/10 text-[#182B2A] dark:text-white hover:bg-white dark:hover:bg-white/10 text-xs sm:text-sm font-semibold"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Scan Again
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Safety Footer */}
      <div className="flex items-center justify-center gap-2 text-xs text-[#697681] dark:text-white/40">
        <ShieldCheck className="w-4 h-4" />
        <span>In-memory processing: Your facial scans are strictly private</span>
      </div>
    </div>
  );
}